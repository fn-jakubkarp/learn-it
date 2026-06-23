---
stage: review
phase: recall
gate: recall
description: Daily active-recall quiz over due cards, graded by meaning, rescheduled by FSRS.
---

**Goal:** retrieve, don't re-read. The learner pulls the answer from memory — that effortful retrieval IS the encoding. A card read off the screen taught nothing.

**Inputs:** the `due` queue — already interleaved across concepts (round-robin). Do NOT reorder; the contextual interference is deliberate (Rohrer & Taylor).

## Loop — one card at a time
1. Show the question alone. No hint, no answer visible.
2. **The learner must type a full answer.** No "I know this", no skipping — an untyped card is not a recall.
3. Grade 0–5 by **meaning**, tolerant of typos and phrasing.
4. Record it (pin the grader):
   ```bash
   LEARN_IT_GRADER="<your-model-id>" bun src/learn-it.ts grade {cardId} {0-5}
   ```

## The grade scale
| Grade | Meaning | FSRS |
|------|---------|------|
| 0–2 | blanked, or wrong on the core idea | Again |
| 3 | recalled the gist, but slow / shaky / partial | Hard |
| 4 | correct, minor stumble | Good |
| 5 | instant, complete, effortless | Easy |

## Worked grades — judge meaning, not wording
> **Card:** "Why does an index slow writes?"
>
> - Answer: "because every insert has to update the index too" → **5**. Right mechanism, instant.
> - Answer: "umm i think the index thing needs updating when you add rows" → **4**. Correct, informal, slight hesitation. Typos and casual phrasing don't lower it.
> - Answer: "it makes writes slower" → **2 (Again)**. Restates the question — the *what*, not the *why*. No mechanism = not recalled.
> - Answer: "because reads get faster" → **0–1**. Wrong — swapped reads and writes. Goes to the feedback gate.

## Gate — on a miss (grade < 3), teach before the next card
The single highest-leverage moment in the loop. Give SHORT elaborative feedback:
- the **actual misconception** ("you swapped reads and writes"), not just "incorrect",
- the **correct model** in 1–2 lines ("writes slow because the index must be updated too"),
- a **discriminating cue** that separates this card from the one it was confused with.

> **Example:** miss on the index card → "Close, but that's the read side. Writes slow because each insert *also* updates the index. Cue: reads *use* the index, writes *maintain* it." → next card.

A correction, not a lecture. Then move on.

## NEVER
- Accept "I know it" for a typed answer · reveal the answer before they commit · reorder or filter the queue to soften it · let casual phrasing lower a correct answer.

## Hand-off
Queue empty → at `verify`, suggest `feynman`/`exam`; else report what's next due and stop.
