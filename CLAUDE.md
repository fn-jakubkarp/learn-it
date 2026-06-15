# CLAUDE.md — learn-it

AI learning pipeline (Bun + TypeScript + `bun:sqlite`, linted by Biome 2.5). Helps a learner upskill using cognitive-science methods: spaced repetition (FSRS), active recall, Feynman, Bloom depth, the Dreyfus skill ladder.

See `docs/ARCHITECTURE.md` for the design. (Design rationale / decision history is kept in private local notes, not in this public repo.)

## Core invariants — do not regress these

- **Mastery is computed from logged performance** (`reviews` + `evidence` tables), never self-reported. Gaming your own score is the illusion of competence the tool exists to defeat. It lives in `data/*.db`, not in markdown. Retention is measured against **real elapsed time** (`flashcards.last_reviewed`), so grading a card repeatedly the same day can't manufacture "proven" — a 0-day gap moves nothing.
- **The watcher advises, never blocks.** Phase is *inferred* from real state (`src/lifecycle.ts`), not a stored cursor. Tools + a watcher, not rails.
- **2-tier structure.** A *subject* carries the Dreyfus tier; a *concept* is a leaf (cards attach to it, no tier). The roadmap is the concept list; mastery rolls up from concepts.
- **Mastery is medium-agnostic and harsh.** Flashcards are one stream. A concept is "proven" by retention OR demonstrated evidence. Volume never lifts a tier. **Expert requires a real build + durability** (long retention or evidence over time). A single diagnostic places at most *proficient* — placement is earned via `probe`, never declared.
- **Cards are an addon, not the centre. Spacing lives on the CONCEPT** (`src/exposure.ts`), advanced by ANY surface — re-explain, quiz, re-read (recognition, capped), or a card. The core loop is diagnose → talk → plan → *spaced varied re-exposure* (`reinforce`), with substantive `assess` tasks for tier-moving evidence. Retrieval (explain/quiz/card) proves a concept; re-reading never does. Don't re-center the tool on flashcards.
- **Assessments use fixed templates** (`templates/assessment/*`, `templates/rubric/*`) so scoring doesn't drift — the AI fills only content, never the structure or scale.

## Conventions

- **Data hygiene:** `subjects/` and `output/` keep only their `.gitkeep` in the repo; never commit user data. Examples live in `examples/`. Never delete a `.gitkeep`.
- **Commits:** small and logical (one concern each). Branch off `main`, merge after the user approves, push only when asked.
- **Verify before committing:** `bun run verify` — `bunx biome check` (exit 0), `bunx tsc --noEmit`, and `bun test` must all be clean. Touching the scheduler / mastery / lifecycle? Add or update a test.
- **Run:** `bun src/init-db.ts` then `bun src/learn-it.ts <cmd>`. **CLI commands** (router cases): `resume`, `init`, `addconcept`, `concepts`, `delconcept`, `mark`, `advise`, `addcard`, `show`, `editcard`, `delcard`, `suspend`, `probe`, `target`, `due`, `due-concepts`(`reinforce`), `expose`, `grade`, `ungrade`, `note`, `sessions`, `assess`, `evaluate`, `mastery`, `export`, `doctor`. **Agent stages** (markdown prompts the skill reads, NOT CLI subcommands): `explore-topic`, `explore-gaps`, `plan`, `concept`, `reinforce`, `quiz`, `anchor`, `extract`, `review`, `feynman`, `exam` — these decompose into the CLI commands above. Don't conflate the two.
- **Dashboard:** `bun src/dashboard.ts` (`:4321`) — concept-first watcher + reinforcement queue + flashcard reader. Build-free `Bun.serve` over `src/dashboard.html`; its API shells the CLI (`export`/`grade`/`expose`/`note`). The static page is excluded from Biome.
- **Skill:** `skills/learn-it/SKILL.md` is the canonical router (symlinked into `.claude/skills/learn-it/` for project discovery; auto-discovered under `skills/` when installed as a plugin via `.claude-plugin/plugin.json`).
