---
stage: exam
phase: verify
gate: verify
description: A hard, scored test on a NEW problem — recorded as apply-evidence toward mastery.
---

**Goal:** prove **transfer** — apply the skill to a situation the learner has never seen, under pressure. Reciting a studied card is not transfer; solving a new problem with the idea is.

**Inputs:** the subject and its weak / target concepts.

## Method
1. Pose a hard, practical problem on a **new** situation — write the algorithm, solve the case, debug the broken example.
2. Timebox it; pressure is part of the test.
3. Score against `templates/rubric/apply.md`, refute-first — credit only what works for the *right reason*:
   ```bash
   LEARN_IT_GRADER="<your-model-id>" bun src/learn-it.ts evaluate "<subject>" apply <0-100>
   ```

## Transfer vs recall — the whole point
> **Recall problem (NOT an exam):** "What does a database index do?" → they recite the card. Tests storage, not skill.
>
> **Transfer problem (this IS the exam):** "Here's a slow query on a 10M-row table: `WHERE email = ? AND active = true`. It isn't using the index. Diagnose why, propose a fix." → they must apply the model to a situation no card covered.

The test for your own question: could the learner answer it by reciting a card? If yes, it's not an exam — make it novel.

## How to construct novelty
- Change the surface, keep the principle: new data, new constraints, a realistic mess.
- Combine two concepts they learned separately.
- Hand them a **broken** artifact and ask them to find the fault — debugging forces a real model.
- Add a constraint that rules out the memorized answer ("…and you can't add an index — now what?").

## Gate — double-grade anything that promotes
90+ on `apply` is a rung toward **expert**. So for any answer that *would* score 90+:
1. Grade it once against the rubric.
2. Grade it again, independently, from scratch — try harder to break it.
3. **Record the lower of the two.** A number that unlocks expert earns a second skeptical pass.

A high score unlocks nothing on its own — phase and tier just follow the recorded evidence.

## NEVER
- Reuse a problem the learner already studied · accept a memorized answer as transfer · soften the clock then call it an exam · credit a right answer reached by wrong reasoning.

## Hand-off
Scored → `mastery "<subject>"` for the tier and exactly what's still blocking the next one.
