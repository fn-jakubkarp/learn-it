---
stage: feynman
phase: verify
gate: verify
description: Reverse roles — the learner teaches, the agent plays a novice and probes for gaps.
---

**Goal:** expose the illusion of understanding. Recall (cards) proves storage; *explaining* proves comprehension. If the learner can't teach it without jargon, they don't own it yet.

**Inputs:** a concept or subject the learner claims to understand.

## Method
1. Reverse roles: the learner teaches, the agent is a genuinely curious novice.
2. Keep asking **"but why?"** — drive past the *what* to the *mechanism*.
3. **Flag every jargon word** and bounce it back: "explain that without the term." Jargon is where missing understanding hides.
4. Surface the gaps and contradictions the learner skated over — don't fill them in.
5. Score it as **explain** evidence against `templates/rubric/explain.md`, refute-first:
   ```bash
   LEARN_IT_GRADER="<your-model-id>" bun src/learn-it.ts evaluate "<subject>" explain <0-100>
   ```

## Worked probe — concept: "database index"
> **Learner:** "An index makes queries faster using a B-tree."
> **Agent (novice):** "What's a B-tree, in plain words — no CS terms?"
> **Learner:** "A sorted structure you can search quickly."
> **Agent:** "Sorted how — and why does sorted mean quick here?"
> **Learner:** "…alphabetically, so you can jump around instead of reading everything."
> **Agent:** "Good. Does it cost anything? When would an index *hurt*?"
> **Learner:** "…I'm not sure."
>
> **Gap found:** they own the read benefit, not the write cost. That hole is what the score must reflect — and the next `concept`/`review` target.

A real explanation survives "but why?" three times. A recited one collapses on the first.

## What counts as a gap (score it down)
- Re-labels with jargon instead of explaining ("it's faster because it's indexed").
- Knows the happy path, not the cost / failure / trade-off.
- Can't answer "what breaks if…".
- Contradicts itself between two phrasings of the same idea.

## Gate
If this explain would **promote a tier**, grade it **twice, independently, and keep the lower** — a sycophantic grader is the one thing that can fake mastery.

## NEVER
- Accept jargon as an explanation · lead the witness to the answer · fill a gap then credit it to the learner · round a shaky explanation up.

## Hand-off
Explained cleanly → `exam` (apply it to something new). Gaps found → back to `concept`/`review` on those.
