// Mastery scoring. Harsh, per-area, and PERFORMANCE-based — never volume.
//
// The model is the Dreyfus skill-acquisition ladder. You cannot grind your way
// up: each tier above advanced-beginner gates on PROVEN RETENTION (cards
// recalled after long gaps) and VERIFICATION (passing an exam, teaching it
// back). Knowing a for-loop is advanced-beginner, full stop. The top tier is
// brutal by design, because real expertise is — the last stretch genuinely
// takes the most work (power-law learning curve).
//
// Every signal here comes from the append-only `reviews` / `verifications`
// tables, so the score reflects what the learner demonstrably did, not what
// they typed into a file.

export const DREYFUS = [
	"novice",
	"advanced-beginner",
	"competent",
	"proficient",
	"expert",
] as const;

export type Tier = (typeof DREYFUS)[number];

// A recall counts as "retained" only after surviving this gap; "long" retention
// is the sterner bar reserved for expertise.
export const RETENTION_DAYS = 21;
export const LONG_RETENTION_DAYS = 60;
export const EXAM_PASS = 70; // 0-100; an exam at/above this proves apply-level depth

export interface MasterySignals {
	cards: number;
	retainedCards: number; // distinct cards recalled at interval_before >= RETENTION_DAYS
	longRetainedCards: number; // ... >= LONG_RETENTION_DAYS
	bestExam: number; // 0-100, 0 if none taken
	examPassed: boolean; // any exam >= EXAM_PASS
	feynmanPassed: boolean; // taught it back successfully
}

interface Requirement {
	label: string;
	met: (s: MasterySignals) => boolean;
	progress: (s: MasterySignals) => number; // 0..1
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const frac = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

// What each tier demands ON TOP of the one below. Empty for novice (the floor).
const TIER_REQS: Record<Tier, Requirement[]> = {
	novice: [],
	"advanced-beginner": [
		{
			label: "make at least 3 cards",
			met: (s) => s.cards >= 3,
			progress: (s) => clamp01(s.cards / 3),
		},
	],
	competent: [
		{
			label: "build out 10+ cards",
			met: (s) => s.cards >= 10,
			progress: (s) => clamp01(s.cards / 10),
		},
		{
			label: `retain half your cards past ${RETENTION_DAYS} days`,
			met: (s) => s.cards > 0 && s.retainedCards >= Math.ceil(s.cards * 0.5),
			progress: (s) => clamp01(frac(s.retainedCards, Math.ceil(s.cards * 0.5))),
		},
	],
	proficient: [
		{
			label: "build out 15+ cards",
			met: (s) => s.cards >= 15,
			progress: (s) => clamp01(s.cards / 15),
		},
		{
			label: `retain 70% of your cards past ${RETENTION_DAYS} days`,
			met: (s) => s.cards > 0 && s.retainedCards >= Math.ceil(s.cards * 0.7),
			progress: (s) => clamp01(frac(s.retainedCards, Math.ceil(s.cards * 0.7))),
		},
		{
			label: `pass an exam (score >= ${EXAM_PASS})`,
			met: (s) => s.examPassed,
			progress: (s) => clamp01(s.bestExam / EXAM_PASS),
		},
	],
	expert: [
		{
			label: "build out 20+ cards",
			met: (s) => s.cards >= 20,
			progress: (s) => clamp01(s.cards / 20),
		},
		{
			label: `retain 60% of your cards past ${LONG_RETENTION_DAYS} days`,
			met: (s) =>
				s.cards > 0 && s.longRetainedCards >= Math.ceil(s.cards * 0.6),
			progress: (s) =>
				clamp01(frac(s.longRetainedCards, Math.ceil(s.cards * 0.6))),
		},
		{
			label: "score 90+ on an exam",
			met: (s) => s.bestExam >= 90,
			progress: (s) => clamp01(s.bestExam / 90),
		},
		{
			label: "teach it back (pass a Feynman session)",
			met: (s) => s.feynmanPassed,
			progress: (s) => (s.feynmanPassed ? 1 : 0),
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
