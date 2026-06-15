# Contributing to learn-it

Thanks for your interest. learn-it is a small, opinionated tool; the bar is
correctness and honesty (see the invariants in `CLAUDE.md`).

## Setup

```bash
bun install
bun src/init-db.ts          # create / migrate data/learn_it.db
```

## The verification gate

Everything must be green before a commit. One command runs all of it:

```bash
bun run verify              # biome check  &&  tsc --noEmit  &&  bun test
```

CI runs the same gate on every push and PR (`.github/workflows/test.yml`).
If you touch the scheduler, the mastery ladder, or lifecycle inference, **add or
update a test** — those three are the correctness core and are pure/easy to test
(`tests/*.test.ts`).

## Conventions

- **Small, logical commits**, one concern each. Branch off `main`; merge after
  review. Push only when asked.
- **Never commit user data.** `subjects/`, `output/`, and `data/*.db` are
  gitignored and keep only their `.gitkeep`. Examples live in `examples/`.
- **Don't regress the core invariants** in `CLAUDE.md` — most importantly, mastery
  is computed from the logged `reviews` + `evidence` tables, never self-reported,
  and volume never lifts a tier.
- Match the surrounding style; Biome formats and lints (`bun run check:fix`).
