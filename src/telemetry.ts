import fs from "node:fs";
import path from "node:path";

// Anonymous, content-free adoption telemetry.
//
// CORE RULE — this module may see command *verbs* and the environment shape only,
// NEVER subject names, concept names, card text, notes, scores, or any learning
// content. What someone studies is private; only the fact that they ran `grade`
// vs `assess` ever leaves the machine. Callers pass a verb, not argv (argv carries
// subject/concept names). This mirrors the project's local-first invariant: the
// learning data lives in data/*.db and stays there.
//
// Opt-out, with a loud one-time notice on first capture. Telemetry is OFF when any
// of these hold:
//   - DO_NOT_TRACK is set to a truthy value (the cross-tool standard,
//     https://consoledonottrack.com)
//   - LEARN_IT_TELEMETRY is 0 / false
//   - CI is set (automated runs aren't adoption)
//   - the PostHog key is still the shipped placeholder (no project wired up yet),
//     so the public repo is safe-by-default until a real key is pasted in
//
// Every path is wrapped so a telemetry failure (offline, bad key, blocked egress)
// can NEVER break or slow a CLI command.

const DATA_DIR = path.join(import.meta.dir, "..", "data");
const ID_FILE = path.join(DATA_DIR, ".telemetry-id");

// PUBLIC, write-only ingestion key — committed on purpose in this open-source repo
// (it is the client-side project key, not a personal/admin token; it can only send
// events, never read them). POSTHOG_HOST must match the project's region. To ship a
// build with telemetry OFF, set the key to an empty string.
export const POSTHOG_KEY = "phc_BLbYcjuKiyMC5Yjk3ZLNDBRuw3qNfAg58CSiFZzoggWo";
export const POSTHOG_HOST = "https://eu.i.posthog.com";

const NOTICE = `
learn-it collects anonymous usage telemetry (which commands run, app version, OS)
to guide development. It never sees what you study — no subject names, card text,
notes, or scores. A random anonymous id lives at data/.telemetry-id (delete it to
reset). Opt out any time:

    export DO_NOT_TRACK=1        # or:  export LEARN_IT_TELEMETRY=0
`;

// Pure decision, given an env bag + the resolved key: is telemetry off? Exported
// so tests can assert the whole opt-out matrix without touching process state.
export function isTelemetryDisabled(
	env: Record<string, string | undefined>,
	key: string,
): boolean {
	// Normalize (trim + lowercase) so " 1 ", "FALSE", "False" honor the user's
	// intent — a misspelled-case opt-out must still opt out.
	const dnt = env.DO_NOT_TRACK?.trim().toLowerCase();
	if (dnt && dnt !== "0" && dnt !== "false") return true;
	const lit = env.LEARN_IT_TELEMETRY?.trim().toLowerCase();
	if (lit === "0" || lit === "false") return true;
	if (env.CI) return true;
	if (!key) return true;
	return false;
}

export function telemetryEnabled(): boolean {
	return !isTelemetryDisabled(process.env, POSTHOG_KEY);
}

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The stable per-install anonymous id, created (with the one-time notice) on first
// use. Returns null if it can't be persisted — telemetry then quietly no-ops.
export function telemetryId(): string | null {
	try {
		if (fs.existsSync(ID_FILE)) {
			const existing = fs.readFileSync(ID_FILE, "utf8").trim();
			// Reuse only a well-formed id — a corrupted or hand-edited value (empty,
			// multi-line, arbitrary text) must not ride out as the distinctId; fall
			// through and regenerate instead.
			if (UUID_RE.test(existing)) return existing;
		}
		if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
		const id = crypto.randomUUID();
		fs.writeFileSync(ID_FILE, id);
		// First-run notice, printed to stderr so it never pollutes piped stdout
		// (e.g. `export` JSON consumed by the dashboard).
		console.error(NOTICE);
		return id;
	} catch {
		return null;
	}
}

