// Mastery scoring. Harsh, per-SUBJECT, and PERFORMANCE-based — never volume.
//
// The model is the Dreyfus skill-acquisition ladder; mastery lives at the
// subject level only (a single concept is proven-or-not, it has no tier). A
// subject's tier rolls up from its concepts: breadth of PROVEN concepts + depth
// of demonstrated evidence.
//
// A concept is "proven" two ways — recalled after a long gap (flashcards) OR
// backed by passing higher-Bloom evidence (you explained/applied it). So a
// practitioner who learns by doing isn't forced to grind cards: demonstrating
// it counts. This is also how a placement diagnostic (explore-gaps) can lift a
// newcomer straight to their real level instead of starting everyone at novice.
//
// But you cannot fake your way to the top. EXPERT additionally requires a real
// BUILD and DURABILITY — long-term retention OR evidence spread over real time.
// A single diagnostic session can therefore reach at most proficient. Every
// signal comes from the append-only reviews / evidence tables — demonstrated,
// not self-reported.

export const DREYFUS = [
	"novice",
	"advanced-beginner",
	"competent",
	"proficient",
	"expert",
] as const;

export type Tier = (typeof DREYFUS)[number];

// Bloom level per evidence kind — the depth a piece of evidence demonstrates.
export const EVIDENCE_BLOOM = { explain: 2, apply: 4, build: 6 } as const;
export type EvidenceKind = keyof typeof EVIDENCE_BLOOM;

export const RETENTION_DAYS = 21;
export const LONG_RETENTION_DAYS = 60;
export const PASS = 70; // evidence at/above this passes; 90+ needed for expert

// "Durability via repeated evidence" alternative to long retention: passing
// apply/build evidence on at least this many distinct days, spanning at least
// this many days. A single session satisfies neither.
export const SUSTAINED_MIN_DAYS = 3;
export const SUSTAINED_MIN_SPAN_DAYS = 30;

// Rolled up over a subject's concepts + its evidence.
export interface MasterySignals {
	concepts: number; // size of the roadmap (the concept list)
	coveredConcepts: number; // concepts touched by a card or concept-level evidence
	provenConcepts: number; // concepts retained (cards) OR backed by passing evidence
	longRetainedConcepts: number; // concepts recalled past LONG_RETENTION_DAYS (cards only)
	bestApply: number; // best apply-evidence score, 0 if none
	applyPassed: boolean; // applied it (solved a problem / exam)
	explainPassed: boolean; // taught it back
	buildPassed: boolean; // shipped a real artifact — REQUIRED for expert
	sustainedEvidence: boolean; // passing apply/build spread over real time (see consts)
}

interface Requirement {
	label: string;
	met: (s: MasterySignals) => boolean;
	progress: (s: MasterySignals) => number; // 0..1
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const frac = (part: number, whole: number) => (whole > 0 ? part / whole : 0);
const coverage = (s: MasterySignals) => frac(s.coveredConcepts, s.concepts);

// Durability for the expert gate: sustained retention OR evidence over time.
// This is the one requirement a single diagnostic session cannot satisfy.
const durable = (s: MasterySignals) =>
	(s.concepts > 0 && s.longRetainedConcepts >= Math.ceil(s.concepts * 0.5)) ||
	s.sustainedEvidence;

// What each tier demands ON TOP of the one below. Everything gates on a roadmap
// existing (concepts > 0) — without one, coverage is undefined and a subject
// can't climb past advanced-beginner. That's intended: plan the concepts first.
const TIER_REQS: Record<Tier, Requirement[]> = {
	novice: [],
	"advanced-beginner": [
		{
			label: "engage at least one concept (a card or a probe)",
			met: (s) => s.coveredConcepts >= 1,
			progress: (s) => clamp01(s.coveredConcepts),
		},
	],
	competent: [
		{
			label: "cover half the roadmap",
			met: (s) => s.concepts > 0 && coverage(s) >= 0.5,
			progress: (s) => clamp01(coverage(s) / 0.5),
		},
		{
			label: "prove 40% of concepts (retain or demonstrate)",
			met: (s) =>
				s.concepts > 0 && s.provenConcepts >= Math.ceil(s.concepts * 0.4),
			progress: (s) =>
				clamp01(frac(s.provenConcepts, Math.ceil(s.concepts * 0.4))),
		},
	],
	proficient: [
		{
			label: "cover 70% of the roadmap",
			met: (s) => coverage(s) >= 0.7,
			progress: (s) => clamp01(coverage(s) / 0.7),
		},
		{
			label: "prove 60% of concepts (retain or demonstrate)",
			met: (s) =>
				s.concepts > 0 && s.provenConcepts >= Math.ceil(s.concepts * 0.6),
			progress: (s) =>
				clamp01(frac(s.provenConcepts, Math.ceil(s.concepts * 0.6))),
		},
		{
			label: `apply it — pass an apply assessment (>= ${PASS})`,
			met: (s) => s.applyPassed,
			progress: (s) => clamp01(s.bestApply / PASS),
		},
	],
	expert: [
		{
			label: "cover 80% of the roadmap",
			met: (s) => coverage(s) >= 0.8,
			progress: (s) => clamp01(coverage(s) / 0.8),
		},
		{
			label: `prove durability — retain 50% of concepts past ${LONG_RETENTION_DAYS} days, OR pass apply/build evidence over ${SUSTAINED_MIN_SPAN_DAYS}+ days`,
			met: durable,
			progress: (s) =>
				durable(s)
					? 1
					: clamp01(frac(s.longRetainedConcepts, Math.ceil(s.concepts * 0.5))),
		},
		{
			label: "score 90+ on an apply assessment",
			met: (s) => s.bestApply >= 90,
			progress: (s) => clamp01(s.bestApply / 90),
		},
		{
			label: "teach it back (pass an explain assessment)",
			met: (s) => s.explainPassed,
			progress: (s) => (s.explainPassed ? 1 : 0),
		},
		{
			label: "BUILD something real (pass a build assessment)",
			met: (s) => s.buildPassed,
			progress: (s) => (s.buildPassed ? 1 : 0),
		},
	],
};

export interface MasteryResult {
	tier: Tier;
	tierIndex: number;
	withinTier: number; // 0-100 progress toward the next tier
	blocking: string[]; // unmet requirements for the next tier (feeds assessments + rewards)
}

export function assessMastery(s: MasterySignals): MasteryResult {
	// Walk up while every requirement of the next tier is satisfied.
	let tierIndex = 0;
	for (let i = 1; i < DREYFUS.length; i++) {
		const tier = DREYFUS[i] ?? "novice";
		if (TIER_REQS[tier].every((r) => r.met(s))) tierIndex = i;
		else break;
	}

	const tier = DREYFUS[tierIndex] ?? "novice";
	const nextTier = DREYFUS[tierIndex + 1];
	if (!nextTier) {
		return { tier, tierIndex, withinTier: 100, blocking: [] }; // expert: maxed
	}

	const reqs = TIER_REQS[nextTier];
	const avg = reqs.reduce((sum, r) => sum + r.progress(s), 0) / reqs.length;
	const blocking = reqs.filter((r) => !r.met(s)).map((r) => r.label);

	return { tier, tierIndex, withinTier: Math.round(avg * 100), blocking };
}

// Index of a tier name, or -1. Used to compare current vs target.
export function tierIndexOf(tier: string): number {
	return (DREYFUS as readonly string[]).indexOf(tier);
}
