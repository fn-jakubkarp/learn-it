import type { Database } from "bun:sqlite";
import {
	addDays,
	type CardState,
	daysBetween,
	schedule,
	today,
} from "./scheduler";

// Spaced exposure at the CONCEPT level — the engine that makes the conversational
// / varied-exposure stream first-class instead of flashcard-only.
//
// A concept carries its own FSRS clock (stability/difficulty/interval), exactly
// like a card, but it is advanced by ANY reinforcement surface, not just cards:
//
//   explain — teach it back (Feynman, micro)   } RETRIEVAL: full credit,
//   quiz    — one sharp recall question         }  counts toward "proven"
//   card    — a flashcard review                }
//   read    — re-read your own note              RECOGNITION: capped credit,
//                                                never proves a concept
//
// Re-reading is exposure, not retrieval, so it only keeps a concept warm; it can
// never simulate a strong recall. Because the math reuses the card scheduler, the
// same-day anti-grind property holds: a 0-day gap can't climb the interval.

export const SURFACES = {
	explain: { strong: true, label: "re-explain (teach it back)" },
	quiz: { strong: true, label: "quick quiz" },
	card: { strong: true, label: "flashcards" },
	read: { strong: false, label: "re-read your note" },
} as const;

export type Surface = keyof typeof SURFACES;

export function isSurface(s: string): s is Surface {
	return s in SURFACES;
}

// Surfaces that are genuine retrieval (everything but `read`). Centralised so the
// mastery roll-up and the engine agree on what counts toward "proven".
export const RETRIEVAL_SURFACES = (Object.keys(SURFACES) as Surface[]).filter(
	(s) => SURFACES[s].strong,
);

interface ConceptSpacingRow {
	subject_id: number;
	stability: number;
	difficulty: number;
	interval: number;
	reps: number;
	last_exposed: string | null;
}

// Record one reinforcement touch and advance the concept's exposure clock.
// Returns the new interval + next-exposure date. interval_before logged is the
// REAL elapsed days (today - last_exposed), so concept retention — like card
// retention — reflects genuine gaps, not scheduled ones.
export function recordExposure(
	db: Database,
	conceptId: number,
	surface: Surface,
	quality: number,
	grader = "unpinned",
): { interval: number; nextExposure: string } {
	const c = db
		.query(
			"SELECT subject_id, stability, difficulty, interval, reps, last_exposed FROM concepts WHERE id = ?",
		)
		.get(conceptId) as ConceptSpacingRow | undefined;
	if (!c) throw new Error(`No concept with id ${conceptId}`);

	const now = today();
	const elapsed = c.last_exposed ? daysBetween(c.last_exposed, now) : 0;
	// Recognition (read) is capped at "Hard" so it nudges the clock without ever
	// behaving like a successful retrieval.
	const effective = SURFACES[surface].strong ? quality : Math.min(quality, 2);

	const state: CardState = {
		interval: c.interval,
		stability: c.stability,
		difficulty: c.difficulty,
		repetitions: c.reps,
	};
	const next = schedule(state, effective, elapsed);
	const nextExposure = addDays(now, next.interval);

	db.run(
		"UPDATE concepts SET stability = ?, difficulty = ?, interval = ?, reps = ?, last_exposed = ?, next_exposure = ? WHERE id = ?",
		[
			next.stability,
			next.difficulty,
			next.interval,
			next.repetitions,
			now,
			nextExposure,
			conceptId,
		],
	);
	db.run(
		"INSERT INTO exposures (concept_id, subject_id, surface, quality, interval_before, interval_after, grader, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		[
			conceptId,
			c.subject_id,
			surface,
			quality,
			elapsed,
			next.interval,
			grader,
			now,
		],
	);
	return { interval: next.interval, nextExposure };
}

export interface DueConcept {
	id: number;
	name: string;
	status: string | null;
	next_exposure: string | null;
	interval: number;
	overdue: number; // days past due (>= 0)
}

// Concepts that have been started (exposed at least once) and are now due for
// re-exposure — weakest (blank → shaky → known) and most overdue first.
export function dueConcepts(db: Database, subjectName?: string): DueConcept[] {
	const now = today();
	const sql = `SELECT c.id, c.name, c.status, c.next_exposure, c.interval
       FROM concepts c
       ${subjectName ? "JOIN subjects s ON c.subject_id = s.id" : ""}
       WHERE c.next_exposure IS NOT NULL AND c.next_exposure <= ?
       ${subjectName ? "AND s.name = ?" : ""}
       ORDER BY CASE c.status WHEN 'blank' THEN 0 WHEN 'shaky' THEN 1 ELSE 2 END,
                c.next_exposure ASC`;
	const rows = (
		subjectName ? db.query(sql).all(now, subjectName) : db.query(sql).all(now)
	) as Omit<DueConcept, "overdue">[];
	return rows.map((r) => ({
		...r,
		overdue: r.next_exposure ? daysBetween(r.next_exposure, now) : 0,
	}));
}

// Diagnostic placement from a probe score (explore-gaps scoring guide):
// 70+ proven (known), 40-69 a real gap (shaky), below recall-only (blank).
export function statusFromScore(score: number): "known" | "shaky" | "blank" {
	if (score >= 70) return "known";
	if (score >= 40) return "shaky";
	return "blank";
}

// Visual tag for a concept's placement. Plain Unicode (no ANSI / TTY codes), so
// it renders identically in an agent tool-output block, the chat transcript, and
// the dashboard — the glyph vocabulary the skill surfaces as-is to make state
// changes legible against teaching prose. null/undefined = not yet probed.
export function statusGlyph(
	status: "known" | "shaky" | "blank" | null | undefined,
): string {
	if (status === "known") return "🟢";
	if (status === "shaky") return "🟡";
	if (status === "blank") return "🔴";
	return "⚪"; // untested — no probe has placed it yet
}
