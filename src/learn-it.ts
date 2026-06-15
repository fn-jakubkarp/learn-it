import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";
import {
	type DueConcept,
	dueConcepts,
	isSurface,
	recordExposure,
	SURFACES,
	type Surface,
	statusFromScore,
} from "./exposure";
import {
	advise,
	inferPhase,
	PHASE_SUGGESTION,
	type Phase,
	type TopicSignals,
} from "./lifecycle";
import {
	assessMastery,
	DREYFUS,
	EVIDENCE_BLOOM,
	type EvidenceKind,
	LONG_RETENTION_DAYS,
	MATURE_INTERVAL_DAYS,
	type MasterySignals,
	PASS,
	RETENTION_DAYS,
	SUSTAINED_MIN_DAYS,
	SUSTAINED_MIN_SPAN_DAYS,
	tierIndexOf,
} from "./mastery";
import {
	type CardRow,
	getDueCards,
	gradeCard,
	replayCard,
	today,
} from "./scheduler";

// Resolve the DB relative to THIS file, not the caller's cwd — otherwise running
// from another directory silently CREATEs a fresh empty db there and abandons all
// logged performance (the single source of truth for un-gameable mastery).
const DB_PATH = path.join(import.meta.dir, "..", "data", "learn_it.db");
if (!fs.existsSync(DB_PATH)) {
	console.log("Database not initialized. Run:  bun src/init-db.ts");
	process.exit(1);
}
const db = new Database(DB_PATH);
// Match init-db: enforce FKs, use WAL, tolerate rapid back-to-back invocations.
db.run("PRAGMA foreign_keys = ON");
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA busy_timeout = 5000");

const [command, ...args] = process.argv.slice(2);

interface SubjectRow {
	id: number;
	name: string;
	target_tier: string | null;
	mastered_at: string | null;
	created_at: string;
}
interface ConceptRow {
	id: number;
	subject_id: number;
	name: string;
}

const auditTemplate = (name: string) =>
	`# Audit: ${name}\n\n## Knowledge Gaps\n- [ ] ...\n`;

// The model that produced a score, recorded on every grade so harsh-mastery is
// reproducible and auditable. Set once per session (e.g.
// LEARN_IT_GRADER=claude-opus-4-8); when unset it logs 'unpinned' rather than
// NULL, so a score with no provenance shows up in an audit instead of hiding.
const grader = (): string => process.env.LEARN_IT_GRADER?.trim() || "unpinned";

// Map a 0-100 assessment/probe score onto the 0-5 recall scale the exposure clock
// uses, so a graded retrieval advances spacing like a card grade.
const scoreToQuality = (s: number): number =>
	s >= 85 ? 5 : s >= 70 ? 4 : s >= 40 ? 3 : 1;

// Which assessment kind fits a phase, when the caller doesn't name one.
const PHASE_KIND: Record<Phase, EvidenceKind> = {
	diagnose: "explain",
	conceptualize: "explain",
	recall: "apply",
	space: "apply",
	verify: "apply",
	mastered: "apply",
};

// ---- helpers ----------------------------------------------------------------

function getSubject(name: string): SubjectRow | undefined {
	return db.query("SELECT * FROM subjects WHERE name = ?").get(name) as
		| SubjectRow
		| undefined;
}

function getConcept(subjectId: number, name: string): ConceptRow | undefined {
	return db
		.query("SELECT * FROM concepts WHERE subject_id = ? AND name = ?")
		.get(subjectId, name) as ConceptRow | undefined;
}

function allSubjects(): SubjectRow[] {
	return db
		.query("SELECT * FROM subjects ORDER BY created_at")
		.all() as SubjectRow[];
}

function subjectDir(name: string): string {
	return path.join(".", "subjects", name);
}

function dueCount(subjectName?: string): number {
	return getDueCards(db, subjectName).length;
}

// Subject-level state for phase inference (phase is never stored).
function readSignals(subject: SubjectRow): TopicSignals {
	const dir = subjectDir(subject.name);
	const auditPath = path.join(dir, "audit.md");
	let auditFilled = false;
	if (fs.existsSync(auditPath)) {
		const content = fs.readFileSync(auditPath, "utf8").trim();
		auditFilled =
			content.length > 0 && content !== auditTemplate(subject.name).trim();
	}

	const concepts = (
		db
			.query("SELECT COUNT(*) AS c FROM concepts WHERE subject_id = ?")
			.get(subject.id) as { c: number }
	).c;

	const stats = db
		.query(
			`SELECT COUNT(*) AS c,
              SUM(CASE WHEN repetitions >= 1 THEN 1 ELSE 0 END) AS r,
              SUM(CASE WHEN interval >= ${MATURE_INTERVAL_DAYS} THEN 1 ELSE 0 END) AS m
       FROM flashcards WHERE subject_id = ?`,
		)
		.get(subject.id) as { c: number; r: number | null; m: number | null };

	const applied = (
		db
			.query(
				"SELECT COUNT(*) AS c FROM evidence WHERE subject_id = ? AND passed = 1 AND kind IN ('apply','build')",
			)
			.get(subject.id) as { c: number }
	).c;

	return {
		auditFilled,
		hasRoadmap: fs.existsSync(path.join(dir, "roadmap.md")) || concepts > 0,
		cardCount: stats.c ?? 0,
		reviewedCount: stats.r ?? 0,
		maturedCount: stats.m ?? 0,
		hasAppliedEvidence: applied > 0,
		// Derive "mastered" from the LIVE tier, not the sticky mastered_at flag, so
		// expanding the roadmap after mastering re-opens the subject instead of
		// pinning phase to "mastered" forever. mastered_at remains a record of when
		// expert was first reached (see stampMasteredIfExpert), not a phase latch.
		mastered: assessMastery(masterySignals(subject)).tier === "expert",
	};
}

