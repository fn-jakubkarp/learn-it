# CLAUDE.md — learn-it

AI learning pipeline (Bun + TypeScript + `bun:sqlite`, linted by Biome 2.5). Helps a learner upskill using cognitive-science methods: spaced repetition (SM-2), active recall, Feynman, Bloom depth, the Dreyfus skill ladder.

See `docs/ARCHITECTURE.md` for the design. (Design rationale / decision history is kept in private local notes, not in this public repo.)

## Core invariants — do not regress these

- **Mastery is computed from logged performance** (`reviews` + `evidence` tables), never self-reported. Gaming your own score is the illusion of competence the tool exists to defeat. It lives in `data/*.db`, not in markdown.
- **The watcher advises, never blocks.** Phase is *inferred* from real state (`src/lifecycle.ts`), not a stored cursor. Tools + a watcher, not rails.
- **2-tier structure.** A *subject* carries the Dreyfus tier; a *concept* is a leaf (cards attach to it, no tier). The roadmap is the concept list; mastery rolls up from concepts.
- **Mastery is medium-agnostic and harsh.** Flashcards are one stream. A concept is "proven" by retention OR demonstrated evidence. Volume never lifts a tier. **Expert requires a real build + durability** (long retention or evidence over time). A single diagnostic places at most *proficient* — placement is earned via `probe`, never declared.
- **Assessments use fixed templates** (`templates/assessment/*`, `templates/rubric/*`) so scoring doesn't drift — the AI fills only content, never the structure or scale.

## Conventions

- **Data hygiene:** `subjects/` and `output/` keep only their `.gitkeep` in the repo; never commit user data. Examples live in `examples/`. Never delete a `.gitkeep`.
- **Commits:** small and logical (one concern each). Branch off `main`, merge after the user approves, push only when asked.
- **Verify before committing:** `bunx biome check` (exit 0) and `bunx tsc --noEmit` must be clean.
- **Run:** `bun src/init-db.ts` then `bun src/learn-it.ts <cmd>` (resume|init|explore-topic|explore-gaps|plan|addconcept|addcard|probe|target|due|grade|assess|evaluate|mastery).
