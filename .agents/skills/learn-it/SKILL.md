---
name: learn-it
description: Cognitive learning engine -- a set of stages (diagnose, conceptualize, anchor, recall, space, verify) plus a watcher that tracks many topics at once and an SM-2 spaced-repetition scheduler. Tools, not rails.
arguments: stage
user_invocable: true
argument-hint: "[ (no args = resume) | init | plan | concept | anchor | extract | review | feynman | exam | assess | mastery ]"
---

# learn-it -- Session Router

Learn-it gives the learner **proper tools and a watcher**, not a railroad. The
phases (`diagnose -> conceptualize -> anchor -> recall -> space -> verify ->
mastered`) are a **map**, not a locked sequence. The learner can:

- run **several topics at once**, each at its own phase;
- run **any stage on demand** — nothing is blocked;
- interleave review across all topics (that is how spaced repetition works).

A topic's phase is **inferred** from what the learner has actually produced
(audit filled? roadmap? cards? reviews?) — never set by hand. The `stages/`
prompts say how to run each stage.

## Mandatory Context

Before anything, resume to see every topic's phase and what is due today:

```bash
bun src/learn-it.ts            # dashboard: all topics + phase + due + suggested next
```

## The watcher (advise, never block)

Before running a stage, ask the watcher whether it fits. It **never refuses** —
it prints `OK` or a `NOTE` nudge:

```bash
bun src/learn-it.ts advise {stage} "{topic}"   # "OK (phase: ...)" or "NOTE: <nudge>"
```

If it returns a `NOTE`, surface it to the learner ("you have 0 reviews — an exam
now tests little"), then **honor their choice**. They decide; you inform. There
is no `advance` — phase follows reality on its own.

## Home assessment (always actionable)

Never hand back "review 5 cards." Pull the inputs, then design ONE concrete,
varied task that targets the learner's weak spots:

```bash
bun src/learn-it.ts assess ["{topic}"]    # weakest due cards, phase, next-tier gap
```

`assess` reports the lowest-ease (hardest) due cards, the topic's phase, and the
single thing blocking the next mastery tier. Turn that into a generative task
matched to the phase — explain *why* without notes, apply it to a new problem,
debug a broken example, teach it back. Vary it day to day (desirable
difficulties); recognition is not recall.

## Mastery & rewards (earned, harsh, honest)

Mastery is computed in the database from logged performance — it cannot be
self-reported, so it cannot be gamed. Tiers follow the Dreyfus ladder
(novice -> advanced-beginner -> competent -> proficient -> expert) and are
**brutal by design**: volume never lifts a tier; only proven retention (cards
recalled after long gaps) and verification (exams, teach-backs) do.

```bash
bun src/learn-it.ts mastery "{topic}"     # tier, % to next tier, exactly what's blocking
```

**Reward = informational, never currency.** When the learner clears a real
milestone — a tier-up, a card surviving a long interval, a passed exam — name
the genuine achievement ("you recalled this cold after 30 days — that's durable
long-term memory"). Do NOT invent points, badges, or streak pressure; the felt
sense of growing competence is the reward. A tier-up is rare and worth marking.

## Stages

### (no args) -- resume
- **Action**: `bun src/learn-it.ts`
- **Response**: Show the dashboard across all topics; point each at its suggested next stage.

### /learn-it init {topic}
- **Action**: `bun src/learn-it.ts init "{topic}"`
- **Response**: Confirm `topics/{topic}/audit.md` is ready for the learner to fill.

### /learn-it plan {topic}
- **Action**: Read `stages/plan.md` and `topics/{topic}/audit.md`. Generate `topics/{topic}/roadmap.md`. (run `advise plan` first; an empty audit only earns a nudge, not a block.)
- **Response**: Present the chunked roadmap.

### /learn-it concept {term}
- **Action**: Read `stages/concept.md`. Explain via analogy and mechanism (no dry definitions). Append insights to `topics/{topic}/notes.md`.

### /learn-it anchor {facts}
- **Action**: Read `stages/anchor.md`. Build mnemonics (palace / acronym / story) for the raw facts.

### /learn-it extract {topic}
- **Action**: Read `stages/extract.md`. Turn notes + mnemonics into Q/A pairs and load each one:
  ```bash
  bun src/learn-it.ts addcard "{topic}" "{question}" "{answer}"
  ```

### /learn-it review [topic]
- **Action**: Read `stages/review.md`. With no topic the queue interleaves every topic's due cards. Present one at a time, grade the learner's typed answer 0-5:
  ```bash
  bun src/learn-it.ts due ["{topic}"]          # due cards (all topics if omitted)
  bun src/learn-it.ts grade {cardId} {0-5}     # apply SM-2, reschedule
  ```
- **Rule**: the learner must type a full answer. No "I know this" shortcuts.

### /learn-it feynman {topic}
- **Action**: Read `stages/feynman.md`. Reverse roles: the learner teaches, you play the confused novice and probe gaps. Score the teach-back 0-100 and record it (depth signal):
  ```bash
  bun src/learn-it.ts verify "{topic}" feynman {0-100}
  ```

### /learn-it exam {topic}
- **Action**: Read `stages/exam.md`. Run a hard, timed/scored test. Record the score (it feeds mastery; a high score can lift the topic to `expert`):
  ```bash
  bun src/learn-it.ts verify "{topic}" exam {0-100}    # >= 70 passes; >= 90 needed for expert
  ```
- After recording, run `mastery "{topic}"` and tell the learner where they now stand.
