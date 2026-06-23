import type { Database } from "bun:sqlite";

// A home-assessment task issued by `assess`, tracked until `evaluate` grades it.
// The markdown file (subjects/<s>/assessments/<date>-<kind>.md) holds the task +
// the learner's answer; this table is the queryable INDEX so pending ones can
// surface on the dashboard and nag until they're graded. Lives here (not in the
// CLI module) so the queries stay unit-testable — learn-it.ts runs main() on
// import.

export interface AssessmentRow {
	id: number;
	subject_id: number;
	kind: string; // explain | apply | build
	path: string; // the issued .md file
	status: "pending" | "done";
	score: number | null; // null until evaluated
	created_at: string;
	completed_at: string | null;
}

// Record a freshly-issued assessment as pending.
export function recordAssessment(
	db: Database,
	subjectId: number,
	kind: string,
	filePath: string,
): void {
	db.run("INSERT INTO assessments (subject_id, kind, path) VALUES (?, ?, ?)", [
		subjectId,
		kind,
		filePath,
	]);
}

// Close a pending assessment when `evaluate` grades it — matched by its file
// path (the explicit, unambiguous link; an `evaluate` with no file just logs
// evidence and leaves the tracker alone, e.g. a feynman/exam grade). Returns the
// row that was completed, or undefined if no pending row matched.
export function completeAssessment(
	db: Database,
	subjectId: number,
	score: number,
	at: string,
	filePath: string,
): AssessmentRow | undefined {
	const row = db
		.query(
			"SELECT * FROM assessments WHERE subject_id = ? AND path = ? AND status = 'pending' ORDER BY id LIMIT 1",
		)
		.get(subjectId, filePath) as AssessmentRow | undefined;
	if (!row) return undefined;
	db.run(
		"UPDATE assessments SET status = 'done', score = ?, completed_at = ? WHERE id = ?",
		[score, at, row.id],
	);
	return row;
}

// Pending assessments, oldest first (the oldest is the most overdue to grade).
// Scoped to one subject, or all subjects when subjectId is omitted.
export function pendingAssessments(
	db: Database,
	subjectId?: number,
): AssessmentRow[] {
	return (
		subjectId === undefined
			? db
					.query(
						"SELECT * FROM assessments WHERE status = 'pending' ORDER BY created_at, id",
					)
					.all()
			: db
					.query(
						"SELECT * FROM assessments WHERE status = 'pending' AND subject_id = ? ORDER BY created_at, id",
					)
					.all(subjectId)
	) as AssessmentRow[];
}

// Every assessment for a subject, newest first (for the `assessments` command).
export function assessmentsForSubject(
	db: Database,
	subjectId: number,
): AssessmentRow[] {
	return db
		.query("SELECT * FROM assessments WHERE subject_id = ? ORDER BY id DESC")
		.all(subjectId) as AssessmentRow[];
}
