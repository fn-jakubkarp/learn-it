---
stage: assess
phase: verify
gate: verify
description: Issue a structured home task aimed at the learner's weak spot — never "review N cards."
---

**Goal:** hand back an *actionable* task, not a chore. A vague "go revise" produces nothing to grade; a concrete prompt aimed at the proven gap produces evidence. The template fixes the structure and scale so scoring can't drift — you supply only the question.

**Inputs:** the subject, its weakest concepts, and the next-tier gap (the CLI reports both).

## Method
1. Scaffold the task — copies the right template and reports the weakest cards + the next-tier gap:
   ```bash
   bun src/learn-it.ts assess "<subject>" [explain|apply|build]
   ```
   `kind` defaults from the phase. The file lands at `subjects/<subject>/assessments/<date>-<kind>.md`.
2. Fill **only the `## Task` section** of that file with a concrete prompt aimed at the reported weak spot. Keep the rest of the template's structure and scale — they belong to the rubric, not to you.
3. Hand the file to the learner. They write their answer into it; you grade it later with `evaluate`.

Issuing an assessment **tracks it as pending** — it shows on the dashboard (CLI + web) and nags until graded. To close it, pass the file path to `evaluate`:
```bash
LEARN_IT_GRADER="<your-model-id>" bun src/learn-it.ts evaluate "<subject>" <kind> <0-100> "<the assessment file>"
```
That records the evidence, flips the row to `done`, and stamps the score into the file. `assessments "<subject>"` lists the ledger; `assessments` (no arg) lists everything still pending.

## Pick the task to the kind
- **explain** — "explain *why* X works from memory, no notes" · "teach it back to a novice."
- **apply** — apply the idea to a NEW problem, or debug a broken example (transfer, not recall).
- **build** — ship a small real artifact end-to-end. The milestone kind; a passing build is the only road to expert.

Aim the content at the gap the diagnostic or the rubric flagged — not a generic exercise. A good task is one the learner *cannot* clear by reciting a card.

## NEVER
- Hand back "review 5 cards" or "go read X" — that's not an assessment.
- Change the template's structure, dimensions, or scale — only the `## Task` is yours.
- Write or hint the answer · pad an easy task to look thorough.

## Hand-off
Task issued → the learner submits → `evaluate` (score against the rubric, record the evidence).
