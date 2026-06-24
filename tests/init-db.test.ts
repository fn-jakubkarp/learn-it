import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { initDb, slugify } from "../src/init-db";

// initDb is the CLI's first-run self-heal: src/learn-it.ts calls it when the db
// file is absent so the tool is zero-setup on a fresh checkout across every CLI.
// These tests use the `dataDir` seam so they never touch the real data/ db.

const tmpDirs: string[] = [];
function freshDir(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "learnit-initdb-"));
	tmpDirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of tmpDirs.splice(0))
		fs.rmSync(dir, { recursive: true, force: true });
});

const EXPECTED_TABLES = [
	"subjects",
	"concepts",
	"exposures",
	"flashcards",
	"reviews",
	"evidence",
	"sessions",
	"assessments",
];

function tableNames(dbPath: string): string[] {
	const db = new Database(dbPath);
	const names = (
		db.query("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
			name: string;
		}[]
	).map((r) => r.name);
	db.close();
	return names;
}

describe("initDb (first-run self-heal)", () => {
	test("creates the data dir and the db file on a fresh checkout", () => {
		const dir = path.join(freshDir(), "nested", "data");
		expect(fs.existsSync(dir)).toBe(false);
		const dbPath = initDb(dir);
		expect(fs.existsSync(dbPath)).toBe(true);
		expect(dbPath).toBe(path.join(dir, "learn_it.db"));
	});

	test("creates every table the engine reads", () => {
		const names = tableNames(initDb(freshDir()));
		for (const t of EXPECTED_TABLES) expect(names).toContain(t);
	});

	test("is idempotent — a second call on an existing db is a no-op", () => {
		const dir = freshDir();
		const dbPath = initDb(dir);
		// Write a row, then re-init: data must survive (no DROP/recreate).
		const db = new Database(dbPath);
		db.run("INSERT INTO subjects (name) VALUES ('rust')");
		db.close();

		expect(() => initDb(dir)).not.toThrow();

		const after = new Database(dbPath);
		const count = (
			after.query("SELECT COUNT(*) AS c FROM subjects").get() as { c: number }
		).c;
		after.close();
		expect(count).toBe(1);
		expect(tableNames(dbPath)).toContain("assessments");
	});
});

describe("slugify — ascii, filesystem-safe subject ids", () => {
	test("folds diacritics and spaces (the real motivating case)", () => {
		expect(slugify("egzamin krótkofalowca klasa 1")).toBe(
			"egzamin-krotkofalowca-klasa-1",
		);
	});
	test("lowercases and trims", () => {
		expect(slugify("  Rust  ")).toBe("rust");
	});
	test("collapses runs of punctuation to a single hyphen, no edges", () => {
		expect(slugify("C++ / Systems!!")).toBe("c-systems");
	});
	test("all-symbol input degrades to a usable default", () => {
		expect(slugify("🎉🎉")).toBe("subject");
	});
});

describe("subject slug migration", () => {
	test("backfills a slug for a pre-slug row and enforces uniqueness", () => {
		const dir = freshDir();
		const dbPath = initDb(dir);
		// Two legacy rows whose names slugify to the SAME base, inserted with no slug.
		const db = new Database(dbPath);
		db.run("INSERT INTO subjects (name) VALUES ('Computer Networking')");
		db.run("INSERT INTO subjects (name) VALUES ('computer networking')");
		db.close();

		initDb(dir); // re-run = the migration backfill

		const after = new Database(dbPath);
		const slugs = (
			after.query("SELECT slug FROM subjects ORDER BY id").all() as {
				slug: string;
			}[]
		).map((r) => r.slug);
		after.close();

		expect(slugs[0]).toBe("computer-networking");
		expect(slugs[1]).toBe("computer-networking-2"); // de-duped, not a collision
		expect(new Set(slugs).size).toBe(2); // all unique
	});
});
