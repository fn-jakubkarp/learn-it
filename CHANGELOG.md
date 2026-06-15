# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/); the project is
pre-1.0, so the public surface may still shift.

## [Unreleased]

### Fixed

- **FSRS now uses real elapsed time.** The scheduler fed the *scheduled* interval
  into the forgetting curve instead of the actual days since the last review, so
  off-schedule reviews were mis-modeled. It now tracks `last_reviewed` and uses
  `today − last_reviewed`. As a direct consequence, **same-day re-grading can no
  longer manufacture "proven" retention** — a 0-day gap yields retrievability 1.0,
  the stability increment collapses to 0, and the logged `interval_before` stays 0,
  so it never crosses the 21-day proven bar. This closes the main gap in the
  "mastery can't be gamed" thesis.
- **`mastered_at` no longer latches phase.** Phase now re-derives from the live
  tier, so expanding a roadmap after reaching expert re-opens the subject instead
  of reporting "done" forever.
- **Coverage requires engagement.** A concept counts as covered only once a card
  has been reviewed (or it has passing evidence) — bare unreviewed cards no longer
  nudge the tier gates.
- **Friendly errors & robust paths.** A missing database or a bad card id now
  prints guidance instead of a raw stack trace; the DB path resolves relative to
  the source files, so the CLI works from any directory and never silently forks a
  fresh empty database.
- Foreign-key enforcement is on; WAL + `busy_timeout` make rapid back-to-back CLI
  invocations safe.

### Added

- **Card & concept management:** `show`, `editcard`, `delcard`, `delconcept`,
  `suspend`, and `ungrade` (undo the last grade by replaying the recall log).
- **Session notes — the conversational stream:** `note` / `sessions` capture an
  LLM-authored summary at the end of a working session; `resume` surfaces the
  latest per subject so the next session resumes with context. Flashcards are one
  stream, not the whole tool.
- **`export`** emits the full learner state as JSON — the read surface an external
  dashboard consumes (the engine still owns the database).
- **`doctor`** health check: schema, pragmas, grader provenance, orphan/suspended
  counts.
- **Test suite** (`bun test`) for the scheduler, mastery ladder, and lifecycle —
  including the anti-grind invariant and the expert-gate boundaries — plus a CI
  workflow running Biome + `tsc` + tests on every push and PR.

### Earlier

- Replaced the SM-2 scheduler with FSRS v4 (`feat(scheduler)`).
- Refute-first assessment/rubric templates; grader provenance on every score.
- 2-tier subjects → concepts model with append-only `reviews` + `evidence`.