function phaseOf(subject: SubjectRow): Phase {
	return inferPhase(readSignals(subject));
}

// Mastery rolls up over a subject's concepts + evidence. All from logged
// performance — never self-reported. A concept is "covered" if touched by a
// card or a concept-level probe; "proven" if retained (cards) OR backed by
// passing evidence — so doing counts, not just flashcards.
function masterySignals(subject: SubjectRow): MasterySignals {
	const sid = subject.id;
	const concepts = (
		db
			.query("SELECT COUNT(*) AS c FROM concepts WHERE subject_id = ?")
			.get(sid) as { c: number }
	).c;

	// "Covered" = engaged, not merely populated: a card counts only once it has
	// been reviewed at least once (repetitions >= 1), OR the concept has passing
	// evidence. A bare unreviewed card is not coverage — that keeps volume from
	// nudging the coverage gates (CLAUDE.md: "Volume never lifts a tier").
	const covered = (
		db
			.query(
				`SELECT COUNT(*) AS c FROM (
           SELECT concept_id FROM flashcards WHERE subject_id = ? AND repetitions >= 1
           UNION
           SELECT concept_id FROM exposures WHERE subject_id = ?
           UNION
           SELECT concept_id FROM evidence
             WHERE subject_id = ? AND concept_id IS NOT NULL AND passed = 1
         )`,
			)
			.get(sid, sid, sid) as { c: number }
	).c;

	// A concept is proven by retention across a real gap — through cards OR
	// through retrieval exposures (re-explain / quiz), counted symmetrically — OR
	// by passing concept-level evidence. `read` is recognition and is excluded.
	const proven = (
		db
			.query(
				`SELECT COUNT(*) AS c FROM (
           SELECT concept_id FROM reviews
             WHERE subject_id = ? AND quality >= 3 AND interval_before >= ?
           UNION
           SELECT concept_id FROM exposures
             WHERE subject_id = ? AND surface IN ('explain','quiz','card')
               AND quality >= 3 AND interval_before >= ?
           UNION
           SELECT concept_id FROM evidence
             WHERE subject_id = ? AND concept_id IS NOT NULL AND passed = 1
         )`,
			)
			.get(sid, RETENTION_DAYS, sid, RETENTION_DAYS, sid) as { c: number }
	).c;

	const longRet = (
		db
			.query(
				`SELECT COUNT(*) AS c FROM (
           SELECT concept_id FROM reviews
             WHERE subject_id = ? AND quality >= 3 AND interval_before >= ?
           UNION
           SELECT concept_id FROM exposures
             WHERE subject_id = ? AND surface IN ('explain','quiz','card')
               AND quality >= 3 AND interval_before >= ?
         )`,
			)
			.get(sid, LONG_RETENTION_DAYS, sid, LONG_RETENTION_DAYS) as { c: number }
	).c;

	const apply = db
		.query(
			"SELECT MAX(score) AS best, MAX(passed) AS passed FROM evidence WHERE subject_id = ? AND kind = 'apply'",
		)
		.get(sid) as { best: number | null; passed: number | null };

	const passedOf = (kind: EvidenceKind) =>
		((
			db
				.query(
					"SELECT MAX(passed) AS p FROM evidence WHERE subject_id = ? AND kind = ?",
				)
				.get(sid, kind) as { p: number | null }
		).p ?? 0) === 1;

	// Durability-over-time: passing apply/build on N distinct days, spanning M+.
	const span = db
		.query(
			"SELECT COUNT(DISTINCT at) AS days, MIN(at) AS first, MAX(at) AS last FROM evidence WHERE subject_id = ? AND passed = 1 AND kind IN ('apply','build')",
		)
		.get(sid) as { days: number; first: string | null; last: string | null };
	const spanDays =
		span.first && span.last
			? (Date.parse(span.last) - Date.parse(span.first)) / 86_400_000
			: 0;
	const sustainedEvidence =
		span.days >= SUSTAINED_MIN_DAYS && spanDays >= SUSTAINED_MIN_SPAN_DAYS;

	return {
		concepts,
		coveredConcepts: covered,
		provenConcepts: proven,
		longRetainedConcepts: longRet,
		bestApply: apply.best ?? 0,
		applyPassed: (apply.passed ?? 0) === 1,
		explainPassed: passedOf("explain"),
		buildPassed: passedOf("build"),
		sustainedEvidence,
	};
}

function tierLabel(subject: SubjectRow): string {
	const m = assessMastery(masterySignals(subject));
	return m.tier === "expert" ? "expert ★" : `${m.tier} ${m.withinTier}%`;
}

// ---- commands ---------------------------------------------------------------

