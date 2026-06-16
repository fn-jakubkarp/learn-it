// The lifecycle is a MAP the mentor reads, not rails the learner rides.
// Phases describe how memory is built; a topic's phase is INFERRED from what
// the learner has actually produced — never set by a manual cursor. Topics are
// independent, so you can sit at different phases across many topics at once.
//
// Nothing here blocks. The watcher only advises: it surfaces a nudge when a
// stage is run out of its usual order, and leaves the choice to the learner.

export const PHASES = [
	"diagnose", // audit current knowledge, gaps
	"conceptualize", // build the big picture
	"recall", // active retrieval — start early, don't wait for "perfect" understanding
	"space", // spaced repetition over time
	"verify", // Feynman + exam under pressure
	"mastered", // passed
] as const;

// NOTE: `anchor` (mnemonics — palace / acronym / story) is deliberately NOT a
// phase. Mnemonics are low-utility for conceptual material and only earn their
// keep on raw, un-deducible facts (syntax, names). So anchor is an OPTIONAL
// tool reachable any time, not a station every subject must pass through — and
// retrieval (recall) is encouraged early rather than gated behind it.

export type Phase = (typeof PHASES)[number];

// What the learner has actually produced for a topic. The phase is derived
// from this, so it can never desync from reality.
export interface TopicSignals {
	auditFilled: boolean;
	hasRoadmap: boolean;
	cardCount: number;
	reviewedCount: number; // cards recalled at least once
	maturedCount: number; // cards settled into long-term (interval >= 7d)
	hasAppliedEvidence: boolean; // passed an apply/build assessment or probe
	mastered: boolean;
	roadmapConcepts: number; // registered concepts (the roadmap size)
	diagnosedConcepts: number; // concepts placed by a probe (status set)
}

// The stage(s) to suggest when a topic sits at a given phase.
export const PHASE_SUGGESTION: Record<Phase, string> = {
	diagnose: "explore-topic / explore-gaps, then plan",
	conceptualize:
		"probe / assess to test what you know, or concept -> extract -> review to build cards. Notes optional — self-written retain best.",
	recall: "review",
	space: "review",
	verify: "feynman, then exam",
	mastered: "—",
};

// The phase a stage primarily belongs to (used only to phrase advice).
const STAGE_PHASE: Record<string, Phase> = {
	init: "diagnose",
	"explore-topic": "diagnose",
	"explore-gaps": "diagnose",
	plan: "diagnose",
	concept: "conceptualize",
	anchor: "conceptualize", // optional helper, available while building understanding
	extract: "conceptualize", // bridges conceptualize -> recall; fine to run early
	review: "recall",
	feynman: "verify",
	exam: "verify",
};

export function phaseIndex(p: string): number {
	return (PHASES as readonly string[]).indexOf(p);
}

// Read a topic's phase off its real state. No setter exists by design.
export function inferPhase(s: TopicSignals): Phase {
	if (s.mastered) return "mastered";
	if (!s.auditFilled) return "diagnose";
	if (!s.hasRoadmap) return "diagnose"; // audit done, plan is the next move
	// Demonstrated application (e.g. an upskiller placed by the diagnostic) is a
	// verify-level signal regardless of how many cards exist.
	if (s.hasAppliedEvidence) return "verify";
	if (s.cardCount === 0) return "conceptualize"; // building understanding, no cards yet
	if (s.reviewedCount === 0) return "recall"; // cards exist, start retrieving
	if (s.maturedCount < s.cardCount) return "space"; // some still settling
	return "verify";
}

export interface Advice {
	recommended: boolean;
	note: string;
}

// Advisory only — NEVER blocks. Returns whether a stage fits the topic's
// current phase, plus a nudge to surface when it doesn't.
export function advise(stage: string, phase: Phase, s: TopicSignals): Advice {
	const ok: Advice = { recommended: true, note: "" };

	switch (stage) {
		case "plan":
			if (!s.auditFilled)
				return {
					recommended: false,
					note: "audit is empty — the roadmap will be generic. Fill the topic's audit.md first for a tailored plan.",
				};
			return ok;
		case "concept": {
			// Teaching before the map is diagnosed wastes effort: untested concepts
			// start at novice, so you risk re-teaching what the learner already knows
			// or skipping a missing prerequisite. The watcher surfaces this when most
			// of the roadmap is still unprobed — but NEVER blocks (the learner may
			// deliberately teach the few they've placed). Diagnose-before-teach.
			if (s.roadmapConcepts > 0 && s.diagnosedConcepts * 2 < s.roadmapConcepts)
				return {
					recommended: true,
					note: `only ${s.diagnosedConcepts}/${s.roadmapConcepts} concepts diagnosed — the rest will start at novice. Finish explore-gaps for accurate placement, or proceed deliberately on a known-weak concept.`,
				};
			// Notes are a TOOL, never a gate. The generation effect favours notes
			// the learner writes themselves, but mastery is measured by evidence and
			// retention — not by notes — so a learner who would rather be tested can
			// skip straight to probe/assess and lose nothing. Always recommended; the
			// note rides along as a tip, not a block.
			return {
				recommended: true,
				note: "notes are optional — write your own (they retain best) or skip to probe/assess to be tested instead.",
			};
		}
		case "extract":
			if (s.cardCount === 0 && !s.hasRoadmap)
				return {
					recommended: false,
					note: "no roadmap or notes yet — there is little to turn into cards.",
				};
			return ok;
		case "review":
			if (s.cardCount === 0)
				return {
					recommended: false,
					note: "no cards yet — run extract first so there is something to recall.",
				};
			return ok;
		case "feynman":
			if (s.cardCount === 0)
				return {
					recommended: false,
					note: "little built yet — Feynman works best once you can recall the basics.",
				};
			return ok;
		case "exam":
			if (s.reviewedCount === 0)
				return {
					recommended: false,
					note: "you have reviewed 0 cards — an exam now tests little. Suggested: extract -> review first.",
				};
			return ok;
		default: {
			const want = STAGE_PHASE[stage];
			if (want && phaseIndex(want) > phaseIndex(phase) + 1)
				return {
					recommended: false,
					note: `you are at "${phase}"; "${stage}" usually comes later. Fine to explore, but expect gaps.`,
				};
			return ok;
		}
	}
}
