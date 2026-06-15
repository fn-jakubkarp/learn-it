import { describe, expect, test } from "bun:test";
import { advise, inferPhase, type TopicSignals } from "../src/lifecycle";

const base: TopicSignals = {
	auditFilled: false,
	hasRoadmap: false,
	cardCount: 0,
	reviewedCount: 0,
	maturedCount: 0,
	hasAppliedEvidence: false,
	mastered: false,
};
const sig = (o: Partial<TopicSignals>): TopicSignals => ({ ...base, ...o });

describe("inferPhase — phase follows real state", () => {
	test("mastered short-circuits", () => {
		expect(inferPhase(sig({ mastered: true, auditFilled: false }))).toBe(
			"mastered",
		);
	});
	test("empty audit => diagnose", () => {
		expect(inferPhase(sig({}))).toBe("diagnose");
	});
	test("audit filled but no roadmap => diagnose", () => {
		expect(inferPhase(sig({ auditFilled: true, hasRoadmap: false }))).toBe(
			"diagnose",
		);
	});
	test("demonstrated application jumps to verify regardless of cards", () => {
		expect(
			inferPhase(
				sig({ auditFilled: true, hasRoadmap: true, hasAppliedEvidence: true }),
			),
		).toBe("verify");
	});
	test("roadmap but no cards => conceptualize", () => {
		expect(
			inferPhase(sig({ auditFilled: true, hasRoadmap: true, cardCount: 0 })),
		).toBe("conceptualize");
	});
	test("cards exist but none reviewed => recall", () => {
		expect(
			inferPhase(
				sig({
					auditFilled: true,
					hasRoadmap: true,
					cardCount: 5,
					reviewedCount: 0,
				}),
			),
		).toBe("recall");
	});
	test("some cards still settling => space", () => {
		expect(
			inferPhase(
				sig({
					auditFilled: true,
					hasRoadmap: true,
					cardCount: 5,
					reviewedCount: 5,
					maturedCount: 2,
				}),
			),
		).toBe("space");
	});
	test("all cards matured => verify", () => {
		expect(
			inferPhase(
				sig({
					auditFilled: true,
					hasRoadmap: true,
					cardCount: 5,
					reviewedCount: 5,
					maturedCount: 5,
				}),
			),
		).toBe("verify");
	});
});

describe("advise — nudges, never blocks", () => {
	test("plan on an empty audit is not recommended", () => {
		const a = advise("plan", "diagnose", sig({ auditFilled: false }));
		expect(a.recommended).toBe(false);
		expect(a.note).toContain("audit");
	});
	test("review with no cards is not recommended", () => {
		const a = advise(
			"review",
			"recall",
			sig({ auditFilled: true, hasRoadmap: true, cardCount: 0 }),
		);
		expect(a.recommended).toBe(false);
	});
	test("exam with zero reviewed cards is not recommended", () => {
		const a = advise(
			"exam",
			"verify",
			sig({
				auditFilled: true,
				hasRoadmap: true,
				cardCount: 5,
				reviewedCount: 0,
			}),
		);
		expect(a.recommended).toBe(false);
	});
	test("concept is always recommended (notes are a tool, not a gate)", () => {
		const a = advise("concept", "conceptualize", sig({ auditFilled: true }));
		expect(a.recommended).toBe(true);
	});
});
