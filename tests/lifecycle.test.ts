import { describe, expect, test } from "bun:test";
import { advise, inferPhase, type TopicSignals } from "../src/lifecycle";

const base: TopicSignals = {
	hasRoadmap: false,
	cardCount: 0,
	reviewedCount: 0,
	maturedCount: 0,
	hasAppliedEvidence: false,
	mastered: false,
	roadmapConcepts: 0,
	diagnosedConcepts: 0,
};
const sig = (o: Partial<TopicSignals>): TopicSignals => ({ ...base, ...o });

// A subject mid-build: mapped (roadmap) AND probed (diagnosed) — the state that
// has cleared the diagnose gate. Phase from here on is driven by cards/evidence.
const built = (o: Partial<TopicSignals>): TopicSignals =>
	sig({ hasRoadmap: true, diagnosedConcepts: 1, ...o });

describe("inferPhase — phase follows real state (demonstration, not self-report)", () => {
	test("mastered short-circuits", () => {
		expect(inferPhase(sig({ mastered: true }))).toBe("mastered");
	});
	test("nothing built => diagnose", () => {
		expect(inferPhase(sig({}))).toBe("diagnose");
	});
	test("roadmap mapped but no concept probed yet => still diagnose", () => {
		// The core flip: a built map is NOT a finished diagnosis. Self-report (a
		// typed audit) no longer advances phase — only a real probe does.
		expect(inferPhase(sig({ hasRoadmap: true, diagnosedConcepts: 0 }))).toBe(
			"diagnose",
		);
	});
	test("demonstrated application jumps to verify regardless of cards or probes", () => {
		expect(
			inferPhase(sig({ hasRoadmap: true, hasAppliedEvidence: true })),
		).toBe("verify");
	});
	test("mapped + probed, no cards => conceptualize", () => {
		expect(inferPhase(built({ cardCount: 0 }))).toBe("conceptualize");
	});
	test("cards exist but none reviewed => recall", () => {
		expect(inferPhase(built({ cardCount: 5, reviewedCount: 0 }))).toBe(
			"recall",
		);
	});
	test("some cards still settling => space", () => {
		expect(
			inferPhase(built({ cardCount: 5, reviewedCount: 5, maturedCount: 2 })),
		).toBe("space");
	});
	test("all cards matured => verify", () => {
		expect(
			inferPhase(built({ cardCount: 5, reviewedCount: 5, maturedCount: 5 })),
		).toBe("verify");
	});
});

describe("advise — nudges, never blocks", () => {
	test("plan before anything is probed is not recommended", () => {
		const a = advise("plan", "diagnose", sig({ diagnosedConcepts: 0 }));
		expect(a.recommended).toBe(false);
		expect(a.note).toContain("probed");
	});
	test("plan after probing is recommended", () => {
		const a = advise("plan", "diagnose", sig({ diagnosedConcepts: 3 }));
		expect(a.recommended).toBe(true);
	});
	test("review with no cards is not recommended", () => {
		const a = advise("review", "recall", built({ cardCount: 0 }));
		expect(a.recommended).toBe(false);
	});
	test("exam with zero reviewed cards is not recommended", () => {
		const a = advise(
			"exam",
			"verify",
			built({ cardCount: 5, reviewedCount: 0 }),
		);
		expect(a.recommended).toBe(false);
	});
	test("concept is always recommended (notes are a tool, not a gate)", () => {
		const a = advise("concept", "conceptualize", built({}));
		expect(a.recommended).toBe(true);
	});

	test("teaching with most of the roadmap undiagnosed nudges (but never blocks)", () => {
		// The real-run bug: probed 3/8 concepts, then jumped to teaching.
		const a = advise(
			"concept",
			"conceptualize",
			sig({ hasRoadmap: true, roadmapConcepts: 8, diagnosedConcepts: 3 }),
		);
		expect(a.recommended).toBe(true); // advises, never blocks
		expect(a.note).toContain("3/8");
		expect(a.note).toContain("explore-gaps");
	});

	test("once most concepts are diagnosed, teaching draws no nudge", () => {
		const a = advise(
			"concept",
			"conceptualize",
			sig({ hasRoadmap: true, roadmapConcepts: 8, diagnosedConcepts: 5 }),
		);
		expect(a.recommended).toBe(true);
		expect(a.note).not.toContain("explore-gaps");
	});
});
