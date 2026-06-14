import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(".", "data");
const DB_PATH = path.join(DATA_DIR, "learn_it.db");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const db = new Database(DB_PATH);

// A topic walks the lifecycle (src/lifecycle.ts): phase tracks where it is.
db.run(
	`CREATE TABLE IF NOT EXISTS topics (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT UNIQUE NOT NULL,
     phase TEXT DEFAULT 'diagnose',
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
   );`,
);

// Spaced-repetition state lives per card (SM-2): interval, ease, repetitions.
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

// Small key/value store for session state, e.g. the active topic (resume).
db.run(
	`CREATE TABLE IF NOT EXISTS app_state (
     key TEXT PRIMARY KEY,
     value TEXT
   );`,
);

db.close();
console.log(`learn-it database ready at ${DB_PATH}`);
