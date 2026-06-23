import { describe, expect, test } from "bun:test";
import {
	ensureFrontmatter,
	hasFrontmatter,
	stripFrontmatter,
	stripPrimer,
} from "../src/frontmatter";

describe("frontmatter helpers", () => {
	test("hasFrontmatter detects an opening fence", () => {
		expect(hasFrontmatter("---\ntype: audit\n---\n\nbody")).toBe(true);
		expect(hasFrontmatter("# Audit\n\nbody")).toBe(false);
		expect(hasFrontmatter("text --- not a fence")).toBe(false);
	});

	test("ensureFrontmatter injects when missing", () => {
		const out = ensureFrontmatter("# Roadmap\n\nstuff", {
			type: "roadmap",
			subject: "rust",
		});
		expect(out).toBe(
			"---\ntype: roadmap\nsubject: rust\n---\n\n# Roadmap\n\nstuff",
		);
		expect(hasFrontmatter(out)).toBe(true);
	});

	test("ensureFrontmatter is a no-op when already present (no double-stamp)", () => {
		const already = "---\ntype: notes\n---\n\nx";
		expect(ensureFrontmatter(already, { type: "notes" })).toBe(already);
	});

	test("ensureFrontmatter trims leading blank lines before the header", () => {
		expect(ensureFrontmatter("\n\nbody", { type: "notes" })).toBe(
			"---\ntype: notes\n---\n\nbody",
		);
	});

	test("stripFrontmatter returns the body after the block", () => {
		expect(
			stripFrontmatter("---\ntype: audit\nsubject: x\n---\n\nthe body"),
		).toBe("the body");
	});

	test("stripFrontmatter returns text unchanged when there is no block", () => {
		expect(stripFrontmatter("# Audit\n\nbody")).toBe("# Audit\n\nbody");
	});

	test("round-trip: a stamped file's body still compares equal to the original", () => {
		const body = "# Audit: x\n\n## Know\n- ";
		const stamped = ensureFrontmatter(body, { type: "audit", subject: "x" });
		expect(stripFrontmatter(stamped)).toBe(body);
	});
});

describe("stripPrimer — the AI nudge must not count as a filled audit", () => {
	test("removes the primer block, markers inclusive", () => {
		const text =
			"## Know\n- \n\n## Areas\n<!-- PRIMER:START -->\n- ownership\n- borrowing\n<!-- PRIMER:END -->\n";
		expect(stripPrimer(text)).toBe("## Know\n- \n\n## Areas\n\n");
	});

	test("no markers => unchanged (legacy audits, other markdown)", () => {
		const text = "## Know\n- something\n";
		expect(stripPrimer(text)).toBe(text);
	});

	test("unterminated marker => unchanged (don't eat the rest of the file)", () => {
		const text = "## Know\n- mine\n<!-- PRIMER:START -->\n- a\n";
		expect(stripPrimer(text)).toBe(text);
	});

	test("a pristine audit with the primer FILLED still strips equal to the blank scaffold", () => {
		// The core invariant: an init-seeded primer alone leaves the audit "empty".
		const blank =
			"# Audit: x\n\n## Know\n- \n\n## Areas\n<!-- PRIMER:START -->\n<!-- PRIMER:END -->\n";
		const seeded =
			"# Audit: x\n\n## Know\n- \n\n## Areas\n<!-- PRIMER:START -->\n- ownership\n- lifetimes\n<!-- PRIMER:END -->\n";
		expect(stripPrimer(seeded).trim()).toBe(stripPrimer(blank).trim());
	});

	test("learner's own words survive the strip => audit reads as filled", () => {
		const blank =
			"# Audit: x\n\n## Know\n- \n\n<!-- PRIMER:START -->\n<!-- PRIMER:END -->\n";
		const filled =
			"# Audit: x\n\n## Know\n- i know structs\n\n<!-- PRIMER:START -->\n- ownership\n<!-- PRIMER:END -->\n";
		expect(stripPrimer(filled).trim()).not.toBe(stripPrimer(blank).trim());
	});
});
