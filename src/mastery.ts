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

import type { Database } from "bun:sqlite";

export const DREYFUS = [
	"novice",
	"advanced-beginner",
	"competent",
	"proficient",
	"expert",
] as const;

export type Tier = (typeof DREYFUS)[number];

// Bloom level (revised taxonomy) per evidence kind — the cognitive depth a
// piece of evidence demonstrates: Understand = 2 (explain), Apply = 3 (apply),
// Create = 6 (build).
export const EVIDENCE_BLOOM = { explain: 2, apply: 3, build: 6 } as const;
export type EvidenceKind = keyof typeof EVIDENCE_BLOOM;

// Retention ladder — three rungs measuring how long a card has survived between
// recalls. Centralised here so the rungs stay ordered and coordinated; the
// "mature" rung used to live as a bare `7` inside a query in learn-it.ts.
//   MATURE    ( 7d) — card has settled out of daily churn (lifecycle "space")
//   RETENTION (21d) — gap a successful recall must clear to PROVE a concept
//   LONG      (60d) — durable long-term retention; a rung toward expert
export const MATURE_INTERVAL_DAYS = 7;
export const RETENTION_DAYS = 21;
export const LONG_RETENTION_DAYS = 60;
export const PASS = 70; // evidence at/above this passes; 90+ needed for expert

// The retrieval-quality bar a recall must clear to COUNT — for coverage and for
// proven alike. Set to the "shaky" rung of scoreToQuality (score >= 40): the
// learner showed at least partial, real retrieval. Below it (a blank/failed
// probe, quality 1) is a GAP marker, never engagement — so it can't nudge a
// tier gate. Keeps the coverage gates honest: being quizzed and bombing is not
// "covering" a concept (CLAUDE.md: "Volume never lifts a tier").
export const STRONG_RECALL_QUALITY = 3;

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

// Roll a subject's raw signals out of the append-only tables. Lives HERE, not in
// the CLI module, so it can be unit-tested against an in-memory db — importing
// learn-it.ts would run its top-level main() and open the real db. Pure read.
export function masterySignals(
	db: Database,
	subjectId: number,
): MasterySignals {
	const concepts = (
		db
			.query("SELECT COUNT(*) AS c FROM concepts WHERE subject_id = ?")
			.get(subjectId) as { c: number }
	).c;

	// "Covered" = engaged with at least a partial RETRIEVAL SUCCESS, not merely
	// touched: a reviewed card (repetitions >= 1), a passing concept-level
	// assessment, OR a retrieval exposure that cleared the success bar
	// (quality >= STRONG_RECALL_QUALITY). A bare unreviewed card and a blank/
	// failed probe are both GAP markers, not coverage — counting them would let
	// volume (cards stacked, or probes bombed) nudge the coverage gates, exactly
	// what CLAUDE.md forbids ("Volume never lifts a tier").
	const covered = (
		db
			.query(
				`SELECT COUNT(*) AS c FROM (
           SELECT concept_id FROM flashcards WHERE subject_id = ? AND repetitions >= 1
           UNION
           SELECT concept_id FROM exposures WHERE subject_id = ? AND quality >= ${STRONG_RECALL_QUALITY}
           UNION
           SELECT concept_id FROM evidence
             WHERE subject_id = ? AND concept_id IS NOT NULL AND passed = 1
         )`,
			)
			.get(subjectId, subjectId, subjectId) as { c: number }
	).c;

	// A concept is proven by retention across a real gap — through cards OR
	// through retrieval exposures (re-explain / quiz), counted symmetrically — OR
	// by passing concept-level evidence. `read` is recognition and is excluded.
	const proven = (
		db
			.query(
				`SELECT COUNT(*) AS c FROM (
           SELECT concept_id FROM reviews
             WHERE subject_id = ? AND quality >= ${STRONG_RECALL_QUALITY} AND interval_before >= ?
           UNION
           SELECT concept_id FROM exposures
             WHERE subject_id = ? AND surface IN ('explain','quiz','card')
               AND quality >= ${STRONG_RECALL_QUALITY} AND interval_before >= ?
           UNION
           SELECT concept_id FROM evidence
             WHERE subject_id = ? AND concept_id IS NOT NULL AND passed = 1
         )`,
			)
			.get(subjectId, RETENTION_DAYS, subjectId, RETENTION_DAYS, subjectId) as {
			c: number;
		}
	).c;

	const longRet = (
		db
			.query(
				`SELECT COUNT(*) AS c FROM (
           SELECT concept_id FROM reviews
             WHERE subject_id = ? AND quality >= ${STRONG_RECALL_QUALITY} AND interval_before >= ?
           UNION
           SELECT concept_id FROM exposures
             WHERE subject_id = ? AND surface IN ('explain','quiz','card')
               AND quality >= ${STRONG_RECALL_QUALITY} AND interval_before >= ?
         )`,
			)
			.get(subjectId, LONG_RETENTION_DAYS, subjectId, LONG_RETENTION_DAYS) as {
			c: number;
		}
	).c;

	const apply = db
		.query(
			"SELECT MAX(score) AS best, MAX(passed) AS passed FROM evidence WHERE subject_id = ? AND kind = 'apply'",
		)
		.get(subjectId) as { best: number | null; passed: number | null };

	const passedOf = (kind: EvidenceKind) =>
		((
			db
				.query(
					"SELECT MAX(passed) AS p FROM evidence WHERE subject_id = ? AND kind = ?",
				)
				.get(subjectId, kind) as { p: number | null }
		).p ?? 0) === 1;

	// Durability-over-time: passing apply/build on N distinct days, spanning M+.
	const span = db
		.query(
			"SELECT COUNT(DISTINCT at) AS days, MIN(at) AS first, MAX(at) AS last FROM evidence WHERE subject_id = ? AND passed = 1 AND kind IN ('apply','build')",
		)
		.get(subjectId) as {
		days: number;
		first: string | null;
		last: string | null;
	};
	const spanDays =
		span.first && span.last
			? (Date.parse(span.last) - Date.parse(span.first)) / 86_400_000
			: 0;
	const sustainedEvidence =
		span.days >= SUSTAINED_MIN_DAYS && spanDays >= SUSTAINED_MIN_SPAN_DAYS;

	return {
		concepts,
		coveredConcepts: covered,
		provenConcepts: proven,
		longRetainedConcepts: longRet,
		bestApply: apply.best ?? 0,
		applyPassed: (apply.passed ?? 0) === 1,
		explainPassed: passedOf("explain"),
		buildPassed: passedOf("build"),
		sustainedEvidence,
	};
}
