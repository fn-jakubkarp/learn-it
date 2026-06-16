import type { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import {
	assessMastery,
	type MasterySignals,
	masterySignals,
	tierIndexOf,
} from "../src/mastery";
import { makeDb } from "./helpers";

// Mirror src/learn-it.ts scoreToQuality so the test probes the way probe() does.
const scoreToQuality = (s: number): number =>
	s >= 85 ? 5 : s >= 70 ? 4 : s >= 40 ? 3 : 1;

// Record one probe exactly as probe() does: an evidence row (passed by >= 70)
// plus a first-exposure row at interval_before 0 with quality from the score.
function probeInto(db: Database, conceptId: number, score: number) {
	const passed = score >= 70 ? 1 : 0;
	db.run(
		"INSERT INTO evidence (subject_id, concept_id, kind, bloom, score, passed) VALUES (1, ?, 'explain', 2, ?, ?)",
		[conceptId, score, passed],
	);
	db.run(
		"INSERT INTO exposures (concept_id, subject_id, surface, quality, interval_before, interval_after) VALUES (?, 1, 'explain', ?, 0, 1)",
		[conceptId, scoreToQuality(score)],
	);
}

function withConcepts(n: number): Database {
	const { db } = makeDb(); // seeds concept id 1
	for (let i = 2; i <= n; i++)
		db.run("INSERT INTO concepts (subject_id, name) VALUES (1, ?)", [`c${i}`]);
	return db;
}

const base: MasterySignals = {
	concepts: 0,
	coveredConcepts: 0,
	provenConcepts: 0,
	longRetainedConcepts: 0,
	bestApply: 0,
	applyPassed: false,
	explainPassed: false,
	buildPassed: false,
	sustainedEvidence: false,
};
const sig = (o: Partial<MasterySignals>): MasterySignals => ({ ...base, ...o });

describe("assessMastery — tier ladder", () => {
	test("nothing demonstrated => novice", () => {
		expect(assessMastery(sig({})).tier).toBe("novice");
	});

	test("engaging one concept => advanced-beginner", () => {
		expect(assessMastery(sig({ concepts: 10, coveredConcepts: 1 })).tier).toBe(
			"advanced-beginner",
		);
	});

	test("VOLUME NEVER LIFTS A TIER: full coverage with zero proven stays advanced-beginner", () => {
		// 10 concepts all 'covered' (cards attached + reviewed) but none retained
		const m = assessMastery(
			sig({ concepts: 10, coveredConcepts: 10, provenConcepts: 0 }),
		);
		expect(m.tier).toBe("advanced-beginner");
	});

	test("coverage + proven => competent", () => {
		const m = assessMastery(
			sig({ concepts: 10, coveredConcepts: 5, provenConcepts: 4 }),
		);
		expect(m.tier).toBe("competent");
	});

	test("coverage + proven + a passed apply => proficient", () => {
		const m = assessMastery(
			sig({
				concepts: 10,
				coveredConcepts: 7,
				provenConcepts: 6,
				applyPassed: true,
				bestApply: 75,
			}),
		);
		expect(m.tier).toBe("proficient");
	});
});

describe("assessMastery — the expert gate is brutal", () => {
	const strongButNotDurable = sig({
		concepts: 10,
		coveredConcepts: 8,
		provenConcepts: 8,
		applyPassed: true,
		bestApply: 95,
		explainPassed: true,
		buildPassed: false, // no real artifact
		longRetainedConcepts: 0, // no long retention
		sustainedEvidence: false, // single session
	});

	test("SINGLE-SESSION CAP: high scores without durability or a build stay <= proficient", () => {
		const m = assessMastery(strongButNotDurable);
		expect(m.tierIndex).toBeLessThanOrEqual(tierIndexOf("proficient"));
		expect(m.blocking.join(" ")).toContain("BUILD");
		expect(m.blocking.join(" ").toLowerCase()).toContain("durability");
	});

	test("EXPERT REQUIRES A BUILD: everything else maxed but no build => not expert", () => {
		const m = assessMastery(
			sig({
				concepts: 10,
				coveredConcepts: 10,
				provenConcepts: 10,
				longRetainedConcepts: 5, // durable via long retention
				applyPassed: true,
				bestApply: 95,
				explainPassed: true,
				buildPassed: false,
			}),
		);
		expect(m.tier).not.toBe("expert");
	});

	test("a passing build + durability (long retention) + 90 apply + explain => expert", () => {
		const m = assessMastery(
			sig({
				concepts: 10,
				coveredConcepts: 10,
				provenConcepts: 10,
				longRetainedConcepts: 5,
				applyPassed: true,
				bestApply: 95,
				explainPassed: true,
				buildPassed: true,
			}),
		);
		expect(m.tier).toBe("expert");
		expect(m.withinTier).toBe(100);
		expect(m.blocking).toEqual([]);
	});

	test("durability can also be satisfied by sustained evidence over time", () => {
		const m = assessMastery(
			sig({
				concepts: 10,
				coveredConcepts: 10,
				provenConcepts: 10,
				longRetainedConcepts: 0, // no long retention...
				sustainedEvidence: true, // ...but evidence spread over real time
				applyPassed: true,
				bestApply: 95,
				explainPassed: true,
				buildPassed: true,
			}),
		);
		expect(m.tier).toBe("expert");
	});

	test("an 89 apply is not good enough for the expert gate", () => {
		const m = assessMastery(
			sig({
				concepts: 10,
				coveredConcepts: 10,
				provenConcepts: 10,
				longRetainedConcepts: 5,
				applyPassed: true,
				bestApply: 89,
				explainPassed: true,
				buildPassed: true,
			}),
		);
		expect(m.tier).not.toBe("expert");
	});
});

describe("masterySignals — a failed probe is a gap marker, not coverage", () => {
	test("BLANK probes don't count as coverage (regression: % can't ride on bombing)", () => {
		// The real run: 8 concepts, probed 3 at 45 / 30 / 20. Only the 45 (shaky)
		// is a partial retrieval success; 30 and 20 are blanks. Pre-fix all three
		// counted as coverage and the displayed % climbed 13 -> 25 -> 38 as the
		// learner bombed MORE concepts. Now only the shaky one covers.
		const db = withConcepts(8);
		probeInto(db, 1, 45); // shaky  -> quality 3 -> covered
		probeInto(db, 2, 30); // blank  -> quality 1 -> NOT covered
		probeInto(db, 3, 20); // blank  -> quality 1 -> NOT covered

		const s = masterySignals(db, 1);
		expect(s.concepts).toBe(8);
		expect(s.coveredConcepts).toBe(1); // was 3 before the fix
		expect(s.provenConcepts).toBe(0); // no retention gap cleared

		const m = assessMastery(s);
		expect(m.tier).toBe("advanced-beginner");
		expect(m.withinTier).toBe(13); // was 38 before the fix
	});

	test("more blank probes add ZERO coverage — volume can't move the number", () => {
		const db = withConcepts(8);
		const a = assessMastery(masterySignals(db, 1)).withinTier;
		for (const c of [1, 2, 3, 4, 5]) probeInto(db, c, 20); // 5 blanks
		const b = assessMastery(masterySignals(db, 1)).withinTier;
		expect(b).toBe(a); // bombing five concepts moved nothing
		expect(masterySignals(db, 1).coveredConcepts).toBe(0);
	});

	test("a shaky probe covers; a passing probe covers via passing evidence", () => {
		const db = withConcepts(4);
		probeInto(db, 1, 55); // shaky  -> quality 3 -> covered
		probeInto(db, 2, 80); // known  -> passed=1  -> covered
		probeInto(db, 3, 20); // blank  -> not covered
		expect(masterySignals(db, 1).coveredConcepts).toBe(2);
	});
});
