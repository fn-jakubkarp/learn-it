import type { Database } from "bun:sqlite";

// Spaced-repetition core: FSRS v4 (Free Spaced Repetition Scheduler), the
// algorithm Anki adopted as its default in v23.10. It replaced the SM-2 engine
// this file used to run.
//
// Why the change: SM-2 schedules every card off a single "ease factor" that
// only ever ROSE on a perfect grade and otherwise ratcheted down to its 1.3
// floor — the well-known "ease hell" where lapsing cards get stuck reviewing
// forever. FSRS instead models memory with two latent variables per card —
// STABILITY (how many days until recall probability falls to the target) and
// DIFFICULTY (1..10, how hard the card is for this learner) — and schedules
// each review to land on a chosen recall probability (DESIRED_RETENTION).
//
// Parameters here are FSRS's published defaults; they are NOT fit to this
// learner's history (fitting needs a review corpus + an optimiser). So this is
// "good default FSRS", a strict upgrade on SM-2, with per-user optimisation as
// a later step. Formulas + weights: open-spaced-repetition / FSRS v4.

export interface CardState {
	interval: number; // days until next_review (derived from stability)
	stability: number; // FSRS S: days for recall prob to decay to DESIRED_RETENTION
	difficulty: number; // FSRS D: 1..10
	repetitions: number; // total reviews logged (monotonic; used for "has been reviewed")
}

export interface CardRow extends CardState {
	id: number;
	concept_id: number;
	subject_id: number;
	question: string;
	answer: string;
	next_review: string;
	last_reviewed: string | null; // date of the most recent grade; NULL if unseen
	suspended: number; // 1 = out of the due queue (leech / paused), 0 = active
}

// FSRS v4 default weights w[0..16].
const W = [
	0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05,
	0.34, 1.26, 0.29, 2.61,
] as const;

// Forgetting curve R(t,S) = (1 + FACTOR·t/S)^DECAY. With these constants R is
// exactly 0.9 when elapsed days t == stability S — the anchor of the model.
const DECAY = -1;
const FACTOR = 1 / 9;

// Schedule each card to be reviewed when its recall probability hits this. 0.9
// is FSRS's recommended default (lower = fewer reviews, more lapses).
export const DESIRED_RETENTION = 0.9;

const MIN_STABILITY = 0.1;
const clampD = (d: number) => Math.min(10, Math.max(1, d));

export function today(): string {
	return new Date().toISOString().slice(0, 10);
}

