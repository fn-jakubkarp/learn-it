import fs from "node:fs";
import path from "node:path";
import {
	POSTHOG_HOST,
	POSTHOG_KEY,
	telemetryEnabled,
	telemetryId,
} from "./telemetry";

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

// PostHog browser snippet, injected into <head> only when telemetry is enabled.
// autocapture AND session recording are OFF on purpose: the dashboard DOM shows
// subject/concept names (learning content), and autocapture would ship that DOM
// text. We keep anonymous pageviews only. distinctID is bootstrapped to the same
// per-install id the CLI uses, so web + CLI map to one anonymous person. The
// loader IIFE is verbatim from PostHog's docs; only the init() call is ours.
function posthogSnippet(distinctId: string): string {
	const cfg = JSON.stringify({
		api_host: POSTHOG_HOST,
		autocapture: false,
		capture_pageview: true,
		disable_session_recording: true,
		bootstrap: { distinctID: distinctId },
	});
	return `<script>
  !(function (t, e) {
    var o, n, p, r;
    e.__SV ||
      ((window.posthog = e),
      (e._i = []),
      (e.init = function (i, s, a) {
        function g(t, e) {
          var o = e.split(".");
          (2 == o.length && ((t = t[o[0]]), (e = o[1])),
            (t[e] = function () {
              t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
            }));
        }
        (((p = t.createElement("script")).type = "text/javascript"),
          (p.crossOrigin = "anonymous"),
          (p.async = !0),
          (p.src =
            s.api_host.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js"),
          (r = t.getElementsByTagName("script")[0]).parentNode.insertBefore(p, r));
        var u = e;
        for (
          void 0 !== a ? (u = e[a] = []) : (a = "posthog"),
            u.people = u.people || [],
            u.toString = function (t) {
              var e = "posthog";
              return ("posthog" !== a && (e += "." + a), t || (e += " (stub)"), e);
            },
            u.people.toString = function () {
              return u.toString(1) + ".people (stub)";
            },
            o =
              "init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(
                " ",
              ),
            n = 0;
          n < o.length;
          n++
        )
          g(u, o[n]);
        e._i.push([i, s, a]);
      }),
      (e.__SV = 1));
  })(document, window.posthog || []);
  posthog.init(${JSON.stringify(POSTHOG_KEY)}, ${cfg});
</script>`;
}

const serveOptions = {
	port: PORT,
	async fetch(req: Request) {
		const url = new URL(req.url);
		const { pathname } = url;

		if (req.method === "GET" && pathname === "/") {
			let html = fs.readFileSync(HTML, "utf8");
			const id = telemetryEnabled() ? telemetryId() : null;
			if (id) html = html.replace("</head>", `${posthogSnippet(id)}\n</head>`);
			return new Response(html, {
				headers: { "content-type": "text/html; charset=utf-8" },
			});
		}

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

		// Record a concept exposure through a surface (read = recognition; explain/
		// quiz = self-graded here, AI-graded in the /learn-it chat).
		if (req.method === "POST" && pathname === "/api/expose") {
			const body = (await req.json().catch(() => ({}))) as {
				subject?: string;
				concept?: string;
				surface?: string;
				quality?: number;
			};
			if (!body.subject || !body.concept || !body.surface)
				return json({ error: "subject, concept, surface required" }, 400);
			const args = ["expose", body.subject, body.concept, body.surface];
			if (body.quality != null) args.push(String(body.quality));
			const r = cli(args);
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
};

// `/learn-it` (no args) launches this in the background, so re-invoking it while
// a server already holds the port is the normal case — report the live URL and
// exit clean instead of crashing the session with an unhandled EADDRINUSE.
let server: ReturnType<typeof Bun.serve>;
try {
	server = Bun.serve(serveOptions);
} catch (err) {
	if ((err as { code?: string }).code === "EADDRINUSE") {
		console.log(`learn-it dashboard already running: http://localhost:${PORT}`);
		process.exit(0);
	}
	throw err;
}

console.log(`learn-it dashboard: http://localhost:${server.port}`);
