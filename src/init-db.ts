import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";

// Resolve relative to THIS file, not the caller's cwd, so init and the CLI always
// agree on one database no matter which directory they're invoked from.
const DATA_DIR = path.join(import.meta.dir, "..", "data");
const DB_PATH = path.join(DATA_DIR, "learn_it.db");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const db = new Database(DB_PATH);

// Integrity + concurrency. FK enforcement is OFF by default in SQLite, so the
// FOREIGN KEY clauses below are inert unless we turn it ON. WAL + a busy_timeout
// let the agent fire many short-lived `bun src/learn-it.ts ...` processes back to
// back (grade -> evaluate -> probe) without intermittent SQLITE_BUSY failures.
db.run("PRAGMA foreign_keys = ON");
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA busy_timeout = 5000");

// SUBJECT = the thing you master (Dreyfus tier lives here). Course-sized:
// "Rust", "Computer Networking". Phase is inferred, not stored; mastered_at is
// the one stored progress flag (set when the subject reaches expert).
db.run(
	`CREATE TABLE IF NOT EXISTS subjects (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT UNIQUE NOT NULL,
     target_tier TEXT,
     mastered_at TEXT,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
   );`,
);

// CONCEPT = a lesson-sized leaf under a subject ("ownership", "IP address
// types"). The roadmap IS the concept list; coverage is measured against it.
// A concept has no tier of its own — it is retained-or-not.
db.run(
	`CREATE TABLE IF NOT EXISTS concepts (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     subject_id INTEGER NOT NULL,
     name TEXT NOT NULL,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     UNIQUE (subject_id, name),
     FOREIGN KEY (subject_id) REFERENCES subjects(id)
   );`,
);

// Spaced-repetition state per card (FSRS v4). A card belongs to a concept;
// subject_id is denormalized so mastery roll-up needs no triple join. stability
// and difficulty are FSRS's latent memory variables; interval is derived from
// them each review (see src/scheduler.ts). Both default 0 = an unseen card,
// seeded from its first grade.
db.run(
	`CREATE TABLE IF NOT EXISTS flashcards (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     concept_id INTEGER NOT NULL,
     subject_id INTEGER NOT NULL,
     question TEXT NOT NULL,
     answer TEXT NOT NULL,
     next_review TEXT DEFAULT CURRENT_DATE,
     interval INTEGER DEFAULT 0,
     stability REAL DEFAULT 0,
     difficulty REAL DEFAULT 0,
     repetitions INTEGER DEFAULT 0,
     last_reviewed TEXT,
     suspended INTEGER DEFAULT 0,
     FOREIGN KEY (concept_id) REFERENCES concepts(id),
     FOREIGN KEY (subject_id) REFERENCES subjects(id)
   );`,
);

// Append-only recall log. Mastery reads THIS, not self-report, so it can't be
// faked by editing a file. interval_before is the gap the card survived —
// the proof of real long-term retention. `grader` names the model that judged
// the recall (card grading is meaning-tolerant, so it is a grader call too).
db.run(
	`CREATE TABLE IF NOT EXISTS reviews (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     card_id INTEGER NOT NULL,
     concept_id INTEGER NOT NULL,
     subject_id INTEGER NOT NULL,
     quality INTEGER NOT NULL,
     interval_before INTEGER NOT NULL,
     interval_after INTEGER NOT NULL,
     grader TEXT DEFAULT 'unpinned',
     graded_at TEXT DEFAULT CURRENT_DATE,
     FOREIGN KEY (card_id) REFERENCES flashcards(id),
     FOREIGN KEY (subject_id) REFERENCES subjects(id)
   );`,
);

// Higher-Bloom evidence, medium-agnostic. Not flashcards: explaining (teach
// back), applying (solve a problem), building (ship a real artifact). Each
// graded against a fixed rubric template. concept_id is set when a diagnostic
// probe (explore-gaps) demonstrates a specific concept, NULL for subject-level
// work like a build. `at` timestamps let the expert gate require evidence
// spread over real time, not a single lucky session. `grader` names WHICH model
// produced the score: the whole value prop is un-gameable mastery, but the score
// comes from an LLM grader (a soft, sycophantic sensor) — so every score must
// record its grader to stay reproducible and auditable.
db.run(
	`CREATE TABLE IF NOT EXISTS evidence (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     subject_id INTEGER NOT NULL,
     concept_id INTEGER,
     kind TEXT NOT NULL,
     bloom INTEGER NOT NULL,
     score INTEGER NOT NULL,
     passed INTEGER NOT NULL,
     source_file TEXT,
     grader TEXT DEFAULT 'unpinned',
     at TEXT DEFAULT CURRENT_DATE,
     FOREIGN KEY (subject_id) REFERENCES subjects(id),
     FOREIGN KEY (concept_id) REFERENCES concepts(id)
   );`,
);

// Session log: short, LLM-authored notes captured at the END of a working
// session (what was covered, where the learner struggled, what to revisit next
// time) so the next session resumes with context. This is the conversational
// stream — talking/answering, not flashcards. It is engine State (computed from
// what happened), distinct from the learner-authored subjects/<s>/notes.md.
db.run(
	`CREATE TABLE IF NOT EXISTS sessions (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     subject_id INTEGER NOT NULL,
     summary TEXT NOT NULL,
     grader TEXT DEFAULT 'unpinned',
     at TEXT DEFAULT CURRENT_DATE,
     FOREIGN KEY (subject_id) REFERENCES subjects(id)
   );`,
);

// Forward-migrate a pre-FSRS database: add the FSRS columns if an older
// flashcards table (SM-2, with ease_factor) is already on disk. CREATE TABLE
// IF NOT EXISTS leaves an existing table untouched, so do it explicitly.
function ensureColumn(table: string, col: string, decl: string) {
	const cols = db.query(`PRAGMA table_info(${table})`).all() as {
		name: string;
	}[];
	if (!cols.some((c) => c.name === col))
		db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${decl}`);
}
ensureColumn("flashcards", "stability", "REAL DEFAULT 0");
ensureColumn("flashcards", "difficulty", "REAL DEFAULT 0");

// last_reviewed is the date of the most recent grade. FSRS retrievability needs
// ACTUAL elapsed days (today - last_reviewed), not the scheduled interval — see
// src/scheduler.ts. NULL until a card is first graded. suspended takes a card
// out of the due queue without deleting its history (leeches, paused cards).
ensureColumn("flashcards", "last_reviewed", "TEXT");
ensureColumn("flashcards", "suspended", "INTEGER DEFAULT 0");

// Grader provenance, added later than the original tables. Backfill existing
// rows as 'unpinned' (not NULL) so a score with no recorded grader is VISIBLE
// when auditing — a soft grader is the value prop's weak point, so the gap must
// not hide.
ensureColumn("evidence", "grader", "TEXT DEFAULT 'unpinned'");
ensureColumn("reviews", "grader", "TEXT DEFAULT 'unpinned'");

db.close();
console.log(`learn-it database ready at ${DB_PATH}`);