function appVersion(): string {
	try {
		const pkg = JSON.parse(
			fs.readFileSync(path.join(import.meta.dir, "..", "package.json"), "utf8"),
		) as { version?: string };
		return pkg.version ?? "unknown";
	} catch {
		return "unknown";
	}
}

// PRIVATE sender — the single egress point, run ONLY inside the short-lived,
// detached child spawned by trackCommand. Ships EXACTLY the allowlisted fields:
// the event name + command verb + app version + OS, keyed by the anonymous install
// id. posthog-node is imported lazily so disabled installs never pay to load it;
// captureImmediate sends, then shutdown clears timers so the child exits promptly.
// Any failure is swallowed — telemetry is never load-bearing, and since this runs
// in a throwaway process a skipped shutdown can't leak (the process is about to go).
async function track(event: string, command: string): Promise<void> {
	if (!telemetryEnabled()) return;
	const distinctId = telemetryId();
	if (!distinctId) return;
	try {
		const { PostHog } = await import("posthog-node");
		const client = new PostHog(POSTHOG_KEY, {
			host: POSTHOG_HOST,
			flushAt: 1,
			flushInterval: 0,
			// An offline or firewalled user must not eat the default ~30s
			// retry/backoff. One attempt, hard 3s ceiling, then give up silently.
			fetchRetryCount: 0,
			requestTimeout: 3000,
		});
		await client.captureImmediate({
			distinctId,
			event,
			properties: {
				command,
				app_version: appVersion(),
				os: process.platform,
			},
		});
		await client.shutdown();
	} catch {
		// offline, blocked egress, bad key — never surface to the user.
	}
}

// The CLI router's documented verbs — the ONLY strings allowed to leave the
// machine. This egress allowlist lives here (not at the call site) so the privacy
// guarantee holds at the telemetry boundary regardless of caller. Keep in sync with
// the switch in src/learn-it.ts.
const TRACKED_COMMANDS = new Set([
	"resume",
	"status",
	"init",
	"addconcept",
	"concepts",
	"advise",
	"addcard",
	"show",
	"editcard",
	"delcard",
	"delconcept",
	"ungrade",
	"suspend",
	"probe",
	"target",
	"due",
	"due-concepts",
	"reinforce",
	"expose",
	"mark",
	"grade",
	"note",
	"sessions",
	"assess",
	"assessments",
	"evaluate",
	"mastery",
	"export",
	"fmt",
	"doctor",
	"db",
]);

// Clamp any input to an allowlisted verb: a missing command is the router's
// "resume" default; anything unrecognized (a typo, or a stray subject/concept name
// from a malformed invocation) becomes "unknown" so no user-typed string leaks.
// Exported so tests can pin the privacy boundary — an off-allowlist string MUST
// never ride out as itself.
export function trackedVerb(command: string | undefined): string {
	if (command === undefined) return "resume";
	return TRACKED_COMMANDS.has(command) ? command : "unknown";
}

// Typed helper for the CLI router: record a command VERB (never argv — args carry
// subject/concept names = learning content). Dispatched OFF-PROCESS so it can never
// add latency: we create the id + print the one-time notice synchronously here, then
// hand the network send to a detached, unref'd child and return immediately. The CLI
// (and any dashboard spawnSync wrapping it) exits without waiting on the network.
export function trackCommand(command: string | undefined): void {
	if (!telemetryEnabled()) return;
	if (!telemetryId()) return;
	try {
		Bun.spawn(
			[process.execPath, import.meta.path, "send", trackedVerb(command)],
			{ stdin: "ignore", stdout: "ignore", stderr: "ignore" },
		).unref();
	} catch {
		// spawn failed — telemetry is best-effort, never load-bearing.
	}
}

// Detached sender entry: `bun src/telemetry.ts send <verb>` performs the real
// network send in its own process (spawned by trackCommand) and exits when done.
if (import.meta.main) {
	const [mode, verb] = process.argv.slice(2);
	if (mode === "send") void track("cli_command", trackedVerb(verb));
}
