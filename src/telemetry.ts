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
	const dnt = env.DO_NOT_TRACK;
	if (dnt && dnt !== "0" && dnt !== "false") return true;
	if (env.LEARN_IT_TELEMETRY === "0" || env.LEARN_IT_TELEMETRY === "false")
		return true;
	if (env.CI) return true;
	if (!key) return true;
	return false;
}

export function telemetryEnabled(): boolean {
	return !isTelemetryDisabled(process.env, POSTHOG_KEY);
}

// The stable per-install anonymous id, created (with the one-time notice) on first
// use. Returns null if it can't be persisted — telemetry then quietly no-ops.
export function telemetryId(): string | null {
	try {
		if (fs.existsSync(ID_FILE)) return fs.readFileSync(ID_FILE, "utf8").trim();
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

// Capture one event and flush before the (short-lived) process exits. posthog-node
// is imported lazily so disabled installs never pay to load it; captureImmediate
// sends synchronously and resolves, then shutdown clears timers so the process can
// exit clean. Any failure is swallowed — telemetry is never load-bearing.
export async function track(
	event: string,
	properties: Record<string, unknown> = {},
): Promise<void> {
	if (!telemetryEnabled()) return;
	const distinctId = telemetryId();
	if (!distinctId) return;
	try {
		const { PostHog } = await import("posthog-node");
		const client = new PostHog(POSTHOG_KEY, {
			host: POSTHOG_HOST,
			flushAt: 1,
			flushInterval: 0,
			// An interactive CLI runs this on every command — an offline or
			// firewalled user must not eat the default ~30s retry/backoff. One
			// attempt, hard 3s ceiling, then give up silently.
			fetchRetryCount: 0,
			requestTimeout: 3000,
		});
		await client.captureImmediate({
			distinctId,
			event,
			properties: {
				...properties,
				app_version: appVersion(),
				os: process.platform,
				runtime: "bun",
			},
		});
		client.shutdown();
	} catch {
		// offline, blocked egress, bad key — never surface to the user.
	}
}

// Convenience for the CLI router: record a command verb. Takes ONLY the verb,
// never argv — args carry subject/concept names, which are learning content.
export async function trackCommand(command: string | undefined): Promise<void> {
	await track("cli_command", { command: command ?? "resume" });
}
