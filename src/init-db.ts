import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(".", "data");
const DB_PATH = path.join(DATA_DIR, "learn_it.db");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const db = new Database(DB_PATH);

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

// Spaced-repetition state per card (SM-2). A card belongs to a concept;
// subject_id is denormalized so mastery roll-up needs no triple join.
db.run(
	`CREATE TABLE IF NOT EXISTS flashcards (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     concept_id INTEGER NOT NULL,
     subject_id INTEGER NOT NULL,
     question TEXT NOT NULL,
     answer TEXT NOT NULL,
     next_review TEXT DEFAULT CURRENT_DATE,
     interval INTEGER DEFAULT 0,
     ease_factor REAL DEFAULT 2.5,
     repetitions INTEGER DEFAULT 0,
     FOREIGN KEY (concept_id) REFERENCES concepts(id),
     FOREIGN KEY (subject_id) REFERENCES subjects(id)
   );`,
);

// Append-only recall log. Mastery reads THIS, not self-report, so it can't be
// faked by editing a file. interval_before is the gap the card survived —
// the proof of real long-term retention.
db.run(
	`CREATE TABLE IF NOT EXISTS reviews (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     card_id INTEGER NOT NULL,
     concept_id INTEGER NOT NULL,
     subject_id INTEGER NOT NULL,
     quality INTEGER NOT NULL,
     interval_before INTEGER NOT NULL,
     interval_after INTEGER NOT NULL,
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
// spread over real time, not a single lucky session.
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
     at TEXT DEFAULT CURRENT_DATE,
     FOREIGN KEY (subject_id) REFERENCES subjects(id),
     FOREIGN KEY (concept_id) REFERENCES concepts(id)
   );`,
);

db.close();
console.log(`learn-it database ready at ${DB_PATH}`);