function initSubject(name?: string) {
	if (!name) return console.log('Usage: init "<subject>"');
	const dir = subjectDir(name);
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
	const auditPath = path.join(dir, "audit.md");
	if (!fs.existsSync(auditPath))
		fs.writeFileSync(auditPath, auditTemplate(name));
	try {
		db.run("INSERT INTO subjects (name) VALUES (?)", [name]);
		console.log(
			`Initialized subject: ${name}. Fill ${auditPath}, then: explore-topic`,
		);
	} catch {
		console.log(`Subject ${name} already exists.`);
	}
}

// Register a roadmap leaf. `plan` calls this per concept it generates; coverage
// and mastery are measured against this list.
function addConcept(subjectName?: string, conceptName?: string) {
	if (!subjectName || !conceptName)
		return console.log('Usage: addconcept "<subject>" "<concept>"');
	const subject = getSubject(subjectName);
	if (!subject) return console.log(`No subject: ${subjectName}`);
	try {
		db.run("INSERT INTO concepts (subject_id, name) VALUES (?, ?)", [
			subject.id,
			conceptName,
		]);
		console.log(`Concept added to ${subjectName}: ${conceptName}`);
	} catch {
		console.log(`Concept "${conceptName}" already exists in ${subjectName}.`);
	}
}

function listConcepts(subjectName?: string) {
	if (!subjectName) return console.log('Usage: concepts "<subject>"');
	const subject = getSubject(subjectName);
	if (!subject) return console.log(`No subject: ${subjectName}`);
	const rows = db
		.query("SELECT * FROM concepts WHERE subject_id = ? ORDER BY id")
		.all(subject.id) as ConceptRow[];
	if (!rows.length) return console.log("No concepts yet — run plan.");
	console.log(`Concepts in ${subjectName} (${rows.length}):`);
	for (const c of rows) console.log(`  - ${c.name}`);
}

function checkStage(stage?: string, name?: string) {
	if (!stage || !name) return console.log('Usage: advise <stage> "<subject>"');
	const subject = getSubject(name);
	if (!subject)
		return console.log(`NOTE: no subject "${name}" — run: init "${name}"`);
	const advice = advise(stage, phaseOf(subject), readSignals(subject));
	if (advice.recommended)
		console.log(
			`OK (phase: ${phaseOf(subject)})${advice.note ? ` — TIP: ${advice.note}` : ""}`,
		);
	else console.log(`NOTE: ${advice.note}`);
}

function addCard(
	subjectName?: string,
	conceptName?: string,
	question?: string,
	answer?: string,
) {
	if (!subjectName || !conceptName || !question || !answer)
		return console.log('Usage: addcard "<subject>" "<concept>" "<q>" "<a>"');
	const subject = getSubject(subjectName);
	if (!subject) return console.log(`No subject: ${subjectName}`);
	const concept = getConcept(subject.id, conceptName);
	if (!concept)
		return console.log(
			`No concept "${conceptName}" in ${subjectName} — add it first: addconcept`,
		);
	db.run(
		"INSERT INTO flashcards (concept_id, subject_id, question, answer, next_review, interval) VALUES (?, ?, ?, ?, ?, 0)",
		[concept.id, subject.id, question, answer, today()],
	);
	console.log(`Card added to ${subjectName} / ${conceptName}.`);
}

function listDue(name?: string) {
	const cards = getDueCards(db, name);
	if (!cards.length)
		return console.log(`No cards due${name ? ` for ${name}` : ""}.`);
	console.log(`Due cards (${cards.length}):`);
	for (const c of cards) console.log(`[${c.id}] ${c.question}`);
}

function grade(cardId?: string, quality?: string) {
	const q = Number(quality);
	if (!cardId || Number.isNaN(q) || q < 0 || q > 5)
		return console.log("Usage: grade <cardId> <quality 0-5>");
	const id = Number(cardId);
	const card = db.query("SELECT * FROM flashcards WHERE id = ?").get(id) as
		| CardRow
		| undefined;
	if (!card)
		return console.log(`No card with id ${id} — run \`due\` to see valid ids.`);
	// Soft due-check: an early review barely moves retention (elapsed≈0 ⇒ the
	// interval won't grow). Surface it, never block — the learner decides.
	if (card.next_review > today())
		console.log(
			`NOTE: card ${id} isn't due until ${card.next_review}; an early review barely moves retention.`,
		);
	const updated = gradeCard(db, id, q, grader());
	// A card review is one exposure surface — advance the concept's clock too, so
	// reinforcing via cards and via talk feed the same concept-level schedule.
	recordExposure(db, card.concept_id, "card", q, grader());
	console.log(
		`Card ${updated.id} -> next review ${updated.next_review} (interval ${updated.interval}d)`,
	);
}

// ---- card & concept management ----------------------------------------------

function showCard(cardId?: string) {
	if (!cardId) return console.log("Usage: show <cardId>");
	const card = db
		.query("SELECT * FROM flashcards WHERE id = ?")
		.get(Number(cardId)) as CardRow | undefined;
	if (!card) return console.log(`No card with id ${cardId}.`);
	console.log(`Card ${card.id}${card.suspended ? "  (suspended)" : ""}`);
	console.log(`  Q: ${card.question}`);
	console.log(`  A: ${card.answer}`);
	console.log(
		`  interval ${card.interval}d | stability ${card.stability.toFixed(2)} | difficulty ${card.difficulty.toFixed(2)} | reps ${card.repetitions} | next ${card.next_review}${card.last_reviewed ? ` | last ${card.last_reviewed}` : " | never reviewed"}`,
	);
}

