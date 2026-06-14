---
name: learn-it
description: Cognitive learning engine -- walk a topic through diagnose -> conceptualize -> anchor -> recall -> space -> verify, backed by an SM-2 spaced-repetition scheduler.
arguments: stage
user_invocable: true
argument-hint: "[ (no args = resume) | init | plan | concept | anchor | extract | review | feynman | exam ]"
---

# learn-it -- Session Router

Learn-it is a **lifecycle**, not a menu. Each topic walks an ordered set of
phases (`diagnose -> conceptualize -> anchor -> recall -> space -> verify ->
mastered`). The engine in `src/` owns the phase and the spaced-repetition
schedule; the prompts in `stages/` tell you how to run each stage.

## Mandatory Context

Before anything, resume the session to see the active topic, its phase, and
cards due today:

```bash
bun src/learn-it.ts            # resume: active topic + phase + due cards + next stage
```

## The gate rule

A topic can only run a stage its phase allows. Before running any stage, check:

```bash
bun src/learn-it.ts gate {stage} "{topic}"   # prints "OK" or "BLOCKED: <reason>"
```

If `BLOCKED`, tell the user what the engine reported and stop. When a stage's
work is finished, advance the lifecycle:

```bash
bun src/learn-it.ts advance "{topic}"        # moves the topic to the next phase
```

## Stages

### (no args) -- resume
- **Action**: `bun src/learn-it.ts`
- **Response**: Report due cards + active topic's phase, then point at the suggested next stage.

### /learn-it init {topic}
- **Action**: `bun src/learn-it.ts init "{topic}"`
- **Response**: Confirm `topics/{topic}/audit.md` is ready for the user to fill. (phase: `diagnose`)

### /learn-it plan {topic}
- **Gate**: requires a filled `audit.md`.
- **Action**: Read `stages/plan.md` and `topics/{topic}/audit.md`. Generate `topics/{topic}/roadmap.md`. Then `advance`.
- **Response**: Present the chunked roadmap. (phase -> `conceptualize`)

### /learn-it concept {term}
- **Action**: Read `stages/concept.md`. Explain via analogy and mechanism (no dry definitions). Append insights to `topics/{topic}/notes.md`.
- **Response**: When the big picture is solid, `advance` toward `anchor`.

### /learn-it anchor {facts}
- **Action**: Read `stages/anchor.md`. Build mnemonics (palace / acronym / story) for the raw facts.

### /learn-it extract {topic}
- **Action**: Read `stages/extract.md`. Turn notes + mnemonics into Q/A pairs and load each one:
  ```bash
  bun src/learn-it.ts addcard "{topic}" "{question}" "{answer}"
  ```
  (first card added auto-moves the topic to `recall`)

### /learn-it review [topic]
- **Action**: Read `stages/review.md`. Pull the due queue, present one card at a time, grade the user's typed answer 0-5:
  ```bash
  bun src/learn-it.ts due "{topic}"            # list due cards
  bun src/learn-it.ts grade {cardId} {0-5}     # apply SM-2, reschedule
  ```
- **Rule**: the user must type a full answer. No "I know this" shortcuts.

### /learn-it feynman {topic}
- **Action**: Read `stages/feynman.md`. Reverse roles: the user teaches, you play the confused novice and probe gaps. (phase: `verify`)

### /learn-it exam {topic}
- **Action**: Read `stages/exam.md`. Run a hard, timed/scored test. On a pass, `advance` to `mastered`.

## Status

```bash
bun src/learn-it.ts status     # all topics, their phase, and due counts
```
