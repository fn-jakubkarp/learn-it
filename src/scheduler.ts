import type { Database } from "bun:sqlite";

// Spaced-repetition core. SM-2 (SuperMemo 2) with the Ebbinghaus-style
// expanding intervals. This is the heart of learn-it: every card carries its
// own interval, ease, and repetition count, and the schedule grows as recall
// succeeds and collapses when it fails.

export interface CardState {
	interval: number;
	ease_factor: number;
	repetitions: number;
}

export interface CardRow extends CardState {
	id: number;
	concept_id: number;
	subject_id: number;
	question: string;
	answer: string;
	next_review: string;
}

export const FIRST_INTERVAL = 1; // days
export const SECOND_INTERVAL = 6; // days
export const MIN_EASE = 1.3;

export function today(): string {
	return new Date().toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
	const d = new Date(`${isoDate}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

// quality: 0..5. <3 = failed recall (reset), >=3 = remembered.
export function schedule(card: CardState, quality: number): CardState {
	let { interval, ease_factor, repetitions } = card;

	if (quality < 3) {
		repetitions = 0;
		interval = FIRST_INTERVAL;
	} else {
		if (repetitions === 0) interval = FIRST_INTERVAL;
		else if (repetitions === 1) interval = SECOND_INTERVAL;
		else interval = Math.round(interval * ease_factor);
		repetitions += 1;
	}

	ease_factor += 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
	if (ease_factor < MIN_EASE) ease_factor = MIN_EASE;

	return { interval, ease_factor, repetitions };
}

export function getDueCards(db: Database, subjectName?: string): CardRow[] {
	const now = today();
	if (subjectName) {
		return db
			.query(
				`SELECT f.* FROM flashcards f JOIN subjects s ON f.subject_id = s.id
         WHERE s.name = ? AND f.next_review <= ? ORDER BY f.next_review ASC`,
			)
			.all(subjectName, now) as CardRow[];
	}
	return db
		.query(
			`SELECT * FROM flashcards WHERE next_review <= ? ORDER BY next_review ASC`,
		)
		.all(now) as CardRow[];
}

export function gradeCard(db: Database, cardId: number, quality: number) {
	const card = db.query("SELECT * FROM flashcards WHERE id = ?").get(cardId) as
		| CardRow
		| undefined;
	if (!card) throw new Error(`No card with id ${cardId}`);

	const next = schedule(
		{
			interval: card.interval,
			ease_factor: card.ease_factor,
			repetitions: card.repetitions,
		},
		quality,
	);
	const nextReview = addDays(today(), next.interval);

	db.run(
		"UPDATE flashcards SET interval = ?, ease_factor = ?, repetitions = ?, next_review = ? WHERE id = ?",
		[next.interval, next.ease_factor, next.repetitions, nextReview, cardId],
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
