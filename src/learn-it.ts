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
	LONG_RETENTION_DAYS,
	type MasterySignals,
	RETENTION_DAYS,
} from "./mastery";
import { getDueCards, gradeCard, today } from "./scheduler";

const DB_PATH = path.join(".", "data", "learn_it.db");
const db = new Database(DB_PATH);

const [command, ...args] = process.argv.slice(2);

interface TopicRow {
	id: number;
	name: string;
	mastered_at: string | null;
	created_at: string;
}

const auditTemplate = (name: string) =>
	`# Audit: ${name}\n\n## Knowledge Gaps\n- [ ] ...\n`;

// ---- helpers ----------------------------------------------------------------

function getTopic(name: string): TopicRow | undefined {
	return db.query("SELECT * FROM topics WHERE name = ?").get(name) as
		| TopicRow
		| undefined;
}

function allTopics(): TopicRow[] {
	return db
		.query("SELECT * FROM topics ORDER BY created_at")
		.all() as TopicRow[];
}

function dueCount(topicName?: string): number {
	return getDueCards(db, topicName).length;
}

// Read a topic's real state so its phase can be inferred (never stored).
function readSignals(topic: TopicRow): TopicSignals {
	const dir = path.join(".", "topics", topic.name);
	const auditPath = path.join(dir, "audit.md");
	let auditFilled = false;
	if (fs.existsSync(auditPath)) {
		const content = fs.readFileSync(auditPath, "utf8").trim();
		auditFilled =
			content.length > 0 && content !== auditTemplate(topic.name).trim();
	}

	const stats = db
		.query(
			`SELECT COUNT(*) AS c,
              SUM(CASE WHEN repetitions >= 1 THEN 1 ELSE 0 END) AS r,
              SUM(CASE WHEN interval >= 7 THEN 1 ELSE 0 END) AS m
       FROM flashcards WHERE topic_id = ?`,
		)
		.get(topic.id) as { c: number; r: number | null; m: number | null };

	return {
		auditFilled,
		hasRoadmap: fs.existsSync(path.join(dir, "roadmap.md")),
		cardCount: stats.c ?? 0,
		reviewedCount: stats.r ?? 0,
		maturedCount: stats.m ?? 0,
		mastered: topic.mastered_at != null,
	};
}

function phaseOf(topic: TopicRow): Phase {
	return inferPhase(readSignals(topic));
}

// Mastery signals come entirely from the logged reviews / verifications, so the
// score reflects demonstrated performance — not anything self-reported.
function masterySignals(topic: TopicRow): MasterySignals {
	const cards = (
		db
			.query("SELECT COUNT(*) AS c FROM flashcards WHERE topic_id = ?")
			.get(topic.id) as { c: number }
	).c;

	const retention = db
		.query(
			`SELECT
         COUNT(DISTINCT CASE WHEN interval_before >= ? THEN card_id END) AS retained,
         COUNT(DISTINCT CASE WHEN interval_before >= ? THEN card_id END) AS longRetained
       FROM reviews WHERE topic_id = ? AND quality >= 3`,
		)
		.get(RETENTION_DAYS, LONG_RETENTION_DAYS, topic.id) as {
		retained: number;
		longRetained: number;
	};

	const exam = db
		.query(
			"SELECT MAX(score) AS best FROM verifications WHERE topic_id = ? AND kind = 'exam'",
		)
		.get(topic.id) as { best: number | null };

	const feynman = db
		.query(
			"SELECT COUNT(*) AS c FROM verifications WHERE topic_id = ? AND kind = 'feynman' AND passed = 1",
		)
		.get(topic.id) as { c: number };

	const bestExam = exam.best ?? 0;
	return {
		cards,
		retainedCards: retention.retained ?? 0,
		longRetainedCards: retention.longRetained ?? 0,
		bestExam,
		examPassed: bestExam >= 70,
		feynmanPassed: feynman.c > 0,
	};
}

function tierLabel(topic: TopicRow): string {
	const m = assessMastery(masterySignals(topic));
	return m.tier === "expert" ? "expert ★" : `${m.tier} ${m.withinTier}%`;
}

// ---- commands ---------------------------------------------------------------

function initTopic(name?: string) {
	if (!name) return console.log('Usage: init "<topic>"');
	const topicDir = path.join(".", "topics", name);
	if (!fs.existsSync(topicDir)) fs.mkdirSync(topicDir, { recursive: true });
	const auditPath = path.join(topicDir, "audit.md");
	if (!fs.existsSync(auditPath))
		fs.writeFileSync(auditPath, auditTemplate(name));
	try {
		db.run("INSERT INTO topics (name) VALUES (?)", [name]);
		console.log(`Initialized topic: ${name}. Fill ${auditPath}, then: plan`);
	} catch {
		console.log(`Topic ${name} already exists.`);
	}
}

// The watcher: advises whether a stage fits, but never blocks.
function checkStage(stage?: string, name?: string) {
	if (!stage || !name) return console.log('Usage: advise <stage> "<topic>"');
	const topic = getTopic(name);
	if (!topic)
		return console.log(`NOTE: no topic "${name}" — run: init "${name}"`);
	const phase = phaseOf(topic);
	const advice = advise(stage, phase, readSignals(topic));
	if (advice.recommended) console.log(`OK (phase: ${phase})`);
	else console.log(`NOTE: ${advice.note}`);
}

