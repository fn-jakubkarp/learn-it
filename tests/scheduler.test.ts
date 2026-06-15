import { describe, expect, test } from "bun:test";
import {
	addDays,
	type CardState,
	daysBetween,
	getDueCards,
	gradeCard,
	replayCard,
	schedule,
} from "../src/scheduler";
import { addCard, makeDb } from "./helpers";

const FRESH: CardState = {
	interval: 0,
	stability: 0,
	difficulty: 0,
	repetitions: 0,
};

describe("schedule (pure FSRS)", () => {
	test("first review seeds state from the grade; interval ~ stability", () => {
		const s = schedule(FRESH, 4, 0); // Good
		expect(s.repetitions).toBe(1);
		expect(s.stability).toBeGreaterThan(0);
		// nextInterval(S) ~ S with v4 constants
		expect(s.interval).toBe(Math.max(1, Math.round(s.stability)));
	});

	test("ANTI-GRIND: a same-day re-grade (elapsed 0) does not climb stability/interval", () => {
		const first = schedule(FRESH, 4, 0);
		const second = schedule(first, 4, 0); // graded again, 0 days later
		const third = schedule(second, 4, 0);
		// retrievability(0,S) = 1 => recall increment collapses to 0 => no growth
		expect(second.stability).toBeCloseTo(first.stability, 6);
		expect(third.stability).toBeCloseTo(first.stability, 6);
		expect(second.interval).toBe(first.interval);
		expect(third.interval).toBe(first.interval);
		// only the review counter advances
		expect(third.repetitions).toBe(3);
	});

	test("a genuinely overdue recall grows stability MORE than an on-time one", () => {
		const base = schedule(FRESH, 4, 0); // interval ~2
		const onTime = schedule(base, 4, base.interval);
		const late = schedule(base, 4, base.interval * 6); // long real gap
		expect(late.stability).toBeGreaterThan(onTime.stability);
	});

	test("a lapse (Again) collapses stability, never above the prior value", () => {
		const matured = schedule(schedule(FRESH, 4, 0), 4, 10); // build some stability
		const lapsed = schedule(matured, 0, 12); // failed recall
		expect(lapsed.stability).toBeLessThanOrEqual(matured.stability);
		expect(lapsed.stability).toBeGreaterThan(0);
	});
});

describe("date helpers (UTC)", () => {
	test("daysBetween counts whole days", () => {
		expect(daysBetween("2026-06-15", "2026-06-15")).toBe(0);
		expect(daysBetween("2026-06-15", "2026-06-25")).toBe(10);
		expect(daysBetween("2026-06-25", "2026-06-15")).toBe(-10);
	});
	test("addDays round-trips with daysBetween", () => {
		expect(daysBetween("2026-06-15", addDays("2026-06-15", 21))).toBe(21);
	});
});

describe("gradeCard (logged recall)", () => {
	test("first grade logs interval_before 0 and stamps last_reviewed", () => {
		const { db, subjectId, conceptId } = makeDb();
		const id = addCard(db, conceptId, subjectId);
		const card = gradeCard(db, id, 4, "test-model");
		expect(card.last_reviewed).not.toBeNull();
		const rev = db
			.query("SELECT interval_before, grader FROM reviews WHERE card_id = ?")
			.get(id) as { interval_before: number; grader: string };
		expect(rev.interval_before).toBe(0);
		expect(rev.grader).toBe("test-model");
	});

	test("ANTI-GRIND via the DB: same-day grinding never logs interval_before >= the proven bar", () => {
		const { db, subjectId, conceptId } = makeDb();
		const id = addCard(db, conceptId, subjectId);
		for (let i = 0; i < 6; i++) gradeCard(db, id, 4, "test-model");
		const maxIb = (
			db
				.query(
					"SELECT MAX(interval_before) AS m FROM reviews WHERE card_id = ?",
				)
				.get(id) as { m: number }
		).m;
		// every same-day review survived 0 real days; mastery's proven bar is 21
		expect(maxIb).toBe(0);
	});
});

describe("getDueCards", () => {
	test("excludes suspended cards", () => {
		const { db, subjectId, conceptId } = makeDb();
		const a = addCard(db, conceptId, subjectId, "a", "a", "2026-01-01");
		addCard(db, conceptId, subjectId, "b", "b", "2026-01-01");
		db.run("UPDATE flashcards SET suspended = 1 WHERE id = ?", [a]);
		const due = getDueCards(db);
		expect(due.map((c) => c.question)).toEqual(["b"]);
	});

	test("does not return cards scheduled in the future", () => {
		const { db, subjectId, conceptId } = makeDb();
		addCard(db, conceptId, subjectId, "future", "x", "2099-01-01");
		expect(getDueCards(db).length).toBe(0);
	});
});

describe("replayCard (undo)", () => {
	test("ungrade round-trip: deleting the last review + replay restores prior state", () => {
		const { db, subjectId, conceptId } = makeDb();
		const id = addCard(db, conceptId, subjectId);
		gradeCard(db, id, 4, "m"); // -> reps 1, state A
		const a = db
			.query(
				"SELECT interval, stability, difficulty, repetitions FROM flashcards WHERE id = ?",
			)
			.get(id) as {
			interval: number;
			stability: number;
			difficulty: number;
			repetitions: number;
		};
		gradeCard(db, id, 3, "m"); // -> reps 2, state B

		// undo the last grade
		const last = db
			.query(
				"SELECT id FROM reviews WHERE card_id = ? ORDER BY id DESC LIMIT 1",
			)
			.get(id) as { id: number };
		db.run("DELETE FROM reviews WHERE id = ?", [last.id]);
		replayCard(db, id);

		const restored = db
			.query(
				"SELECT interval, stability, difficulty, repetitions FROM flashcards WHERE id = ?",
			)
			.get(id) as {
			interval: number;
			stability: number;
			difficulty: number;
			repetitions: number;
		};
		expect(restored.repetitions).toBe(1);
		expect(restored.stability).toBeCloseTo(a.stability, 6);
		expect(restored.interval).toBe(a.interval);
	});

	test("undoing the only review resets the card to unseen", () => {
		const { db, subjectId, conceptId } = makeDb();
		const id = addCard(db, conceptId, subjectId);
		gradeCard(db, id, 4, "m");
		db.run("DELETE FROM reviews WHERE card_id = ?", [id]);
		replayCard(db, id);
		const card = db
			.query(
				"SELECT repetitions, stability, last_reviewed FROM flashcards WHERE id = ?",
			)
			.get(id) as {
			repetitions: number;
			stability: number;
			last_reviewed: null;
		};
		expect(card.repetitions).toBe(0);
		expect(card.stability).toBe(0);
		expect(card.last_reviewed).toBeNull();
	});
});
