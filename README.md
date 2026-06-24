# Learn-it

> An AI learning pipeline that builds knowledge that lasts: spaced repetition, active recall, and a mastery score you can't fake.

<!-- README-I18N:START -->

**English** | [中文](./docs/README.zh.md) | [Español](./docs/README.es.md) | [Polski](./docs/README.pl.md) | [日本語](./docs/README.ja.md) | [Deutsch](./docs/README.de.md)

<!-- README-I18N:END -->

<p align="center">
  <img src="docs/diag-teaser.gif" alt="learn-it diagnoses you concept by concept, grades each, and writes a calibrated readout of where you stand" width="820">
</p>

Recognition isn't recall. You can recognize an answer when you see it and still not be able to pull it from memory unprompted. Learn-it is built for the second kind of knowing: it generates a personalized learning path, then drives you through proven cognitive-science methods, from spaced repetition (FSRS) and active recall to Feynman, Bloom depth, and the Dreyfus skill ladder, until knowledge actually lands in long-term memory.

It's driven by an AI through the `/learn-it` skill. The AI diagnoses you, teaches, and grades; a thin Bun CLI is the engine it calls, logging only what you demonstrate.

> [!NOTE]
> Mastery is **computed from logged performance, never self-reported.** Gaming your own score is exactly the illusion of competence the tool exists to defeat, so editing a file can't move it.

## Features

