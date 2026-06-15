---
stage: extract
phase: conceptualize
gate: conceptualize
description: Turn filled-in notes (and any mnemonics) into question-answer flashcards, each tied to a concept.
---

**Goal:** convert understanding into **retrievable atoms** — cards that force the learner to *produce* an answer from memory, not *recognize* one. A card is a test, not a summary.

**Inputs:** `subjects/<subject>/notes.md` and any anchors built in `anchor`.

## Method
1. Read the notes for one concept. For each idea worth keeping, ask: "what is the single thing I want to be able to recall here?" That's one card.
2. Phrase the question so the answer must be **generated**, not picked from options or recognized in place.
3. Keep each card **atomic** — one fact, one answer. Split anything compound.
4. Attach every card to its roadmap **concept** and add it (it lands due immediately):
   ```bash
   bun src/learn-it.ts addcard "<subject>" "<concept>" "<question>" "<answer>"
   ```

## Worked example — one note line → three cards
> **Note:** "A B-tree index speeds reads (a few tree hops vs a full scan) but slows writes, because every insert must update every index, and each index costs disk space."
>
> That sentence is **three** cards, not one:
>
> | Question | Answer |
> |---|---|
> | Why does a B-tree index speed up reads? | The lookup walks a few sorted tree hops instead of scanning every row. |
> | Why does an index slow down writes? | Every insert/update must also update the index. |
> | What does an index cost in storage? | Extra disk — one copy of the sorted keys per index. |
>
> Each tests one idea; each answer is one retrievable thing.

## Good vs bad cards
- **Good (atomic, recall):** Q "Why does an index slow writes?" → A "every write must update the index." One idea, must be produced.
- **Bad (compound):** Q "Explain how indexes affect reads, writes, and storage." → can't be graded or scheduled cleanly; you half-know it forever.
- **Bad (recognition):** Q "Do indexes slow writes? (yes/no)" → 50% guess, tests nothing. No true/false, no multiple choice.
- **Bad (orphan):** a card with no concept never rolls into mastery — always attach one.

## Cloze when it fits
For a fact embedded in a phrase, a fill-in-the-blank is a clean atomic card:
> "FSRS schedules each card to a target recall probability of ___." → "0.9"

One blank per card — don't blank five words in one line.

## Checks before you save a card
- Could the learner get it right by **guessing**? → it's recognition, rewrite it.
- Does the answer hold **one** thing? → if not, split it.
- Is it tied to a **concept**? → if not, attach one.

## NEVER
- Recognition cards (true/false, multiple choice) · "list all N" mega-cards · cards with no concept · an answer that's a paragraph.

## Hand-off
Cards exist → `review` (start retrieving — don't wait for "perfect" notes).
