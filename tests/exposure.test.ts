import { describe, expect, test } from "bun:test";
import {
	dueConcepts,
	recordExposure,
	statusFromScore,
	statusGlyph,
} from "../src/exposure";
import { makeDb } from "./helpers";

function conceptRow(db: ReturnType<typeof makeDb>["db"], id: number) {
	return db
		.query(
			"SELECT stability, interval, reps, next_exposure, last_exposed FROM concepts WHERE id = ?",
		)
		.get(id) as {
		stability: number;
		interval: number;
		reps: number;
		next_exposure: string | null;
		last_exposed: string | null;
	};
}

describe("recordExposure — concept-level spacing across surfaces", () => {
	test("an exposure advances the concept clock and logs to exposures", () => {
		const { db, conceptId } = makeDb();
		const r = recordExposure(db, conceptId, "quiz", 4, "m");
		expect(r.interval).toBeGreaterThan(0);
		const c = conceptRow(db, conceptId);
		expect(c.reps).toBe(1);
		expect(c.next_exposure).toBe(r.nextExposure);
		expect(c.last_exposed).not.toBeNull();
		const ex = db
			.query("SELECT surface, grader FROM exposures WHERE concept_id = ?")
			.get(conceptId) as { surface: string; grader: string };
		expect(ex.surface).toBe("quiz");
		expect(ex.grader).toBe("m");
	});

	test("re-reading is recognition-only: capped credit vs a strong retrieval", () => {
		const { db, conceptId } = makeDb();
		const read = recordExposure(db, conceptId, "read", 5, "m"); // Easy, but capped
		const readState = conceptRow(db, conceptId).stability;

		const { db: db2, conceptId: c2 } = makeDb();
		recordExposure(db2, c2, "quiz", 5, "m"); // genuine Easy recall
		const quizState = conceptRow(db2, c2).stability;

		// read (capped to Hard) must build less durable memory than a real recall
		expect(readState).toBeLessThan(quizState);
		expect(read.interval).toBeLessThanOrEqual(quizState);
	});

	test("ANTI-GRIND inherited: same-day re-exposure does not climb the interval", () => {
		const { db, conceptId } = makeDb();
		const first = recordExposure(db, conceptId, "explain", 4, "m");
		const second = recordExposure(db, conceptId, "explain", 4, "m"); // 0 days later
		expect(second.interval).toBe(first.interval);
	});
});

describe("dueConcepts", () => {
	test("returns only started concepts now due, weakest first", () => {
		const { db, subjectId } = makeDb();
		// concept 1 already exists (status null). Add two more with statuses.
		db.run(
			"INSERT INTO concepts (subject_id, name, status) VALUES (?, 'shaky-one', 'shaky')",
			[subjectId],
		);
		db.run(
			"INSERT INTO concepts (subject_id, name, status) VALUES (?, 'blank-one', 'blank')",
			[subjectId],
		);
		// expose all in the past so they're due (set next_exposure behind today)
		db.run("UPDATE concepts SET next_exposure = '2000-01-01'");
		const due = dueConcepts(db);
		// blank ranks before shaky before null-status
		expect(due[0]?.status).toBe("blank");
		expect(due[1]?.status).toBe("shaky");
		expect(due.every((d) => d.overdue > 0)).toBe(true);
	});

	test("never-exposed concepts (next_exposure NULL) are not 'due'", () => {
		const { db } = makeDb();
		expect(dueConcepts(db).length).toBe(0); // concept 1 has no exposure yet
	});
});

describe("statusFromScore", () => {
	test("maps a probe score to placement", () => {
		expect(statusFromScore(85)).toBe("known");
		expect(statusFromScore(70)).toBe("known");
		expect(statusFromScore(55)).toBe("shaky");
		expect(statusFromScore(30)).toBe("blank");
	});
});

describe("statusGlyph", () => {
	test("tags each placement with a plain-Unicode glyph (the surfaced vocab)", () => {
		expect(statusGlyph("known")).toBe("🟢");
		expect(statusGlyph("shaky")).toBe("🟡");
		expect(statusGlyph("blank")).toBe("🔴");
	});

	test("an unprobed concept (null/undefined) reads as untested", () => {
		expect(statusGlyph(null)).toBe("⚪");
		expect(statusGlyph(undefined)).toBe("⚪");
	});
});