// Fix a typo without touching scheduling — editing the text shouldn't reset the
// memory state a learner has built on the card.
function editCard(cardId?: string, question?: string, answer?: string) {
	if (!cardId || !question || !answer)
		return console.log('Usage: editcard <cardId> "<question>" "<answer>"');
	const id = Number(cardId);
	if (!db.query("SELECT id FROM flashcards WHERE id = ?").get(id))
		return console.log(`No card with id ${id}.`);
	db.run("UPDATE flashcards SET question = ?, answer = ? WHERE id = ?", [
		question,
		answer,
		id,
	]);
	console.log(`Card ${id} updated (scheduling unchanged).`);
}

// Hard-delete a card and its recall history together (FK enforcement requires the
// child reviews to go first). Deleting your own card isn't gaming — you can't
// inflate a score by removing evidence — so this is allowed outright.
function delCard(cardId?: string) {
	if (!cardId) return console.log("Usage: delcard <cardId>");
	const id = Number(cardId);
	if (!db.query("SELECT id FROM flashcards WHERE id = ?").get(id))
		return console.log(`No card with id ${id}.`);
	db.transaction(() => {
		db.run("DELETE FROM reviews WHERE card_id = ?", [id]);
		db.run("DELETE FROM flashcards WHERE id = ?", [id]);
	})();
	console.log(`Card ${id} deleted (with its recall history).`);
}

// Remove a roadmap leaf — but only when empty. Refuse to silently cascade-delete
// logged cards/evidence; the learner should delcard those first, deliberately.
function delConcept(subjectName?: string, conceptName?: string) {
	if (!subjectName || !conceptName)
		return console.log('Usage: delconcept "<subject>" "<concept>"');
	const subject = getSubject(subjectName);
	if (!subject) return console.log(`No subject: ${subjectName}`);
	const concept = getConcept(subject.id, conceptName);
	if (!concept)
		return console.log(`No concept "${conceptName}" in ${subjectName}.`);
	const cards = (
		db
			.query("SELECT COUNT(*) AS c FROM flashcards WHERE concept_id = ?")
			.get(concept.id) as { c: number }
	).c;
	const ev = (
		db
			.query("SELECT COUNT(*) AS c FROM evidence WHERE concept_id = ?")
			.get(concept.id) as { c: number }
	).c;
	if (cards > 0 || ev > 0)
		return console.log(
			`"${conceptName}" still has ${cards} card(s) and ${ev} evidence row(s) — remove those first (delcard). Refusing to cascade-delete logged history.`,
		);
	db.run("DELETE FROM concepts WHERE id = ?", [concept.id]);
	console.log(`Concept "${conceptName}" removed from ${subjectName}.`);
}

// Undo the most recent grade on a card: drop the last reviews row and replay the
// rest to restore the exact prior FSRS state. The only mutable state in the
// engine; the recall log stays otherwise append-only.
function ungrade(cardId?: string) {
	if (!cardId) return console.log("Usage: ungrade <cardId>");
	const id = Number(cardId);
	const last = db
		.query(
			"SELECT id, quality, graded_at FROM reviews WHERE card_id = ? ORDER BY id DESC LIMIT 1",
		)
		.get(id) as { id: number; quality: number; graded_at: string } | undefined;
	if (!last) return console.log(`No reviews to undo for card ${id}.`);
	db.transaction(() => {
		db.run("DELETE FROM reviews WHERE id = ?", [last.id]);
		replayCard(db, id);
	})();
	const card = db
		.query("SELECT * FROM flashcards WHERE id = ?")
		.get(id) as CardRow;
	console.log(
		`Undid grade ${last.quality} (${last.graded_at}) on card ${id}. Now: interval ${card.interval}d, next ${card.next_review}.`,
	);
}

// Take a card out of (or back into) the due queue without deleting it — for
// leeches or a card the learner wants to pause.
function suspendCard(cardId?: string, stateArg?: string) {
	if (!cardId) return console.log("Usage: suspend <cardId> [on|off]");
	const id = Number(cardId);
	if (!db.query("SELECT id FROM flashcards WHERE id = ?").get(id))
		return console.log(`No card with id ${id}.`);
	const on = stateArg !== "off";
	db.run("UPDATE flashcards SET suspended = ? WHERE id = ?", [on ? 1 : 0, id]);
	console.log(
		`Card ${id} ${on ? "suspended (out of the due queue)" : "unsuspended (back in rotation)"}.`,
	);
}

// ---- exposure (concept-level spaced reinforcement) --------------------------

