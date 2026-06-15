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

// quality: 0..5 (CLI scale). <3 = failed recall. Pure: returns the next state.
export function schedule(card: CardState, quality: number): CardState {
	const g = ratingFromQuality(quality);
	let { stability, difficulty } = card;

	if (card.repetitions === 0 || !stability) {
		// First review: seed S and D from the grade alone.
		stability = initStability(g);
		difficulty = initDifficulty(g);
	} else {
		// interval is the gap this card just survived — its retrievability now.
		const r = retrievability(card.interval, stability);
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
         WHERE s.name = ? AND f.next_review <= ? ORDER BY f.next_review ASC`,
				)
				.all(subjectName, now) as CardRow[])
		: (db
				.query(
					`SELECT * FROM flashcards WHERE next_review <= ? ORDER BY next_review ASC`,
				)
				.all(now) as CardRow[]);
	return interleaveByConcept(rows);
}

export function gradeCard(db: Database, cardId: number, quality: number) {
	const card = db.query("SELECT * FROM flashcards WHERE id = ?").get(cardId) as
		| CardRow
		| undefined;
	if (!card) throw new Error(`No card with id ${cardId}`);

	const next = schedule(
		{
			interval: card.interval,
			stability: card.stability,
			difficulty: card.difficulty,
			repetitions: card.repetitions,
		},
		quality,
	);
	const nextReview = addDays(today(), next.interval);

	db.run(
		"UPDATE flashcards SET interval = ?, stability = ?, difficulty = ?, repetitions = ?, next_review = ? WHERE id = ?",
		[
			next.interval,
			next.stability,
			next.difficulty,
			next.repetitions,
			nextReview,
			cardId,
		],
	);

	// Log the recall. interval_before is the gap this card just survived — the
	// proof that mastery scoring relies on (see src/mastery.ts).
	db.run(
		"INSERT INTO reviews (card_id, concept_id, subject_id, quality, interval_before, interval_after) VALUES (?, ?, ?, ?, ?, ?)",
		[
			cardId,
			card.concept_id,
			card.subject_id,
			quality,
			card.interval,
			next.interval,
		],
	);

	return { ...card, ...next, next_review: nextReview };
}
