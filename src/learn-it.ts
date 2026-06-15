import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";
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
	type MasterySignals,
	PASS,
	RETENTION_DAYS,
	SUSTAINED_MIN_DAYS,
	SUSTAINED_MIN_SPAN_DAYS,
	tierIndexOf,
} from "./mastery";
import { getDueCards, gradeCard, today } from "./scheduler";

const DB_PATH = path.join(".", "data", "learn_it.db");
const db = new Database(DB_PATH);

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

// Which assessment kind fits a phase, when the caller doesn't name one.
const PHASE_KIND: Record<Phase, EvidenceKind> = {
	diagnose: "explain",
	conceptualize: "explain",
	anchor: "apply",
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
              SUM(CASE WHEN interval >= 7 THEN 1 ELSE 0 END) AS m
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
		mastered: subject.mastered_at != null,
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

	const covered = (
		db
			.query(
				`SELECT COUNT(*) AS c FROM (
           SELECT concept_id FROM flashcards WHERE subject_id = ?
           UNION
           SELECT concept_id FROM evidence
             WHERE subject_id = ? AND concept_id IS NOT NULL AND passed = 1
         )`,
			)
			.get(sid, sid) as { c: number }
	).c;

	const proven = (
		db
			.query(
				`SELECT COUNT(*) AS c FROM (
           SELECT concept_id FROM reviews
             WHERE subject_id = ? AND quality >= 3 AND interval_before >= ?
           UNION
           SELECT concept_id FROM evidence
             WHERE subject_id = ? AND concept_id IS NOT NULL AND passed = 1
         )`,
			)
			.get(sid, RETENTION_DAYS, sid) as { c: number }
	).c;

	const longRet = (
		db
			.query(
				"SELECT COUNT(DISTINCT concept_id) AS c FROM reviews WHERE subject_id = ? AND quality >= 3 AND interval_before >= ?",
			)
			.get(sid, LONG_RETENTION_DAYS) as { c: number }
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
	console.log(
		advice.recommended
			? `OK (phase: ${phaseOf(subject)})`
			: `NOTE: ${advice.note}`,
	);
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
	const card = gradeCard(db, Number(cardId), q);
	console.log(
		`Card ${card.id} -> next review ${card.next_review} (interval ${card.interval}d)`,
	);
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
		"INSERT INTO evidence (subject_id, concept_id, kind, bloom, score, passed, source_file) VALUES (?, NULL, ?, ?, ?, ?, ?)",
		[subject.id, kind, EVIDENCE_BLOOM[kind], score, passed, file ?? null],
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
		"INSERT INTO evidence (subject_id, concept_id, kind, bloom, score, passed) VALUES (?, ?, ?, ?, ?, ?)",
		[subject.id, concept.id, kind, EVIDENCE_BLOOM[kind], score, passed],
	);
	console.log(
		`probe recorded: ${subjectName} / ${conceptName} ${kind} ${score}/100 (${passed ? "proven" : "shaky"}). Tier: ${tierLabel(getSubject(subjectName) as SubjectRow)}`,
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
	console.log(`Cards due today: ${dueCount()} (across all subjects)`);

	if (!subjects.length) {
		console.log('No subjects yet. Start one:  /learn-it init "<subject>"');
		return;
	}

	console.log("\nSubjects:");
	for (const s of subjects) {
		const phase = phaseOf(s);
		const due = dueCount(s.name);
		const next =
			phase === "mastered" ? "done" : `next: ${PHASE_SUGGESTION[phase]}`;
		console.log(
			`  [${tierLabel(s)}] ${s.name}  (${due > 0 ? `${due} due` : "—"})  -> ${next}`,
		);
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
		case "probe":
			return probe(args[0], args[1], args[2], args[3]);
		case "target":
			return setTarget(args[0], args[1]);
		case "due":
			return listDue(args[0]);
		case "grade":
			return grade(args[0], args[1]);
		case "assess":
			return assess(args[0], args[1]);
		case "evaluate":
			return evaluate(args[0], args[1], args[2], args[3]);
		case "mastery":
			return mastery(args[0]);
		default:
			console.log(
				"Usage: bun src/learn-it.ts [resume|init|addconcept|concepts|advise|addcard|probe|target|due|grade|assess|evaluate|mastery]",
			);
	}
}

main();
