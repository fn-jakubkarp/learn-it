import { Database } from "bun:sqlite";

// Minimal in-memory schema mirroring src/init-db.ts — enough for the scheduler
// tests (flashcards + reviews, with a subject/concept to satisfy the columns the
// queries read). Kept here so tests never touch the real data/learn_it.db.
export function makeDb(): {
	db: Database;
	subjectId: number;
	conceptId: number;
} {
	const db = new Database(":memory:");
	db.run("PRAGMA foreign_keys = ON");
	db.run(
		`CREATE TABLE subjects (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name TEXT UNIQUE NOT NULL,
       target_tier TEXT, mastered_at TEXT,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
     );`,
	);
	db.run(
		`CREATE TABLE concepts (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       subject_id INTEGER NOT NULL, name TEXT NOT NULL,
       status TEXT, stability REAL DEFAULT 0, difficulty REAL DEFAULT 0,
       interval INTEGER DEFAULT 0, reps INTEGER DEFAULT 0,
       last_exposed TEXT, next_exposure TEXT,
       UNIQUE (subject_id, name),
       FOREIGN KEY (subject_id) REFERENCES subjects(id)
     );`,
	);
	db.run(
		`CREATE TABLE exposures (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       concept_id INTEGER NOT NULL, subject_id INTEGER NOT NULL,
       surface TEXT NOT NULL, quality INTEGER NOT NULL,
       interval_before INTEGER NOT NULL, interval_after INTEGER NOT NULL,
       grader TEXT DEFAULT 'unpinned', at TEXT DEFAULT CURRENT_DATE,
       FOREIGN KEY (concept_id) REFERENCES concepts(id),
       FOREIGN KEY (subject_id) REFERENCES subjects(id)
     );`,
	);
	db.run(
		`CREATE TABLE flashcards (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       concept_id INTEGER NOT NULL, subject_id INTEGER NOT NULL,
       question TEXT NOT NULL, answer TEXT NOT NULL,
       next_review TEXT DEFAULT CURRENT_DATE,
       interval INTEGER DEFAULT 0, stability REAL DEFAULT 0,
       difficulty REAL DEFAULT 0, repetitions INTEGER DEFAULT 0,
       last_reviewed TEXT, suspended INTEGER DEFAULT 0,
       FOREIGN KEY (concept_id) REFERENCES concepts(id),
       FOREIGN KEY (subject_id) REFERENCES subjects(id)
     );`,
	);
	db.run(
		`CREATE TABLE reviews (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       card_id INTEGER NOT NULL, concept_id INTEGER NOT NULL,
       subject_id INTEGER NOT NULL, quality INTEGER NOT NULL,
       interval_before INTEGER NOT NULL, interval_after INTEGER NOT NULL,
       grader TEXT DEFAULT 'unpinned', graded_at TEXT DEFAULT CURRENT_DATE,
       FOREIGN KEY (card_id) REFERENCES flashcards(id),
       FOREIGN KEY (subject_id) REFERENCES subjects(id)
     );`,
	);
	db.run(
		`CREATE TABLE evidence (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       subject_id INTEGER NOT NULL, concept_id INTEGER,
       kind TEXT NOT NULL, bloom INTEGER NOT NULL,
       score INTEGER NOT NULL, passed INTEGER NOT NULL,
       source_file TEXT, grader TEXT DEFAULT 'unpinned',
       at TEXT DEFAULT CURRENT_DATE,
       FOREIGN KEY (subject_id) REFERENCES subjects(id),
       FOREIGN KEY (concept_id) REFERENCES concepts(id)
     );`,
	);
	db.run("INSERT INTO subjects (name) VALUES ('t')");
	const subjectId = 1;
	db.run("INSERT INTO concepts (subject_id, name) VALUES (?, 'c')", [
		subjectId,
	]);
	const conceptId = 1;
	return { db, subjectId, conceptId };
}

export function addCard(
	db: Database,
	conceptId: number,
	subjectId: number,
	question = "q",
	answer = "a",
	nextReview = "2026-06-15",
): number {
	db.run(
		"INSERT INTO flashcards (concept_id, subject_id, question, answer, next_review, interval) VALUES (?, ?, ?, ?, ?, 0)",
		[conceptId, subjectId, question, answer, nextReview],
	);
	return (db.query("SELECT last_insert_rowid() AS id").get() as { id: number })
		.id;
}
