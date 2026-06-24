---
name: learn-it
description: Cognitive learning engine -- subjects broken into concepts, a watcher that tracks many subjects at once, an FSRS scheduler, and harsh per-subject mastery scored from logged performance. Tools, not rails.
metadata:
  arguments: stage
  user_invocable: "true"
  argument-hint: "[ (no args = resume) | init | explore-topic | explore-gaps | plan | concept | reinforce | quiz | feynman | extract | review | anchor | exam | assess | evaluate | mastery ]"
---

# learn-it -- Session Router

Tools + a watcher, not rails. **Routing:** no args → launch the web dashboard (localhost) and show state. An arg names a stage → read its `stages/` prompt (where one exists) and run the commands below. Phase is *inferred* from real state; nothing is blocked; any stage runs on demand, across many subjects at once.

Design & rationale live in `docs/ARCHITECTURE.md`; the invariants in `CLAUDE.md`. Don't restate them here — this file only routes.

All paths below (`stages/`, `templates/`, `src/`, `data/`) are **relative to the repo root** — the engine runs `bun src/learn-it.ts` with CWD = repo root, so these resources are shared infra read by the CLI and every entry point, not bundled inside this skill folder.

## Operating rules (cross-cutting)

- **Start by launching the web dashboard:** on no args, start the server in the **background** (it's long-running — never run it in the foreground, it won't return; use your tool's background-run mechanism): `bun src/dashboard.ts`. Surface **http://localhost:4321** (it reports + exits clean if a server already holds the port, so re-running is safe). Then print the text state for the chat: `bun src/learn-it.ts` — state + command menu across all subjects, surfaced as-is; don't paraphrase it.
- **Watcher advises, never blocks:** `bun src/learn-it.ts advise {stage} "{subject}"` → on a `NOTE`, surface it, then honor the learner's choice. There is no `advance`; phase follows reality.
- **Subjects have a slug:** `init "<name>" [slug]` creates a short, ascii, filesystem-safe **slug** (e.g. `egzamin-krotkofalowca-klasa-1`) alongside the human display name. **Use the slug as the `{subject}` argument** in every command — it's stable and quote-safe, where a name with spaces/diacritics is fragile. Commands also accept the full name, but prefer the slug; `resume`/`export` print it.
- **Counts come from the engine, never your head:** report concept/probe/card/due/assessment counts from `db` / `mastery` / `export` output, not a tally you kept while talking — a remembered count drifts (an off-by-one between "9 probed" and what the db holds reads as untrustworthy). When they disagree, the db wins; say so.
- **Pin the grader:** prefix every `grade` / `evaluate` / `probe` with `LEARN_IT_GRADER="<your-model-id>"`, inline on each call (an unset grader logs `unpinned`). Scores are LLM-graded — provenance is the soft spot in un-gameable mastery.
- **Double-grade tier-promoting evidence** (a `build`, an expert-gate `explain`, or an `apply` ≥ 90): grade twice, independently, record the lower.
- **Frontmatter on every learner markdown:** audit / roadmap / notes / assessment files open with a YAML header (`type:`, `subject:`). Templates ship with it; when you author `roadmap.md` / `notes.md`, add it. `bun src/learn-it.ts fmt [subject]` backfills any file missing one.
- **Fix material, don't live with it:** `show {id}` · `editcard {id} "{q}" "{a}"` · `ungrade {id}` · `suspend {id} [on|off]` · `delcard {id}`.
- **Inspect raw state (read-only):** `bun src/learn-it.ts db` (tables + row counts) · `db {table}` (dump) · `db "SELECT ..."` (query). Opens a `readonly` connection, so it can never alter logged performance — safe to browse freely.
- **End a session:** `bun src/learn-it.ts note "{subject}" "{covered, struggled, revisit}"` so the next session resumes warm. `sessions "{subject}"` lists history.
- **Make state legible (output format):** a diagnostic session interleaves *teaching* (prose) with *state changes* (placements, recordings). Keep them visually distinct so the learner can scan what moved:
  - **Glyphs** tag placement — 🟢 known · 🟡 shaky · 🔴 blank. The `probe` / `mark` lines already emit the glyph; surface them **as-is**. Lead any placement you narrate with the same glyph (e.g. `🟡 Idempotency — shaky: intuition, no model`), so it reads as state, not paragraph.
  - **Separators** break the beats: put a `---` rule between each concept probed, and between teaching and the recording that closes it. One concept = one block, not a wall.

## Stages

Each stage's commands and method live in its `stages/` prompt — read it and execute. Only the two fileless stages (`evaluate`, `mastery`) carry their command here.

| stage | reads | does |
|-------|-------|------|
| (no args) | — | launch web dashboard in the background (`bun src/dashboard.ts` → http://localhost:4321), then `bun src/learn-it.ts` → text state + command menu. Show as-is. |
| init {subject} [slug] | `stages/init.md` | scaffold the subject (assigns a short slug) + capture the goal (why + target); placement is measured later, not declared |
| explore-topic {subject} | `stages/explore-topic.md` | draft the candidate concept map + register it |
| explore-gaps {subject} | `stages/explore-gaps.md` | probe one concept at a time; place + set `target` |
| plan {subject} | `stages/plan.md` | reconcile the map with probe findings, order it foundation-first |
| concept {term} | `stages/concept.md` | analogy + mechanism; learner restates into `notes.md` |
| anchor {facts} | `stages/anchor.md` | mnemonics for raw facts only |
| reinforce [subject] | `stages/reinforce.md` | **the daily loop** — spaced, varied re-exposure of due concepts |
| quiz {subject} {concept} | `stages/quiz.md` | one sharp recall/apply question |
| extract {subject} | `stages/extract.md` | turn notes into cards |
| review [subject] | `stages/review.md` | flashcard recall, graded, with on-miss feedback |
| feynman {subject} | `stages/feynman.md` | learner teaches; probe gaps → explain evidence |
| exam {subject} | `stages/exam.md` | hard test on a NEW problem → apply evidence |
| assess {subject} [kind] | `stages/assess.md` | issue a structured home task aimed at the weak spot |

### evaluate {subject} <explain|apply|build> <0-100> [file]  (no stage file)
`LEARN_IT_GRADER="<id>" bun src/learn-it.ts evaluate ...`. Score against `templates/rubric/{kind}.md` (refute-first + dimensions live there); ≥ 70 passes; a passing `build` is required for expert. Pass the assessment **file path** to close the tracked task (issued by `assess`) — it flips pending → done and stamps the score. `assessments [subject]` lists the ledger / all pending.

### mastery {subject}  (no stage file)
`bun src/learn-it.ts mastery "{subject}"` → tier, % to next, exactly what's blocking. Name genuine milestones as information — never points, badges, or streaks.
