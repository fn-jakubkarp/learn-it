---
stage: reinforce
phase: space
description: Hit a due concept through the best surface — talk, quiz, re-read, or a card. Cards are one option, never the default.
---

**Goal:** keep proven concepts alive by spaced, *varied* re-exposure. This is the primary daily loop — diagnose → talk → plan put concepts on the map; `reinforce` is how you keep them. Flashcards are one surface among several, not the centre.

**Inputs:** `bun src/learn-it.ts due-concepts "<subject>"` — the concepts the engine says are due, weakest (blank → shaky → known) and most overdue first.

## Loop — one due concept at a time
1. Read its status and how overdue it is.
2. **Pick the surface that fits, and vary it** — alternating surfaces is itself a desirable difficulty:
   - **re-explain** (Feynman, micro): "explain X from memory — why does it work, what breaks without it?" Grade 0–5 by meaning →
     ```bash
     bun src/learn-it.ts expose "<subject>" "<concept>" explain <0-5>
     ```
   - **quiz**: one sharp recall/apply question (see `stages/quiz.md`) →
     ```bash
     bun src/learn-it.ts expose "<subject>" "<concept>" quiz <0-5>
     ```
   - **re-read**: point them at their own note for X. Recognition only — lowest credit, never proves a concept →
     ```bash
     bun src/learn-it.ts expose "<subject>" "<concept>" read
     ```
   - **cards**: if cards exist for the concept, run a short `review`; a graded card auto-records a card exposure.
3. On a weak showing, give short elaborative feedback (the misconception + correct model) before moving on.

## Rules
- **Prefer retrieval** (explain / quiz / cards) over re-reading. Re-reading keeps a concept warm but is recognition, not recall — the engine credits it least and it never proves a concept.
- Each exposure advances that concept's spaced clock; mastery counts retrieval **across real gaps** (same-day repeats move nothing).
- A quiz is **not** an assessment. For a substantive, actionable deliverable (build/apply something real) issue an `assess` instead.

## NEVER
- Default to flashcards · let re-reading masquerade as retrieval · grind the same concept repeatedly in one day to fake progress.
