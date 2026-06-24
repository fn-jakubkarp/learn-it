import { describe, expect, test } from "bun:test";
import {
	ensureFrontmatter,
	hasFrontmatter,
	stripFrontmatter,
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
		const body = "# x\n\n## Goal\n- ";
		const stamped = ensureFrontmatter(body, { type: "audit", subject: "x" });
		expect(stripFrontmatter(stamped)).toBe(body);
	});
});
