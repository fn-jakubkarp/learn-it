import fs from "node:fs";
import path from "node:path";

// A dependency-free, build-free dashboard. `bun src/dashboard.ts` serves one HTML
// page plus a tiny JSON API that shells out to the existing CLI — `export` for
// read state, `grade`/`note` for writes. So the engine still owns the database;
// the dashboard is a thin HTTP veneer over the same commands a human would run,
// and every request reflects live state (it re-reads the DB each call).
//
// Writes default the grader to "dashboard" so self-graded card reviews are
// distinguishable from AI-graded assessments in a provenance audit.

const ROOT = path.join(import.meta.dir, "..");
const CLI = path.join(import.meta.dir, "learn-it.ts");
const HTML = path.join(import.meta.dir, "dashboard.html");
const PORT = Number(process.env.LEARN_IT_PORT) || 4321;

function cli(args: string[]): { ok: boolean; out: string; err: string } {
	const res = Bun.spawnSync([process.execPath, CLI, ...args], {
		cwd: ROOT,
		env: {
			...process.env,
			LEARN_IT_GRADER: process.env.LEARN_IT_GRADER || "dashboard",
		},
	});
	return {
		ok: res.exitCode === 0,
		out: res.stdout.toString(),
		err: res.stderr.toString(),
	};
}

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "content-type": "application/json" },
	});
}

const server = Bun.serve({
	port: PORT,
	async fetch(req) {
		const url = new URL(req.url);
		const { pathname } = url;

		if (req.method === "GET" && pathname === "/")
			return new Response(fs.readFileSync(HTML), {
				headers: { "content-type": "text/html; charset=utf-8" },
			});

		// Live watcher + card state for the whole learner.
		if (req.method === "GET" && pathname === "/api/state") {
			const r = cli(["export"]);
			if (!r.ok) return json({ error: (r.err || r.out).trim() }, 500);
			return new Response(r.out, {
				headers: { "content-type": "application/json" },
			});
		}

		// Grade a card (self-graded recall practice). quality 0-5; <3 = Again.
		if (req.method === "POST" && pathname === "/api/grade") {
			const body = (await req.json().catch(() => ({}))) as {
				id?: number;
				quality?: number;
			};
			if (body.id == null || body.quality == null)
				return json({ error: "id and quality required" }, 400);
			const r = cli(["grade", String(body.id), String(body.quality)]);
			return json(
				{ ok: r.ok, message: (r.out || r.err).trim() },
				r.ok ? 200 : 500,
			);
		}

		// Record a session note for continuity into the next session.
		if (req.method === "POST" && pathname === "/api/note") {
			const body = (await req.json().catch(() => ({}))) as {
				subject?: string;
				summary?: string;
			};
			if (!body.subject || !body.summary)
				return json({ error: "subject and summary required" }, 400);
			const r = cli(["note", body.subject, body.summary]);
			return json(
				{ ok: r.ok, message: (r.out || r.err).trim() },
				r.ok ? 200 : 500,
			);
		}

		return new Response("Not found", { status: 404 });
	},
});

console.log(`learn-it dashboard: http://localhost:${server.port}`);