// Record a reinforcement touch on a concept through a surface. explain/quiz are
// graded retrieval (quality 0-5); read is recognition (capped, quality optional);
// card exposures are recorded automatically by `grade`.
function expose(
	subjectName?: string,
	conceptName?: string,
	surfaceArg?: string,
	qualityArg?: string,
) {
	const surfaces = Object.keys(SURFACES).join("|");
	if (!subjectName || !conceptName || !surfaceArg || !isSurface(surfaceArg))
		return console.log(
			`Usage: expose "<subject>" "<concept>" <${surfaces}> [quality 0-5]`,
		);
	const subject = getSubject(subjectName);
	if (!subject) return console.log(`No subject: ${subjectName}`);
	const concept = getConcept(subject.id, conceptName);
	if (!concept)
		return console.log(
			`No concept "${conceptName}" in ${subjectName} — add it first: addconcept`,
		);
	const surface = surfaceArg as Surface;
	let q = Number(qualityArg);
	if (SURFACES[surface].strong && (Number.isNaN(q) || q < 0 || q > 5))
		return console.log(
			`${surface} is graded retrieval — Usage: expose "${subjectName}" "${conceptName}" ${surface} <quality 0-5>`,
		);
	if (!SURFACES[surface].strong && Number.isNaN(q)) q = 2; // read: recognition
	const r = recordExposure(db, concept.id, surface, q, grader());
	console.log(
		`exposure recorded: ${subjectName} / ${conceptName} via ${surface}. Next exposure ${r.nextExposure} (in ${r.interval}d).`,
	);
}

// The reinforcement queue: concepts due to be hit again through ANY surface. The
// primary "what should I do now" view — cards are just one way to clear it.
function listDueConcepts(subjectName?: string) {
	if (subjectName && !getSubject(subjectName))
		return console.log(`No subject: ${subjectName}`);
	const due: DueConcept[] = dueConcepts(db, subjectName);
	if (!due.length)
		return console.log(
			`No concepts due for reinforcement${subjectName ? ` in ${subjectName}` : ""}.`,
		);
	console.log(`Concepts due for reinforcement (${due.length}):`);
	for (const d of due)
		console.log(
			`  [${d.status ?? "new"}] ${d.name}  (${d.overdue}d overdue)  -> explain / quiz / read / cards`,
		);
}

// Manual placement override (probe sets this automatically from a score).
function setStatus(
	subjectName?: string,
	conceptName?: string,
	statusArg?: string,
) {
	const valid = ["blank", "shaky", "known"];
	if (!subjectName || !conceptName || !statusArg || !valid.includes(statusArg))
		return console.log(
			`Usage: mark "<subject>" "<concept>" <${valid.join("|")}>`,
		);
	const subject = getSubject(subjectName);
	if (!subject) return console.log(`No subject: ${subjectName}`);
	const concept = getConcept(subject.id, conceptName);
	if (!concept)
		return console.log(`No concept "${conceptName}" in ${subjectName}.`);
	db.run("UPDATE concepts SET status = ? WHERE id = ?", [
		statusArg,
		concept.id,
	]);
	console.log(`${subjectName} / ${conceptName} marked ${statusArg}.`);
}

// ---- session notes (the conversational stream) ------------------------------

// Capture a short, LLM-authored note at the END of a working session — what was
// covered, where the learner struggled, what to revisit. resume() surfaces the
// latest one per subject so the next session (talking, not just cards) resumes
// with context. Flashcards are one stream; this is the dialogue stream.
function addNote(subjectName?: string, summary?: string) {
	if (!subjectName || !summary)
		return console.log('Usage: note "<subject>" "<session summary>"');
	const subject = getSubject(subjectName);
	if (!subject) return console.log(`No subject: ${subjectName}`);
	db.run(
		"INSERT INTO sessions (subject_id, summary, grader) VALUES (?, ?, ?)",
		[subject.id, summary, grader()],
	);
	console.log(`Session note saved for ${subjectName}.`);
}

function listSessions(subjectName?: string) {
	if (!subjectName) return console.log('Usage: sessions "<subject>"');
	const subject = getSubject(subjectName);
	if (!subject) return console.log(`No subject: ${subjectName}`);
	const rows = db
		.query(
			"SELECT at, summary, grader FROM sessions WHERE subject_id = ? ORDER BY id DESC",
		)
		.all(subject.id) as { at: string; summary: string; grader: string }[];
	if (!rows.length)
		return console.log(`No session notes yet for ${subjectName}.`);
	console.log(`Session notes for ${subjectName} (newest first):`);
	for (const r of rows) console.log(`  [${r.at}] ${r.summary}  (${r.grader})`);
}

function latestSession(subjectId: number): string | null {
	const row = db
		.query(
			"SELECT summary FROM sessions WHERE subject_id = ? ORDER BY id DESC LIMIT 1",
		)
		.get(subjectId) as { summary: string } | undefined;
	return row?.summary ?? null;
}

// ---- dashboard wiring & health ----------------------------------------------

