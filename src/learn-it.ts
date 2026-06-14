import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";
import {
	canRun,
	nextPhase,
	PHASE_SUGGESTION,
	type Phase,
	phaseIndex,
} from "./lifecycle";
import { getDueCards, gradeCard, today } from "./scheduler";

const DB_PATH = path.join(".", "data", "learn_it.db");
const db = new Database(DB_PATH);

const [command, ...args] = process.argv.slice(2);

interface TopicRow {
	id: number;
	name: string;
	phase: Phase;
	created_at: string;
}

// ---- helpers ----------------------------------------------------------------

function getTopic(name: string): TopicRow | undefined {
	return db.query("SELECT * FROM topics WHERE name = ?").get(name) as
		| TopicRow
		| undefined;
}

function setState(key: string, value: string) {
	db.run(
		"INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
		[key, value, value],
	);
}

function getState(key: string): string | null {
	const row = db.query("SELECT value FROM app_state WHERE key = ?").get(key) as
		| { value: string }
		| undefined;
	return row ? row.value : null;
}

function setPhase(name: string, phase: Phase) {
	db.run("UPDATE topics SET phase = ? WHERE name = ?", [phase, name]);
}

function dueCount(topicName?: string): number {
	return getDueCards(db, topicName).length;
}

// ---- commands ---------------------------------------------------------------

function initTopic(name?: string) {
	if (!name) return console.log('Usage: init "<topic>"');
	const topicDir = path.join(".", "topics", name);
	if (!fs.existsSync(topicDir)) fs.mkdirSync(topicDir, { recursive: true });
	const auditPath = path.join(topicDir, "audit.md");
	if (!fs.existsSync(auditPath)) {
		fs.writeFileSync(
			auditPath,
			`# Audit: ${name}\n\n## Knowledge Gaps\n- [ ] ...\n`,
		);
	}
	try {
		db.run("INSERT INTO topics (name, phase) VALUES (?, 'diagnose')", [name]);
		console.log(`Initialized topic: ${name} (phase: diagnose)`);
	} catch {
		console.log(`Topic ${name} already exists.`);
	}
	setState("active_topic", name);
}

// Advance the lifecycle one step (a stage calls this when its work is done).
function advance(name?: string) {
	if (!name) return console.log('Usage: advance "<topic>"');
	const topic = getTopic(name);
	if (!topic) return console.log(`No topic: ${name}`);
	const next = nextPhase(topic.phase);
	if (!next)
		return console.log(
			`${name} is already at the final phase (${topic.phase}).`,
		);
	setPhase(name, next);
	setState("active_topic", name);
	console.log(`${name}: ${topic.phase} -> ${next}`);
}

// Gate check the agent runs before executing a stage.
function gate(stage?: string, name?: string) {
	if (!stage || !name) return console.log('Usage: gate <stage> "<topic>"');
	const topic = getTopic(name);
	if (!topic) return console.log(`BLOCKED: no topic ${name}`);
	if (stage === "plan") {
		const auditPath = path.join(".", "topics", name, "audit.md");
		const filled =
			fs.existsSync(auditPath) &&
			fs.readFileSync(auditPath, "utf8").includes("- [");
		if (!filled)
			return console.log(`BLOCKED: fill topics/${name}/audit.md first`);
	}
	const verdict = canRun(stage, topic.phase);
	console.log(verdict.ok ? "OK" : `BLOCKED: ${verdict.reason}`);
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
	// First cards extracted -> the topic is ready to recall.
	if (phaseIndex(topic.phase) < phaseIndex("recall")) setPhase(name, "recall");
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
	if (!cardId || Number.isNaN(q) || q < 0 || q > 5) {
		return console.log("Usage: grade <cardId> <quality 0-5>");
	}
	const card = gradeCard(db, Number(cardId), q);
	console.log(
		"Card " +
			card.id +
			" -> next review " +
			card.next_review +
			" (interval " +
			card.interval +
			"d)",
	);
}

function showStatus() {
	const topics = db
		.query("SELECT * FROM topics ORDER BY created_at")
		.all() as TopicRow[];
	console.log("\n--- learn-it status ---");
	console.log(`Cards due today: ${dueCount()}`);
	console.log(`Topics: ${topics.length}`);
	for (const t of topics)
		console.log(`  [${t.phase}] ${t.name} (${dueCount(t.name)} due)`);
}

// No command: resume the active topic and tell the user what to do now.
function resume() {
	const active = getState("active_topic");
	console.log("\n--- learn-it ---");
	console.log(`Cards due today: ${dueCount()}`);

	if (!active) {
		console.log('No active topic. Start one:  /learn-it init "<topic>"');
		return;
	}
	const topic = getTopic(active);
	if (!topic) {
		console.log('Active topic missing. Start one:  /learn-it init "<topic>"');
		return;
	}
	console.log(`Active topic: ${active}  (phase: ${topic.phase})`);
	console.log(`Due in this topic: ${dueCount(active)}`);
	console.log(`Next stage:  /learn-it ${PHASE_SUGGESTION[topic.phase]}`);
}

// ---- router -----------------------------------------------------------------

function main() {
	switch (command) {
		case undefined:
		case "resume":
			return resume();
		case "init":
			return initTopic(args[0]);
		case "advance":
			return advance(args[0]);
		case "gate":
			return gate(args[0], args[1]);
		case "addcard":
			return addCard(args[0], args[1], args[2]);
		case "due":
			return listDue(args[0]);
		case "grade":
			return grade(args[0], args[1]);
		case "status":
			return showStatus();
		default:
			console.log(
				"Usage: bun src/learn-it.ts [resume|init|advance|gate|addcard|due|grade|status]",
			);
	}
}

main();