// All dates are handled in UTC (this, SQLite's CURRENT_DATE, and addDays alike)
// so day math never drifts between the engine and the database.
export function addDays(isoDate: string, days: number): string {
	const d = new Date(`${isoDate}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

// Whole days from one ISO date to another (UTC). Used to derive the real gap a
// card survived (today − last_reviewed) for the forgetting curve.
export function daysBetween(fromIso: string, toIso: string): number {
	const a = Date.parse(`${fromIso}T00:00:00Z`);
	const b = Date.parse(`${toIso}T00:00:00Z`);
	return Math.round((b - a) / 86_400_000);
}

// CLI grades are 0-5 (SM-2 heritage, kept so the review UX is unchanged). FSRS
// rates 1=Again 2=Hard 3=Good 4=Easy. Map: <3 stays a failed recall (Again).
function ratingFromQuality(q: number): 1 | 2 | 3 | 4 {
	if (q <= 2) return 1; // Again — failed recall
	if (q === 3) return 2; // Hard — recalled, but a struggle
	if (q === 4) return 3; // Good
	return 4; // Easy
}

const initStability = (g: number) =>
	Math.max(W[g - 1] ?? MIN_STABILITY, MIN_STABILITY);
const initDifficulty = (g: number) => clampD(W[4] - (g - 3) * W[5]);
const retrievability = (t: number, s: number) =>
	(1 + (FACTOR * t) / s) ** DECAY;

// Interval that lands recall probability on DESIRED_RETENTION. Closed form of
// R(t,S)=target solved for t; with v4 constants this is 9·S·(1/target − 1) ≈ S.
function nextInterval(s: number): number {
	const i = (s / FACTOR) * (DESIRED_RETENTION ** (1 / DECAY) - 1);
	return Math.max(1, Math.round(i));
}

// Difficulty drifts by grade, then mean-reverts toward D0(Good) so it can climb
// back down — there is no SM-2-style one-way ratchet.
const nextDifficulty = (d: number, g: number) =>
	clampD(W[7] * W[4] + (1 - W[7]) * (d - W[6] * (g - 3)));

// Stability after a successful recall: grows more when difficulty is low,
// stability is already low, and retrievability was low (a harder, more
// "desirable" recall). Hard applies a penalty (<1), Easy a bonus (>1).
function recallStability(d: number, s: number, r: number, g: number): number {
	const hard = g === 2 ? W[15] : 1;
	const easy = g === 4 ? W[16] : 1;
	const inc =
		Math.exp(W[8]) *
		(11 - d) *
		s ** -W[9] *
		(Math.exp(W[10] * (1 - r)) - 1) *
		hard *
		easy;
	return s * (1 + inc);
}

// Stability after a lapse (Again). Always collapses — never above the old S.
function forgetStability(d: number, s: number, r: number): number {
	const sf =
		W[11] * d ** -W[12] * ((s + 1) ** W[13] - 1) * Math.exp(W[14] * (1 - r));
	return Math.min(sf, s);
}

// quality: 0..5 (CLI scale). <3 = failed recall. elapsedDays is the ACTUAL number
// of days since the card was last reviewed (today − last_reviewed) — what the
// forgetting curve needs, NOT the scheduled interval. Pure: returns the next state.
//
// Real elapsed time is also what makes "proven by retention" un-gameable: grading
// a card twice the same day gives elapsedDays = 0, so retrievability = 1.0, so the
// stability increment collapses to ~0 (recall) — the interval cannot be made to
// climb by repeated same-day grading without real time passing.
export function schedule(
	card: CardState,
	quality: number,
	elapsedDays: number,
): CardState {
	const g = ratingFromQuality(quality);
	let { stability, difficulty } = card;

	if (card.repetitions === 0 || !stability) {
		// First review: seed S and D from the grade alone (no elapsed time yet).
		stability = initStability(g);
		difficulty = initDifficulty(g);
	} else {
		const r = retrievability(Math.max(0, elapsedDays), stability);
		difficulty = nextDifficulty(difficulty, g);
		stability =
			g === 1
				? forgetStability(difficulty, stability, r)
				: recallStability(difficulty, stability, r, g);
	}

	return {
		stability,
		difficulty,
		interval: nextInterval(stability),
		repetitions: card.repetitions + 1, // monotonic: total reviews, never reset
	};
}

// Round-robin the due cards across their concepts so consecutive cards are,
// wherever possible, from DIFFERENT concepts. Interleaving (vs. blocking one
// concept at a time) is a distinct "desirable difficulty" beyond spacing — the
// contextual interference forces discrimination between concepts and improves
// transfer (Rohrer & Taylor). Due-order is preserved within each concept, so
// the most-overdue card of a concept still comes first.
function interleaveByConcept(rows: CardRow[]): CardRow[] {
	const queues = new Map<number, CardRow[]>();
	for (const r of rows) {
		const q = queues.get(r.concept_id);
		if (q) q.push(r);
		else queues.set(r.concept_id, [r]);
	}
	const out: CardRow[] = [];
	let pulled = true;
	while (pulled) {
		pulled = false;
		for (const q of queues.values()) {
			const card = q.shift();
			if (card) {
				out.push(card);
				pulled = true;
			}
		}
	}
	return out;
}

export function getDueCards(db: Database, subjectName?: string): CardRow[] {
	const now = today();
	const rows = subjectName
		? (db
				.query(
					`SELECT f.* FROM flashcards f JOIN subjects s ON f.subject_id = s.id
         WHERE s.name = ? AND f.next_review <= ? AND COALESCE(f.suspended, 0) = 0
         ORDER BY f.next_review ASC`,
				)
				.all(subjectName, now) as CardRow[])
		: (db
				.query(
					`SELECT * FROM flashcards WHERE next_review <= ? AND COALESCE(suspended, 0) = 0
         ORDER BY next_review ASC`,
				)
				.all(now) as CardRow[]);
	return interleaveByConcept(rows);
}

export function gradeCard(
	db: Database,
	cardId: number,
	quality: number,
	grader = "unpinned",
) {
	const card = db.query("SELECT * FROM flashcards WHERE id = ?").get(cardId) as
		| CardRow
		| undefined;
	if (!card) throw new Error(`No card with id ${cardId}`);

	const now = today();
	// Real elapsed days since the last grade — the gap the card actually survived.
	// A first-ever review (no last_reviewed) seeds from the grade, so elapsed = 0.
	const elapsed = card.last_reviewed ? daysBetween(card.last_reviewed, now) : 0;

	const next = schedule(
		{
			interval: card.interval,
			stability: card.stability,
			difficulty: card.difficulty,
			repetitions: card.repetitions,
		},
		quality,
		elapsed,
	);
	const nextReview = addDays(now, next.interval);

	db.run(
		"UPDATE flashcards SET interval = ?, stability = ?, difficulty = ?, repetitions = ?, next_review = ?, last_reviewed = ? WHERE id = ?",
		[
			next.interval,
			next.stability,
			next.difficulty,
			next.repetitions,
			nextReview,
			now,
			cardId,
		],
	);

	// Log the recall. interval_before is the REAL gap this card survived (actual
	// elapsed days), the proof mastery scoring relies on (see src/mastery.ts).
	// graded_at is pinned to the engine's `now` (UTC) so a replay can reconstruct
	// timing. grader names the model that judged it, so the recall is auditable.
	db.run(
		"INSERT INTO reviews (card_id, concept_id, subject_id, quality, interval_before, interval_after, grader, graded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		[
			cardId,
			card.concept_id,
			card.subject_id,
			quality,
			elapsed,
			next.interval,
			grader,
			now,
		],
	);

	return { ...card, ...next, next_review: nextReview, last_reviewed: now };
}

// Rebuild a card's FSRS state by replaying its reviews in order. Used by `ungrade`
// after the most recent review row is deleted: each review stored interval_before
// = the real elapsed days at that grade, so the replay reproduces the exact prior
// state with no separate snapshot. Resets to a fresh, unseen card if none remain.
export function replayCard(db: Database, cardId: number): void {
	const exists = db.query("SELECT id FROM flashcards WHERE id = ?").get(cardId);
	if (!exists) throw new Error(`No card with id ${cardId}`);

	const reviews = db
		.query(
			"SELECT quality, interval_before, graded_at FROM reviews WHERE card_id = ? ORDER BY id ASC",
		)
		.all(cardId) as {
		quality: number;
		interval_before: number;
		graded_at: string;
	}[];

	if (!reviews.length) {
		db.run(
			"UPDATE flashcards SET interval = 0, stability = 0, difficulty = 0, repetitions = 0, next_review = ?, last_reviewed = NULL WHERE id = ?",
			[today(), cardId],
		);
		return;
	}

	let state: CardState = {
		interval: 0,
		stability: 0,
		difficulty: 0,
		repetitions: 0,
	};
	for (const r of reviews)
		state = schedule(state, r.quality, r.interval_before);

	const lastReviewed = reviews[reviews.length - 1]?.graded_at ?? today();
	db.run(
		"UPDATE flashcards SET interval = ?, stability = ?, difficulty = ?, repetitions = ?, next_review = ?, last_reviewed = ? WHERE id = ?",
		[
			state.interval,
			state.stability,
			state.difficulty,
			state.repetitions,
			addDays(lastReviewed, state.interval),
			lastReviewed,
			cardId,
		],
	);
}