// Emit the full learner state as JSON — the read surface a dashboard (or any
// external view) consumes. Read-only; the engine still owns the DB.
function exportJson(subjectName?: string) {
	const subjects = subjectName
		? ([getSubject(subjectName)].filter(Boolean) as SubjectRow[])
		: allSubjects();
	if (subjectName && !subjects.length)
		return console.log(`No subject: ${subjectName}`);
	const out = subjects.map((s) => {
		const m = assessMastery(masterySignals(s));
		return {
			name: s.name,
			tier: m.tier,
			tierIndex: m.tierIndex,
			withinTier: m.withinTier,
			target: s.target_tier,
			phase: phaseOf(s),
			masteredAt: s.mastered_at,
			blocking: m.blocking,
			dueCount: dueCount(s.name),
			conceptsDue: dueConcepts(db, s.name),
			concepts: db
				.query(
					"SELECT id, name, status, interval, last_exposed, next_exposure FROM concepts WHERE subject_id = ? ORDER BY id",
				)
				.all(s.id),
			cards: db
				.query(
					"SELECT id, concept_id, question, answer, interval, stability, difficulty, repetitions, next_review, last_reviewed, suspended FROM flashcards WHERE subject_id = ? ORDER BY id",
				)
				.all(s.id),
			evidence: db
				.query(
					"SELECT concept_id, kind, bloom, score, passed, at, grader FROM evidence WHERE subject_id = ? ORDER BY id",
				)
				.all(s.id),
			sessions: db
				.query(
					"SELECT summary, at, grader FROM sessions WHERE subject_id = ? ORDER BY id DESC",
				)
				.all(s.id),
		};
	});
	console.log(JSON.stringify({ generated: today(), subjects: out }, null, 2));
}

function doctor() {
	const count = (sql: string, ...p: unknown[]) =>
		(db.query(sql).get(...(p as never[])) as { c: number }).c;
	console.log("--- learn-it doctor ---");
	console.log(`DB: ${DB_PATH}`);
	const tables = (
		db.query("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
			name: string;
		}[]
	).map((t) => t.name);
	for (const t of [
		"subjects",
		"concepts",
		"flashcards",
		"reviews",
		"evidence",
		"sessions",
	])
		console.log(
			`  table ${t}: ${tables.includes(t) ? "ok" : "MISSING — run bun src/init-db.ts"}`,
		);
	const fk = (db.query("PRAGMA foreign_keys").get() as { foreign_keys: number })
		.foreign_keys;
	console.log(`  foreign_keys: ${fk ? "on" : "OFF"}`);
	console.log(
		`  grader env: ${process.env.LEARN_IT_GRADER?.trim() || "unset (scores log as 'unpinned')"}`,
	);
	console.log(
		`  counts: subjects ${count("SELECT COUNT(*) AS c FROM subjects")}, concepts ${count("SELECT COUNT(*) AS c FROM concepts")}, cards ${count("SELECT COUNT(*) AS c FROM flashcards")}, reviews ${count("SELECT COUNT(*) AS c FROM reviews")}, evidence ${count("SELECT COUNT(*) AS c FROM evidence")}`,
	);
	const unpinned = count(
		"SELECT COUNT(*) AS c FROM evidence WHERE grader IS NULL OR grader = 'unpinned'",
	);
	if (unpinned)
		console.log(`  ⚠ ${unpinned} evidence score(s) have no recorded grader.`);
	const orphan = count(
		"SELECT COUNT(*) AS c FROM flashcards f LEFT JOIN concepts c ON f.concept_id = c.id WHERE c.id IS NULL",
	);
	if (orphan) console.log(`  ⚠ ${orphan} card(s) reference a missing concept.`);
	const suspended = count(
		"SELECT COUNT(*) AS c FROM flashcards WHERE COALESCE(suspended, 0) = 1",
	);
	if (suspended) console.log(`  ${suspended} card(s) suspended.`);
	console.log("done.");
}

// Issue a home assessment: copy the right template into the subject's
// assessments folder, fill the slots, and hand the agent the focus inputs. The
// structure is fixed by the template; only the question content is the agent's.
function assess(subjectName?: string, kindArg?: string) {
	if (!subjectName)
		return console.log('Usage: assess "<subject>" [explain|apply|build]');
	const subject = getSubject(subjectName);
	if (!subject) return console.log(`No subject: ${subjectName}`);

	const phase = phaseOf(subject);
	const kind = (
		kindArg && kindArg in EVIDENCE_BLOOM ? kindArg : PHASE_KIND[phase]
	) as EvidenceKind;

	const tmplPath = path.join(".", "templates", "assessment", `${kind}.md`);
	if (!fs.existsSync(tmplPath))
		return console.log(`Missing template: ${tmplPath}`);

	const m = assessMastery(masterySignals(subject));
	// Weakest first: highest FSRS difficulty (the cards fighting back hardest).
	const due = [...getDueCards(db, subjectName)].sort(
		(a, b) => b.difficulty - a.difficulty,
	);
	const weakest = due.slice(0, 5).map((c) => c.question);
	const focus = [
		weakest.length ? `Weakest cards: ${weakest.join("; ")}` : "",
		m.blocking.length ? `Next tier needs: ${m.blocking[0]}` : "",
	]
		.filter(Boolean)
		.join("\n");

	const filled = fs
		.readFileSync(tmplPath, "utf8")
		.replaceAll("{{subject}}", subjectName)
		.replaceAll("{{date}}", today())
		.replaceAll(
			"{{focus}}",
			focus || "(mentor: pick the highest-leverage gap)",
		);

	const dir = path.join(subjectDir(subjectName), "assessments");
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
	let out = path.join(dir, `${today()}-${kind}.md`);
	let n = 2;
	while (fs.existsSync(out))
		out = path.join(dir, `${today()}-${kind}-${n++}.md`);
	fs.writeFileSync(out, filled);

	console.log(`Assessment issued (${kind}, phase ${phase}): ${out}`);
	console.log("Fill in the Task, have the learner submit, then: evaluate");
	if (focus) console.log(`Focus:\n${focus}`);
}

