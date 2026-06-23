// YAML frontmatter helpers for learner/generated markdown. Detection + injection
// only — there is no parser, because nothing in the codebase consumes the values
// yet. The point is a consistent header (`type`, `subject`, ...) on every
// artifact (audit, roadmap, notes, assessments) so the files are self-describing
// and machine-greppable. `fmt` backfills anything hand-written without one.

const FENCE = "---";

// True when the text opens with a frontmatter fence.
export function hasFrontmatter(text: string): boolean {
	return text.startsWith(`${FENCE}\n`);
}

// Prepend a frontmatter block built from `fields` (order preserved) when the
// text has none; return it unchanged when it already starts with one — so this
// is safe to call on every write and never double-stamps.
export function ensureFrontmatter(
	text: string,
	fields: Record<string, string>,
): string {
	if (hasFrontmatter(text)) return text;
	const block = Object.entries(fields)
		.map(([k, v]) => `${k}: ${v}`)
		.join("\n");
	return `${FENCE}\n${block}\n${FENCE}\n\n${text.replace(/^\n+/, "")}`;
}

// Markers wrapping the AI-generated "areas this touches" primer in an audit.
// The primer is a memory-jog the agent writes to nudge the learner; it must NOT
// count as the learner having filled the audit, so the emptiness check strips
// this block (just like it strips frontmatter) before comparing against the
// pristine scaffold.
const PRIMER_START = "<!-- PRIMER:START -->";
const PRIMER_END = "<!-- PRIMER:END -->";

// Remove the primer block (markers inclusive). No markers (or an unterminated
// one) => text unchanged, so this is safe on legacy audits and any non-audit
// markdown.
export function stripPrimer(text: string): string {
	const start = text.indexOf(PRIMER_START);
	if (start < 0) return text;
	const end = text.indexOf(PRIMER_END, start);
	if (end < 0) return text; // unterminated — leave as-is
	return text.slice(0, start) + text.slice(end + PRIMER_END.length);
}

// The content after the frontmatter block (or the whole text if there is none).
// Used to judge a scaffolded file "empty" by its body, ignoring the header.
export function stripFrontmatter(text: string): string {
	if (!hasFrontmatter(text)) return text;
	const lines = text.split("\n");
	for (let i = 1; i < lines.length; i++) {
		// First standalone closing fence ends the block.
		if (lines[i] === FENCE)
			return lines
				.slice(i + 1)
				.join("\n")
				.replace(/^\n+/, "");
	}
	return text; // no closing fence — malformed; leave as-is
}
