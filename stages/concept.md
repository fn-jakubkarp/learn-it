---
stage: concept
phase: conceptualize
gate: conceptualize
description: Build the big picture by analogy and mechanism — no dry definitions.
---

**Goal:** install a durable *mental model* of one concept — the kind the learner can reason from, not recite. Coverage is not the goal; one concept understood beats five defined.

**Inputs:** a concept from the roadmap, plus whatever `explore-gaps` found about the learner's level on it.

**When to skip:** if the learner already applies it (a passing `apply` probe) or simply wants to be tested, go straight to `extract`/`probe`. This stage is for genuinely new or shaky concepts. Notes are never a gate.

**Before you teach — is the map diagnosed?** Don't slide from a partial diagnosis straight into a lesson. If most of the roadmap is still unprobed (`advise concept "<subject>"` will say so), surface it and let the learner choose: finish `explore-gaps` for accurate placement, or deliberately teach a *specific* known-weak concept now. Pick the weakest diagnosed concept to teach, not the first on the list. Never silently assume an untested concept is novel.

## Method
1. **Why does this exist?** Open with the problem the concept solves — what breaks, or what's painful, without it. Motivation before mechanism; an unmotivated concept doesn't stick.
2. **One analogy, fully mapped.** Pick a system the learner already knows and map it part-for-part. State the mapping explicitly — *and* state where it BREAKS. An unbounded analogy quietly teaches the wrong thing.
3. **Walk the mechanism causally.** Step through how it actually works, cause to effect. Introduce the formal term only *after* the idea lands — the word is a label for a thing they now understand, not the thing itself.
4. **Learner restates, in their words.** They explain it back and write that into `subjects/<subject>/notes.md`. Producing the explanation *is* the encoding (the generation effect) — so the learner writes it; the agent only corrects. Never author the note for them.

## Worked example — concept: "database index"
> **Why it exists:** "Find the user with email X among a million rows. With no help the DB reads every row — a full scan, slow and linear in table size. An index is how it skips that."
>
> **Analogy, mapped:** "Like the index at the back of a textbook — term → page, kept in sorted order so you jump instead of reading cover to cover.
> - back-index entry ↔ the indexed column's value
> - page number ↔ the row's location on disk
> - alphabetical order ↔ the index's sort order (a B-tree)
>
> **Where it breaks:** a book has one index; a table can carry many — and each one costs space and slows every write, because an insert must update every index. The textbook hides that cost."
>
> **Mechanism:** "The index keeps the column's values sorted in a tree; a lookup walks a few tree hops instead of a million row reads. *Now* the name — that tree is a B-tree, and the whole structure is 'the index'."
>
> **Restate check:** the learner explains, unprompted, *why an index speeds reads but slows writes.* If they can, the model landed.

This is the **move** to imitate, not a script to read. Swap in the concept at hand.

## Good vs bad analogy
- **Good (bounded):** "An index is a book's back-index — *and unlike a book, a table can hold many, each paid for on every write.*" Maps cleanly **and** names the limit.
- **Bad (unbounded):** "An index makes the database faster." No mechanism, and it silently implies indexes are free — the learner walks away thinking *more indexes = always better.*

## Pre-empt the common wrong models
Name the misconception out loud *before* the learner forms it, then correct it:
- "More indexes = always faster" → no: each one taxes writes.
- "The index stores the row" → no: it stores the sorted key + a pointer to the row.

Adapt to the concept; the move is "say the trap, then break it."

## Checks the model landed
- Learner answers a **"what breaks if…"** question (remove or change a part, predict the effect).
- Learner restates it **without the jargon**, then re-attaches the term cleanly.
- If either fails, the model is shallow — re-explain from a *different* angle. Don't move on.

## NEVER
- Open with a definition or the formal term · use an analogy you don't bound · cover more than ~3 ideas in one pass · write the learner's notes for them.

## Hand-off
Model landed and restated → `extract` (turn the note into recall cards). Or `anchor` if the concept rides on raw facts (syntax, names) that need a mnemonic.