// Grade a submitted assessment against its rubric and log the evidence. The
// agent does the scoring (per the rubric template); this records it.
function evaluate(
	subjectName?: string,
	kindArg?: string,
	scoreArg?: string,
	file?: string,
) {
	const score = Number(scoreArg);
	if (
		!subjectName ||
		!kindArg ||
		!(kindArg in EVIDENCE_BLOOM) ||
		Number.isNaN(score) ||
		score < 0 ||
		score > 100
	)
		return console.log(
			'Usage: evaluate "<subject>" <explain|apply|build> <score 0-100> [file]',
		);
	const subject = getSubject(subjectName);
	if (!subject) return console.log(`No subject: ${subjectName}`);

	const kind = kindArg as EvidenceKind;
	const passed = score >= PASS ? 1 : 0;
	db.run(
		"INSERT INTO evidence (subject_id, concept_id, kind, bloom, score, passed, source_file, grader) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)",
		[
			subject.id,
			kind,
			EVIDENCE_BLOOM[kind],
			score,
			passed,
			file ?? null,
			grader(),
		],
	);

	stampMasteredIfExpert(subject);
	console.log(
		`${kind} evidence recorded for ${subjectName}: ${score}/100 (${passed ? "pass" : "fail"}). Tier: ${tierLabel(getSubject(subjectName) as SubjectRow)}`,
	);
}

// Diagnostic probe (explore-gaps): the agent tests the learner on ONE concept
// and records concept-level evidence. This is how a placement diagnostic moves
// a newcomer to their real level — up to proficient (expert needs durability
// over time, which a single session can't provide).
function probe(
	subjectName?: string,
	conceptName?: string,
	kindArg?: string,
	scoreArg?: string,
) {
	const score = Number(scoreArg);
	if (
		!subjectName ||
		!conceptName ||
		(kindArg !== "explain" && kindArg !== "apply") ||
		Number.isNaN(score) ||
		score < 0 ||
		score > 100
	)
		return console.log(
			'Usage: probe "<subject>" "<concept>" <explain|apply> <score 0-100>',
		);
	const subject = getSubject(subjectName);
	if (!subject) return console.log(`No subject: ${subjectName}`);
	const concept = getConcept(subject.id, conceptName);
	if (!concept)
		return console.log(
			`No concept "${conceptName}" in ${subjectName} — add it first: addconcept`,
		);

	const kind = kindArg as EvidenceKind;
	const passed = score >= PASS ? 1 : 0;
	db.run(
		"INSERT INTO evidence (subject_id, concept_id, kind, bloom, score, passed, grader) VALUES (?, ?, ?, ?, ?, ?, ?)",
		[
			subject.id,
			concept.id,
			kind,
			EVIDENCE_BLOOM[kind],
			score,
			passed,
			grader(),
		],
	);
	// A probe places the concept (blank/shaky/known) AND is its first exposure —
	// seeding the concept's spaced-reinforcement clock from the diagnostic.
	db.run("UPDATE concepts SET status = ? WHERE id = ?", [
		statusFromScore(score),
		concept.id,
	]);
	recordExposure(
		db,
		concept.id,
		kind === "explain" ? "explain" : "quiz",
		scoreToQuality(score),
		grader(),
	);
	console.log(
		`probe recorded: ${subjectName} / ${conceptName} ${kind} ${score}/100 (${statusFromScore(score)}). Tier: ${tierLabel(getSubject(subjectName) as SubjectRow)}`,
	);
}

// Set the tier the learner is aiming for, so the watcher focuses on the gap
// between where they are and where they want to be (e.g. an upskiller).
function setTarget(subjectName?: string, tierArg?: string) {
	if (!subjectName || !tierArg || tierIndexOf(tierArg) < 0)
		return console.log(`Usage: target "<subject>" <${DREYFUS.join("|")}>`);
	const subject = getSubject(subjectName);
	if (!subject) return console.log(`No subject: ${subjectName}`);
	db.run("UPDATE subjects SET target_tier = ? WHERE id = ?", [
		tierArg,
		subject.id,
	]);
	console.log(`${subjectName} target set: ${tierArg}.`);
}

function stampMasteredIfExpert(subject: SubjectRow) {
	const after = assessMastery(masterySignals(subject));
	if (after.tier === "expert" && !subject.mastered_at)
		db.run("UPDATE subjects SET mastered_at = ? WHERE id = ?", [
			today(),
			subject.id,
		]);
}

