import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(".", "data");
const DB_PATH = path.join(DATA_DIR, "learn_it.db");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const db = new Database(DB_PATH);

// Topics are independent and concurrent — a learner runs several at once, each
// at its own pace. A topic's phase is NOT stored: it is inferred from real
// state (see src/lifecycle.ts). The only persisted progress flag is when an
// exam was passed.
db.run(
	`CREATE TABLE IF NOT EXISTS topics (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT UNIQUE NOT NULL,
     mastered_at TEXT,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
   );`,
);

// Spaced-repetition state lives per card (SM-2): interval, ease, repetitions.
// The due queue interleaves cards across ALL topics, which is how review works.
db.run(
	`CREATE TABLE IF NOT EXISTS flashcards (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     topic_id INTEGER NOT NULL,
     question TEXT NOT NULL,
     answer TEXT NOT NULL,
     next_review TEXT DEFAULT CURRENT_DATE,
     interval INTEGER DEFAULT 0,
     ease_factor REAL DEFAULT 2.5,
     repetitions INTEGER DEFAULT 0,
     FOREIGN KEY (topic_id) REFERENCES topics(id)
   );`,
);

// Append-only performance log. Mastery is computed from THIS, not self-report,
// so it cannot be faked by editing a markdown file. Every graded recall records
// the interval it survived — proof of real long-term retention, not cramming.
db.run(
	`CREATE TABLE IF NOT EXISTS reviews (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     card_id INTEGER NOT NULL,
     topic_id INTEGER NOT NULL,
     quality INTEGER NOT NULL,
     interval_before INTEGER NOT NULL,
     interval_after INTEGER NOT NULL,
     graded_at TEXT DEFAULT CURRENT_DATE,
     FOREIGN KEY (card_id) REFERENCES flashcards(id),
     FOREIGN KEY (topic_id) REFERENCES topics(id)
   );`,
);

// Depth checks: exam (apply/analyze) and Feynman (teach-back). Score 0-100.
db.run(
	`CREATE TABLE IF NOT EXISTS verifications (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     topic_id INTEGER NOT NULL,
     kind TEXT NOT NULL,
     score INTEGER NOT NULL,
     passed INTEGER NOT NULL,
     at TEXT DEFAULT CURRENT_DATE,
     FOREIGN KEY (topic_id) REFERENCES topics(id)
   );`,
);

db.close();
console.log(`learn-it database ready at ${DB_PATH}`);
