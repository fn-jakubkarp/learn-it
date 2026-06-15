---
stage: explore-gaps
phase: diagnose
gate: diagnose
description: Probe the learner against the concept map to find real gaps and place them at their true level — not always novice.
---

**Goal:** placement by demonstration, not self-report. Self-assessment correlates weakly with real skill — people can't rank what they don't yet know — so **test**, don't ask. Find the real gaps, and lift an experienced learner to their true level instead of starting everyone at novice.

**Inputs:** the registered concept map (from `explore-topic`).

## Method
1. For each concept worth checking, pose a prompt at **rising difficulty** and push until the learner falls off — the fall-off point is the signal (adaptive testing).
2. Score against the matching rubric (`templates/rubric/{explain,apply}.md`), **refute-first** — credit only what survives a skeptical read.
3. Record concept-level evidence, grader pinned:
   ```bash
   LEARN_IT_GRADER="<your-model-id>" bun src/learn-it.ts probe "<subject>" "<concept>" <explain|apply> <0-100>
   ```
4. Write calibrated findings (known / shaky / blank, per concept) into `audit.md`, replacing the learner's guesswork.

## Worked probe — concept: "database index", rising difficulty
> **L1 recall (explain):** "What's a database index for?" → "speeds up lookups." ✓ keep climbing.
> **L2 mechanism (explain):** "Why is it faster — what's the structure?" → "a sorted tree, fewer hops." ✓ still climbing.
> **L3 trade-off (explain):** "When does an index *hurt*?" → "…not sure." ✗ fell off here.
> **L4 apply:** not reached.
>
> **Placement:** solid on *what* + *mechanism*, blank on *trade-offs*. Score the `explain` ~60 (knows it, real gap) → concept marked **shaky**, not proven. The L3 fall-off is the gap `plan` should target.

Don't stop at the first right answer — an easy question only proves the floor. Climb until they miss.

## Scoring guide — what a probe score means
- **85–100** — handled mechanism *and* trade-offs / edge cases. Proven.
- **70–84** — solid core, minor gaps. Proven, note the edge.
- **40–69** — knows the *what*, not the *why*. Shaky — do NOT mark proven.
- **0–39** — recall only, or wrong. Blank.

## Gate — placement caps at proficient
A passing probe marks a concept **proven**, lifting a senior learner immediately — but a single session reaches at most **proficient**. Expert needs a real build plus durability over time (long retention, or evidence spread across many days), which one session can't fake. The engine enforces this; don't imply otherwise.

## Set a target (optional)
If the learner aims higher than they place, focus the watcher on the gap:
```bash
bun src/learn-it.ts target "<subject>" <competent|proficient|expert>
```

## NEVER
- Stop at the first correct answer · let a confident claim pass unprobed · inflate to be kind · declare expert from one session.

## Hand-off
Placed → `plan` (lock the roadmap), or straight to `concept`/`review` on the shaky/blank concepts.
