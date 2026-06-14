// Topic lifecycle. A topic is not a bag of ad-hoc commands — it walks an
// ordered set of phases that mirror how memory is built. The router consults
// this module to decide which stage a topic is allowed to run, and which stage
// to suggest next. This is what makes learn-it a progression, not a menu.

export const PHASES = [
	"diagnose", // audit current knowledge, gaps
	"conceptualize", // build the big picture
	"anchor", // glue raw facts with mnemonics
	"recall", // active retrieval
	"space", // spaced repetition over time
	"verify", // Feynman + exam under pressure
	"mastered", // passed
] as const;

export type Phase = (typeof PHASES)[number];

// Minimum phase a topic must have reached before a stage may run.
export const STAGE_GATE: Record<string, Phase> = {
	init: "diagnose",
	plan: "diagnose",
	concept: "conceptualize",
	anchor: "anchor",
	extract: "anchor",
	review: "recall",
	feynman: "verify",
	exam: "verify",
};

// The stage to suggest when a topic sits at a given phase.
export const PHASE_SUGGESTION: Record<Phase, string> = {
	diagnose: "plan",
	conceptualize: "concept",
	anchor: "anchor / extract",
	recall: "review",
	space: "review",
	verify: "feynman, then exam",
	mastered: "—",
};

export function phaseIndex(p: string): number {
	return (PHASES as readonly string[]).indexOf(p);
}

export function canRun(
	stage: string,
	current: string,
): { ok: boolean; reason?: string } {
	const need = STAGE_GATE[stage];
	if (!need) return { ok: true };
	if (phaseIndex(current) >= phaseIndex(need)) return { ok: true };
	return {
		ok: false,
		reason: `stage "${stage}" needs phase "${need}" or later; topic is at "${current}"`,
	};
}

export function nextPhase(current: string): Phase | null {
	const i = phaseIndex(current);
	if (i < 0 || i >= PHASES.length - 1) return null;
	return PHASES[i + 1] ?? null;
}
