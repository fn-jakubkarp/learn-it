import { describe, expect, test } from "bun:test";
import {
	assessmentsForSubject,
	completeAssessment,
	pendingAssessments,
	recordAssessment,
} from "../src/assessments";
import { makeDb } from "./helpers";

describe("assessments — pending tracking", () => {
	test("a recorded assessment is pending until completed", () => {
		const { db, subjectId } = makeDb();
		recordAssessment(
			db,
			subjectId,
			"apply",
			"subjects/t/assessments/d-apply.md",
		);

		const pend = pendingAssessments(db, subjectId);
		expect(pend.length).toBe(1);
		expect(pend[0]?.status).toBe("pending");
		expect(pend[0]?.score).toBeNull();
	});

	test("completing by path flips it to done with a score, and it leaves the pending list", () => {
		const { db, subjectId } = makeDb();
		const p = "subjects/t/assessments/d-apply.md";
		recordAssessment(db, subjectId, "apply", p);

		const done = completeAssessment(db, subjectId, 82, "2026-06-16", p);
		expect(done?.status).toBe("pending"); // returns the row as it WAS (pre-update)
		expect(pendingAssessments(db, subjectId).length).toBe(0);

		const all = assessmentsForSubject(db, subjectId);
		expect(all[0]?.status).toBe("done");
		expect(all[0]?.score).toBe(82);
		expect(all[0]?.completed_at).toBe("2026-06-16");
	});

	test("completing an unknown path matches nothing (evaluate without a tracked file)", () => {
		const { db, subjectId } = makeDb();
		recordAssessment(db, subjectId, "apply", "subjects/t/assessments/a.md");
		const r = completeAssessment(db, subjectId, 90, "2026-06-16", "nope.md");
		expect(r).toBeUndefined();
		expect(pendingAssessments(db, subjectId).length).toBe(1); // untouched
	});

	test("pending is oldest-first and scopes to the subject", () => {
		const { db, subjectId } = makeDb();
		db.run("INSERT INTO subjects (name) VALUES ('u')");
		recordAssessment(db, subjectId, "explain", "a.md");
		recordAssessment(db, 2, "build", "b.md"); // other subject
		recordAssessment(db, subjectId, "apply", "c.md");

		expect(pendingAssessments(db).length).toBe(3); // all subjects
		const mine = pendingAssessments(db, subjectId);
		expect(mine.map((a) => a.path)).toEqual(["a.md", "c.md"]); // insertion order
	});
});