function mastery(name?: string) {
	if (!name) return console.log('Usage: mastery "<subject>"');
	const subject = getSubject(name);
	if (!subject) return console.log(`No subject: ${name}`);
	const s = masterySignals(subject);
	const m = assessMastery(s);

	const target = subject.target_tier;
	const reachedTarget = target != null && m.tierIndex >= tierIndexOf(target);

	console.log(`\n--- mastery: ${name} ---`);
	console.log(
		m.tier === "expert"
			? "Tier: expert ★ (maxed — rare; respect)"
			: `Tier: ${m.tier}  (${m.withinTier}% toward ${nextTierName(m.tier)})`,
	);
	if (target)
		console.log(
			`Target: ${target}  ${reachedTarget ? "✓ reached — maintenance from here" : "(keep climbing)"}`,
		);
	console.log(
		`Concepts: ${s.coveredConcepts}/${s.concepts} covered | proven: ${s.provenConcepts} | retained ${LONG_RETENTION_DAYS}d+: ${s.longRetainedConcepts}`,
	);
	console.log(
		`Evidence: apply ${s.bestApply}/100${s.applyPassed ? " ✓" : ""} | explain ${s.explainPassed ? "✓" : "—"} | build ${s.buildPassed ? "✓" : "—"}`,
	);
	// Provenance audit: scores whose grader wasn't recorded are the soft spot in
	// "un-gameable" — surface them so they can be re-graded by a pinned model.
	const unpinned = (
		db
			.query(
				"SELECT COUNT(*) AS c FROM evidence WHERE subject_id = ? AND (grader IS NULL OR grader = 'unpinned')",
			)
			.get(subject.id) as { c: number }
	).c;
	if (unpinned > 0)
		console.log(
			`⚠ ${unpinned} evidence score(s) have no recorded grader — set LEARN_IT_GRADER so mastery stays auditable.`,
		);
	if (m.blocking.length) {
		console.log("To level up:");
		for (const b of m.blocking) console.log(`  - ${b}`);
	}
}

function nextTierName(tier: string): string {
	const order = [
		"novice",
		"advanced-beginner",
		"competent",
		"proficient",
		"expert",
	];
	return order[order.indexOf(tier) + 1] ?? "expert";
}

function resume() {
	const subjects = allSubjects();
	console.log("\n--- learn-it ---");
	console.log(
		`Concepts to reinforce: ${dueConcepts(db).length}  |  cards due: ${dueCount()}  (all subjects)`,
	);

	if (!subjects.length) {
		console.log('No subjects yet. Start one:  /learn-it init "<subject>"');
		return;
	}

	console.log("\nSubjects:");
	for (const s of subjects) {
		const phase = phaseOf(s);
		const cDue = dueConcepts(db, s.name).length;
		const cardsDue = dueCount(s.name);
		const next =
			phase === "mastered" ? "done" : `next: ${PHASE_SUGGESTION[phase]}`;
		const load = [
			cDue > 0 ? `${cDue} concept${cDue > 1 ? "s" : ""} to reinforce` : "",
			cardsDue > 0 ? `${cardsDue} cards due` : "",
		]
			.filter(Boolean)
			.join(", ");
		console.log(`  [${tierLabel(s)}] ${s.name}  (${load || "—"})  -> ${next}`);
		// Carry context across sessions: the last thing the mentor noted.
		const note = latestSession(s.id);
		if (note) console.log(`        last session: ${note}`);
	}
	if (dueCount() > 0) console.log("\nReview everything due:  /learn-it review");
}

// ---- router -----------------------------------------------------------------

function main() {
	switch (command) {
		case undefined:
		case "resume":
		case "status":
			return resume();
		case "init":
			return initSubject(args[0]);
		case "addconcept":
			return addConcept(args[0], args[1]);
		case "concepts":
			return listConcepts(args[0]);
		case "advise":
			return checkStage(args[0], args[1]);
		case "addcard":
			return addCard(args[0], args[1], args[2], args[3]);
		case "show":
			return showCard(args[0]);
		case "editcard":
			return editCard(args[0], args[1], args[2]);
		case "delcard":
			return delCard(args[0]);
		case "delconcept":
			return delConcept(args[0], args[1]);
		case "ungrade":
			return ungrade(args[0]);
		case "suspend":
			return suspendCard(args[0], args[1]);
		case "probe":
			return probe(args[0], args[1], args[2], args[3]);
		case "target":
			return setTarget(args[0], args[1]);
		case "due":
			return listDue(args[0]);
		case "due-concepts":
		case "reinforce":
			return listDueConcepts(args[0]);
		case "expose":
			return expose(args[0], args[1], args[2], args[3]);
		case "mark":
			return setStatus(args[0], args[1], args[2]);
		case "grade":
			return grade(args[0], args[1]);
		case "note":
			return addNote(args[0], args[1]);
		case "sessions":
			return listSessions(args[0]);
		case "assess":
			return assess(args[0], args[1]);
		case "evaluate":
			return evaluate(args[0], args[1], args[2], args[3]);
		case "mastery":
			return mastery(args[0]);
		case "export":
			return exportJson(args[0]);
		case "doctor":
			return doctor();
		default:
			console.log(
				"Usage: bun src/learn-it.ts <command>\n" +
					"  state:    resume | mastery <s> | export [s] | doctor\n" +
					"  subject:  init <s> | target <s> <tier> | concepts <s> | advise <stage> <s>\n" +
					"  concept:  addconcept <s> <c> | delconcept <s> <c> | mark <s> <c> <blank|shaky|known>\n" +
					"  reinforce: due-concepts [s] | expose <s> <c> <explain|quiz|read|card> [0-5]\n" +
					"  cards:    addcard <s> <c> <q> <a> | show <id> | editcard <id> <q> <a> | delcard <id> | suspend <id> [on|off]\n" +
					"  review:   due [s] | grade <id> <0-5> | ungrade <id>\n" +
					"  assess:   probe <s> <c> <explain|apply> <0-100> | assess <s> [kind] | evaluate <s> <kind> <0-100> [file]\n" +
					"  session:  note <s> <summary> | sessions <s>",
			);
	}
}

main();
