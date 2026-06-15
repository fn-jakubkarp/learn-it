import { describe, expect, test } from "bun:test";
import {
	assessMastery,
	type MasterySignals,
	tierIndexOf,
} from "../src/mastery";

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