- **Personalized roadmap**: a diagnostic audits what you already know and breaks a subject into concept-sized leaves, so you skip what you've mastered and don't get overloaded.
- **Concept-level spaced repetition**: each *concept* (not each card) carries its own FSRS schedule, advanced by whichever surface you reinforce it with: re-explain, quiz, re-read, or a flashcard.
- **Active recall on many surfaces**: flashcards are one stream, not the point. Re-explaining (Feynman), answering a sharp quiz, or doing a small real task all count; passive re-reading is credited as recognition only, never as proof.
- **Harsh, un-gameable mastery**: a Dreyfus tier per subject (`novice → … → expert`), rolled up from an append-only log of graded recalls and rubric-scored assessments. Volume never lifts a tier; `expert` requires a real build plus durability over time.
- **A watcher, not rails**: phase is *inferred* from real state, never stored. Any stage runs on demand; if you jump ahead, the watcher nudges and lets you decide.
- **Many subjects at once**: run Rust, networking, and cooking in parallel; the review queue interleaves due items across all of them.
- **Local web dashboard**: a build-free `Bun.serve` page at `localhost:4321` for solo review between sessions.

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.3: runs the whole engine (CLI, dashboard, tests, bundled SQLite). No Node.js required.
- `git`.
- An agentic CLI to drive it: [Claude Code](https://claude.com/claude-code) recommended; the skill is also wired for [Qwen Code](https://github.com/QwenLM/qwen-code), [OpenCode](https://opencode.ai), and the [Gemini CLI](https://github.com/google-gemini/gemini-cli).

## Installation

The one-liner installs Bun if needed, clones the repo, installs dependencies, and creates the database.

**Linux / macOS**

```bash
curl -fsSL https://raw.githubusercontent.com/fn-jakubkarp/learn-it/main/install.sh | bash
```

**Windows (PowerShell)**

```powershell
irm https://raw.githubusercontent.com/fn-jakubkarp/learn-it/main/install.ps1 | iex
```

<details>
<summary>Or install manually</summary>

```bash
git clone https://github.com/fn-jakubkarp/learn-it.git
cd learn-it
bun install
bun src/init-db.ts          # create data/learn_it.db
bun run verify              # optional: biome + tsc + bun test
```

</details>

<details>
<summary>Install without telemetry</summary>

Write the opt-out **before the first run** — Bun auto-loads `.env`, so every command is disabled from the start (no first-run notice, no id ever created). `.env` is gitignored.

**Linux / macOS**

```bash
git clone https://github.com/fn-jakubkarp/learn-it.git && cd learn-it
echo "LEARN_IT_TELEMETRY=0" > .env
bun install && bun src/init-db.ts
```

**Windows (PowerShell)**

```powershell
git clone https://github.com/fn-jakubkarp/learn-it.git; cd learn-it
"LEARN_IT_TELEMETRY=0" | Out-File -Encoding ascii .env
bun install; bun src/init-db.ts
```

Prefer a system-wide switch? `export DO_NOT_TRACK=1` opts out of this and any other tool that respects [the standard](https://consoledonottrack.com).

</details>

## Usage

Open your agentic CLI **inside the repo** (the engine runs with the repo root as its working directory) and call the skill. With no argument it shows the dashboard across every subject; an argument names a stage. Learn-it is meant to be driven by the AI, not typed by hand. The loop is conversational: diagnose → talk → plan → spaced re-exposure → verify.

```
/learn-it                   # dashboard across all subjects + the command menu
/learn-it init rust         # start a subject (just your goal — no self-inventory)
/learn-it explore-gaps rust # the diagnostic: it tests you and places you, you don't self-report
/learn-it reinforce         # the daily loop: spaced, varied re-exposure of due concepts
```

### Stages

Every stage runs on demand. Nothing is blocked. `[subject]` is optional (acts across all subjects when omitted); `{…}` is required.

**Diagnose & plan**

| Stage | What it does |
| --- | --- |
| `/learn-it` | Launch the dashboard, then print state + the command menu across all subjects. |
| `init {subject} [slug]` | Scaffold the subject and capture your **goal** (why + target). Assigns a short, ascii **slug** (e.g. `egzamin-krotkofalowca-klasa-1`) — the stable, quote-safe id you pass to later commands (the full name works too). No self-inventory — placement is measured, not declared. |
| `explore-topic {subject}` | Map the **full** territory into concepts and register it — coverage comes from the field, not your recall, so unnamed gaps still land on the map. |
| `explore-gaps {subject}` | Probe one concept at a time (react to a cue, not free-recall), teach a one-line gist at each gap, and write a 🟢/🟡/🔴 readout of where you actually stand. Sets a `target`. |
| `plan {subject}` | Reconcile the map with probe findings; order it foundation-first. |

**Learn & anchor**

| Stage | What it does |
| --- | --- |
| `concept {term}` | Teach by analogy + mechanism; you restate it into `notes.md`. |
| `anchor {facts}` | Mnemonics for raw facts only (syntax, names, dates). |
| `extract {subject}` | Turn your notes into flashcards. |

**Recall & space**

| Stage | What it does |
| --- | --- |
| `reinforce [subject]` | **The daily loop**: spaced, varied re-exposure of due concepts, weakest first. |
| `review [subject]` | Flashcard recall, graded, with on-miss feedback. |
| `quiz {subject} {concept}` | One sharp recall/apply question. |

**Verify & grade**

| Stage | What it does |
| --- | --- |
| `feynman {subject}` | You teach it back; the AI probes gaps → logs `explain` evidence. |
| `exam {subject}` | A hard test on a *new* problem → logs `apply` evidence. |
| `assess {subject} [kind]` | Issue a structured home task (`explain`/`apply`/`build`) aimed at your weak spot. |
| `evaluate {subject} {kind} {0-100} [file]` | Score a submission against a fixed rubric (≥ 70 passes) and close the task. |
| `mastery {subject}` | Current tier, % to next, and exactly what's blocking it. |

> [!NOTE]
> `build` is the milestone kind: a small but real artifact, interrogated before it's scored. A passing `build` is the only path to the evidence an `expert` rating requires.

For solo review between sessions, the local dashboard needs no AI:

```bash
bun src/dashboard.ts        # → http://localhost:4321
```

> [!TIP]
> To make `/learn-it` discoverable from any project, install it as a Claude Code plugin: `/plugin marketplace add fn-jakubkarp/learn-it` then `/plugin install learn-it@learn-it`. The engine still runs from the cloned repo, so keep the clone.

> [!IMPORTANT]
> The bare `bun src/learn-it.ts <cmd>` calls are the engine the skill drives, not a manual workflow. Reach for them directly only to inspect or script your data (`export`, `doctor`, `db`).

## How it works

**Two tiers.** A *subject* is the thing you master (e.g. "Rust") and carries the roadmap, phase, and Dreyfus tier. A *concept* is a lesson-sized leaf under it (e.g. "ownership"); cards attach there. The roadmap is the concept list, and mastery rolls up from it. You can't be an "expert" in a single fact.

**Phases are a map, not a railroad.** Learn-it reads your real state (concepts mapped? *probed*? cards reviewed?) to infer where each subject sits — diagnose is left behind when you've been tested, never when you've filled in a form. Nothing is blocked.

```
diagnose → conceptualize → recall → space → verify → mastered
```

**Mastery is earned and medium-agnostic.** Climbing a tier needs proven retention (recalling a concept after a real gap, not the same day) plus evidence that isn't flashcards: explaining it, applying it to new problems, and, for `expert`, building something real. Spacing counts real elapsed time, so grinding the same day moves nothing.

**Assessments are templated, not improvised.** `assess` issues a task from a fixed template; you submit; `evaluate` scores it against a fixed rubric so scoring can't drift. A passing `build` is the only path to the evidence `expert` requires.

### Ownership model

| Concern | Owner | Files |
| --- | --- | --- |
| **Knowledge** | you author, engine only reads | `subjects/<s>/{audit,notes,roadmap}.md`, `assessments/*.md` |
| **State** | engine owns, don't hand-edit | `data/learn_it.db` (cards, recall log, evidence) |
| **Engine** | versioned logic + prompts | `src/*.ts`, `stages/*.md`, `templates/*` |

The one rule: the engine writes *State*, reads *Knowledge*, and never edits a file you authored.

### The engine

| File | Role |
| --- | --- |
| `src/learn-it.ts` | Session router: dashboard, watcher, concepts, cards, assess/evaluate, mastery, notes, `export`, `doctor`. |
| `src/lifecycle.ts` | Infers a subject's phase and advises (never blocks). |
| `src/scheduler.ts` | FSRS core for flashcards; logs every recall against real elapsed time. |
| `src/exposure.ts` | Concept-level spaced exposure (the `reinforce` queue), advanced by any surface. |
| `src/mastery.ts` | Dreyfus tiers, rolled up over concepts + evidence (no volume credit). |
| `src/init-db.ts` | Creates / migrates the SQLite schema. |
| `src/dashboard.ts` | Build-free local web dashboard. |
| `src/telemetry.ts` | Anonymous, content-free adoption telemetry (opt-out). |

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design — including a diagram of the whole flow.

## Telemetry

Learn-it sends **anonymous, content-free** usage telemetry (PostHog) so the tool can be improved based on which commands people actually use. A loud one-time notice prints the first time anything is sent.

- **What it sends:** the command you ran (`grade`, `assess`, …), the app version, your OS, and a random per-install id. The dashboard isn't tracked.
- **What it never sends:** subject names, concept names, card text, notes, scores — *anything* you study. That stays in `data/*.db` on your machine and never leaves it.
- **Opt out any time:** `export DO_NOT_TRACK=1` (the [cross-tool standard](https://consoledonottrack.com)) or `export LEARN_IT_TELEMETRY=0`. CI runs are excluded automatically. The anonymous id lives at `data/.telemetry-id` — delete it to reset.

## Acknowledgements

The skill-router and per-stage prompt scaffold draw inspiration from [career-ops](https://github.com/santifer/career-ops) (MIT). Learn-it's methodology, scheduling engine, and domain logic are its own.
