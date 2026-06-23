# learn-it — Cognitive Learning Engine

CLI-agnostic learning pipeline. Breaks a subject into concepts, runs an FSRS
scheduler over them, infers a learning phase from real logged state, and scores
a harsh, un-gameable per-subject mastery from demonstrated performance — never
self-report. Tools + a watcher, not rails.

Runs on any AI coding CLI that follows the open agent skill standard
(<https://agentskills.io>) — Claude Code, Gemini CLI, OpenCode, Qwen, Codex,
Copilot, Kimi. Each CLI discovers the **same** canonical skill via a symlink
into its own skills dir; there is no per-tool logic to maintain.

## How it's wired (single source of truth)

- **Canonical skill:** `.agents/skills/learn-it/SKILL.md` — the session router.
  Symlinked into `.claude/skills/`, `.qwen/skills/`, `.opencode/skills/`, and
  `skills/` (Claude plugin auto-discovery). Edit the canonical file; every CLI
  gets the change.
- **Stage prompts:** `stages/*.md` — shared instruction markdown the router
  reads and executes (one per stage).
- **Engine:** `src/*.ts` — a Bun + `bun:sqlite` CLI (`bun src/learn-it.ts`),
  tool-agnostic. Any agent that can run a shell drives it.
- **State:** `data/*.db` (SQLite) — shared on disk regardless of which CLI runs.
- **Path contract:** `stages/`, `templates/`, `src/`, and `data/` are **relative
  to the repo root** (CWD = repo root when the engine runs). They are shared infra
  read by the CLI and every entry point — deliberately *not* bundled inside the
  skill folder, so the skill stays a thin router over a repo-rooted engine.

## Start here

1. **Prerequisite:** install [Bun](https://bun.sh). The database auto-creates on
   the first `bun src/learn-it.ts` run (self-heal) — no manual setup. Run
   `bun src/init-db.ts` only to seed/migrate explicitly.
2. **Always begin with state:** `bun src/learn-it.ts` — the dashboard + command
   menu across all subjects. Surface its output as-is; don't paraphrase.
3. **Invoke a stage:** read `.agents/skills/learn-it/SKILL.md` (the router) and
   follow it. With no argument it shows the dashboard; an argument names a stage
   (`init`, `explore-topic`, `explore-gaps`, `plan`, `concept`, `reinforce`,
   `quiz`, `extract`, `review`, `feynman`, `exam`, `assess`, `evaluate`,
   `mastery`).

## Rules you must not regress

These are load-bearing — the full list is in `CLAUDE.md`, the design in
`docs/ARCHITECTURE.md`. The essentials:

- **Mastery is computed from logged performance** (`reviews` + `evidence`),
  never self-reported, measured against real elapsed time. Don't add a path
  that lets a learner declare their own score.
- **The watcher advises, never blocks.** Phase is inferred from real state, not
  a stored cursor. `advise {stage} "{subject}"` surfaces a `NOTE`; honor the
  learner's choice. There is no `advance`.
- **Pin the grader:** prefix every `grade` / `evaluate` / `probe` with
  `LEARN_IT_GRADER="<your-model-id>"` inline — an unset grader logs `unpinned`.
- **Spacing lives on the concept**, advanced by any retrieval surface
  (explain / quiz / card). Cards are an addon, not the centre.

## Stack

Bun + TypeScript, `bun:sqlite`, Biome 2.5. Markdown for stages and learner
files (audit / roadmap / notes / assessments carry YAML frontmatter; `fmt`
backfills, `doctor` flags drift). Output in `output/` (gitignored). Never commit
user data under `subjects/` or `output/` — only their `.gitkeep`.
