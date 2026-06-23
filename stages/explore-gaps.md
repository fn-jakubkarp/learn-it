---
stage: explore-gaps
phase: diagnose
gate: diagnose
description: Probe the learner against the concept map to find real gaps and place them at their true level — not always novice.
---

**Goal:** placement by demonstration, not self-report. Self-assessment correlates weakly with real skill — people can't rank what they don't yet know — so **test**, don't ask. Find the real gaps, and lift an experienced learner to their true level instead of starting everyone at novice.

**Inputs:** the registered concept map (from `explore-topic`).

## Method — adaptive, ONE concept at a time
This is an interactive climb, not a questionnaire. Work **one concept per round**:
1. Ask **one** question at the lowest difficulty that's still worth checking. **Wait for the answer.**
2. Right? Climb: ask the next-harder question on the *same* concept (recall → mechanism → trade-off → apply). Wrong/unsure? You've found the **fall-off point** — stop climbing this concept; that gap is the signal.
3. Score that concept against the matching rubric (`templates/rubric/{explain,apply}.md`), **refute-first** — credit only what survives a skeptical read — then record it, grader pinned:
   ```bash
   LEARN_IT_GRADER="<your-model-id>" bun src/learn-it.ts probe "<subject>" "<concept>" <explain|apply> <0-100>
   ```
4. Move to the next concept and repeat. Cover the concepts worth checking before handing off.
5. Write calibrated findings (known / shaky / blank, per concept) into `audit.md`, replacing the learner's guesswork.

**Why one at a time:** batching questions kills adaptation — you can't pick the next difficulty without seeing the last answer, and the learner can't show *where* they fall off. A wall of questions across five concepts also reads as an exam, not a diagnosis.

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
- **40–69** — knows the *what*, not the *why*. Shaky — partial retrieval, so it counts as *covered* but NOT proven.
- **0–39** — recall only, or wrong. Blank — a **gap marker**, not coverage: a bombed probe never advances mastery (score honestly, don't pad a near-zero to 40 to be kind).

## Gate — placement caps at proficient
A passing probe marks a concept **proven**, lifting a senior learner immediately — but a single session reaches at most **proficient**. Expert needs a real build plus durability over time (long retention, or evidence spread across many days), which one session can't fake. The engine enforces this; don't imply otherwise.

## Set a target
**If the learner stated a goal, set it now** — don't leave it for later. An upskiller who says "I want a proper test suite" or "I'm aiming to be senior" is telling you their target; record it so `mastery` scores the gap to *there*, not re-teaching what they already know:
```bash
bun src/learn-it.ts target "<subject>" <competent|proficient|expert>
```
No stated goal → skip it; you can set it any time.

## NEVER
- Stop at the first correct answer · batch many questions or many concepts into one turn (kills the adaptive climb) · let a confident claim pass unprobed · inflate a blank to be kind · declare expert from one session.

## Hand-off
Diagnose the concepts worth checking **before** you start teaching — untested concepts place at novice, so teaching now risks boring the learner or skipping a missing prerequisite (the `concept` watcher will flag a half-diagnosed map). When the probe pass is done → `plan` (reconcile + order the roadmap). If you must stop early, **say so and let the learner choose**: finish diagnosing, or proceed deliberately on a specific known-weak concept.