function addCard(name?: string, question?: string, answer?: string) {
	if (!name || !question || !answer)
		return console.log('Usage: addcard "<topic>" "<q>" "<a>"');
	const topic = getTopic(name);
	if (!topic) return console.log(`No topic: ${name}`);
	db.run(
		"INSERT INTO flashcards (topic_id, question, answer, next_review, interval) VALUES (?, ?, ?, ?, 0)",
		[topic.id, question, answer, today()],
	);
	console.log(`Card added to ${name}.`);
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

// Record a depth check (exam or Feynman). A high exam can lift a topic to
// expert — at which point we stamp the (engine-owned) mastered_at.
function verify(name?: string, kind?: string, scoreArg?: string) {
	const score = Number(scoreArg);
	if (
		!name ||
		(kind !== "exam" && kind !== "feynman") ||
		Number.isNaN(score) ||
		score < 0 ||
		score > 100
	)
		return console.log('Usage: verify "<topic>" <exam|feynman> <score 0-100>');
	const topic = getTopic(name);
	if (!topic) return console.log(`No topic: ${name}`);

	const passed = score >= 70 ? 1 : 0;
	db.run(
		"INSERT INTO verifications (topic_id, kind, score, passed) VALUES (?, ?, ?, ?)",
		[topic.id, kind, score, passed],
	);

	const before = assessMastery(masterySignals(topic));
	if (
		before.tier === "expert" &&
		!topic.mastered_at &&
		kind === "exam" &&
		passed
	) {
		db.run("UPDATE topics SET mastered_at = ? WHERE id = ?", [
			today(),
			topic.id,
		]);
	}
	console.log(
		`${kind} recorded for ${name}: ${score}/100 (${passed ? "pass" : "fail"}). Tier: ${tierLabel(getTopic(name) as TopicRow)}`,
	);
}

// Mastery report — the harsh, earned level for one area, plus exactly what
// stands between the learner and the next tier.
function mastery(name?: string) {
	if (!name) return console.log('Usage: mastery "<topic>"');
	const topic = getTopic(name);
	if (!topic) return console.log(`No topic: ${name}`);
	const s = masterySignals(topic);
	const m = assessMastery(s);

	console.log(`\n--- mastery: ${name} ---`);
	console.log(
		m.tier === "expert"
			? "Tier: expert ★ (maxed — this is rare; respect)"
			: `Tier: ${m.tier}  (${m.withinTier}% toward ${nextTierName(m.tier)})`,
	);
	console.log(
		`Cards: ${s.cards} | retained ${RETENTION_DAYS}d+: ${s.retainedCards} | ${LONG_RETENTION_DAYS}d+: ${s.longRetainedCards} | best exam: ${s.bestExam}`,
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
	const i = order.indexOf(tier);
	return order[i + 1] ?? "expert";
}

// Home assessment: ONE concrete, actionable focus for today. The engine surfaces
// the inputs (what's due, the hardest cards, the next-tier gap); the agent turns
// them into a varied task — explain, apply, debug, teach — not "review N cards".
function assess(name?: string) {
	const topics = name ? [getTopic(name)].filter(Boolean) : allTopics();
	if (!topics.length)
		return console.log(name ? `No topic: ${name}` : "No topics yet.");

	for (const topic of topics as TopicRow[]) {
		const phase = phaseOf(topic);
		const m = assessMastery(masterySignals(topic));
		const due = getDueCards(db, topic.name);
		// Hardest-first: lowest ease = weakest recall = highest leverage.
		const weakest = [...due]
			.sort((a, b) => a.ease_factor - b.ease_factor)
			.slice(0, 5);

		console.log(`\n=== ${topic.name} [${phase}] ${tierLabel(topic)} ===`);
		console.log(`Due now: ${due.length}`);
		if (weakest.length) {
			console.log("Weakest due cards (target these):");
			for (const c of weakest)
				console.log(
					`  [${c.id}] (ease ${c.ease_factor.toFixed(2)}) ${c.question}`,
				);
		}
		console.log(`Suggested stage: ${PHASE_SUGGESTION[phase]}`);
		if (m.blocking.length) console.log(`Next tier needs: ${m.blocking[0]}`);
	}
}

// Dashboard across ALL topics — there is no single "active" topic.
function resume() {
	const topics = allTopics();
	console.log("\n--- learn-it ---");
	console.log(`Cards due today: ${dueCount()} (across all topics)`);

	if (!topics.length) {
		console.log('No topics yet. Start one:  /learn-it init "<topic>"');
		return;
	}

	console.log("\nTopics:");
	for (const t of topics) {
		const phase = phaseOf(t);
		const due = dueCount(t.name);
		const next =
			phase === "mastered" ? "done" : `next: ${PHASE_SUGGESTION[phase]}`;
		const dueLabel = due > 0 ? `${due} due` : "—";
		console.log(`  [${tierLabel(t)}] ${t.name}  (${dueLabel})  -> ${next}`);
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
			return initTopic(args[0]);
		case "advise":
			return checkStage(args[0], args[1]);
		case "addcard":
			return addCard(args[0], args[1], args[2]);
		case "due":
			return listDue(args[0]);
		case "grade":
			return grade(args[0], args[1]);
		case "verify":
			return verify(args[0], args[1], args[2]);
		case "mastery":
			return mastery(args[0]);
		case "assess":
			return assess(args[0]);
		default:
			console.log(
				"Usage: bun src/learn-it.ts [resume|init|advise|addcard|due|grade|verify|mastery|assess]",
			);
	}
}

main();
