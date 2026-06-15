---
name: learn-it
description: Cognitive learning engine -- subjects broken into concepts, a watcher that tracks many subjects at once, an FSRS scheduler, and harsh per-subject mastery scored from logged performance. Tools, not rails.
arguments: stage
user_invocable: true
argument-hint: "[ (no args = resume) | init | explore-topic | explore-gaps | plan | concept | anchor | extract | review | feynman | exam | assess | evaluate | mastery ]"
---

# learn-it -- Session Router

Learn-it gives the learner **proper tools and a watcher**, not a railroad.

**Structure (2-tier):** a **subject** is the thing you master ("Rust", "Networking") — it carries the roadmap, the phase, and the Dreyfus mastery tier. A **concept** is a lesson-sized leaf under it ("ownership", "IP address types") — cards attach to concepts; a concept is retained-or-not, it has no tier of its own. The roadmap IS the concept list.

The phases (`diagnose -> conceptualize -> recall -> space -> verify -> mastered`) are a **map**, not a locked sequence (`anchor` is an optional tool, not a phase — mnemonics for raw facts only). The learner can:

- run **several subjects at once**, each at its own phase;
- run **any stage on demand** — nothing is blocked;
- interleave review across all subjects (that is how spaced repetition works).

A subject's phase is **inferred** from real state (audit filled? concepts planned? cards? reviews?) — never set by hand. The `stages/` prompts say how to run each stage.

## Mandatory Context

```bash
bun src/learn-it.ts            # dashboard: every subject, its tier, phase, due count
```

## The watcher (advise, never block)

```bash
bun src/learn-it.ts advise {stage} "{subject}"   # "OK (phase: ...)" or "NOTE: <nudge>"
```

It **never refuses**. On a `NOTE`, surface it ("you have 0 reviews — an exam now tests little"), then **honor the learner's choice**. There is no `advance` — phase follows reality.

## Cards are one stream, not the point

Most learning here is **conversation** — explaining, being probed, defending a build — not card drills. Run `probe`, `feynman`, `assess`/`evaluate` freely; a learner who never touches a flashcard can still climb to proficient on demonstrated evidence. Use flashcards for the raw, recall-able facts; use dialogue for everything else.

## End a working session with a note

Before you wrap up, capture continuity so the next session (which may be pure dialogue) resumes with context — not a cold start:

```bash
bun src/learn-it.ts note "{subject}" "{what was covered, where they struggled, what to revisit}"
```

`resume` shows the latest note per subject; `sessions "{subject}"` lists the history. Keep it to one or two sentences, concrete.

## Managing material (fix mistakes, don't live with them)

```bash
bun src/learn-it.ts show {id}                 # see a card's stored Q + A + scheduling
bun src/learn-it.ts editcard {id} "{q}" "{a}" # fix a typo (scheduling unchanged)
bun src/learn-it.ts ungrade {id}              # undo the last grade (state is replayed back)
bun src/learn-it.ts suspend {id} [on|off]     # pause a leech without losing its history
bun src/learn-it.ts delcard {id}              # remove a card (and its recall log)
```

Use `show` to grade a recall against the **stored** answer rather than your own memory of it.

## Pin the grader (provenance)

Every score comes from **you**, an LLM grader — the soft spot in "un-gameable" mastery. So **prefix every grading command with the model you are running as**, so each score records its own provenance and a weak/old grader can be spotted and re-graded:

```bash
LEARN_IT_GRADER="<your-model-id>" bun src/learn-it.ts evaluate ...   # e.g. claude-opus-4-8
```

Applies to **`grade`, `evaluate`, and `probe`**. Set it inline on each call — a one-off `export` does not survive across commands. An unset grader logs `unpinned`, and `mastery` flags how many scores lack provenance; re-grade those with a pinned model when you can.

## Diagnose before you teach (placement, not self-report)

A learner can't list what they don't know, and an experienced learner shouldn't start at novice. So after `init`, **don't trust the audit** — explore:

1. **explore-topic** — map the subject into concepts (`addconcept`), so even unnamed gaps are on the map.
2. **explore-gaps** — *test* the learner across that map at rising difficulty and record concept-level evidence with `probe`. A passing probe marks a concept proven and lifts the learner to their real level — up to **proficient** (expert still needs a build + durability over time).

```bash
LEARN_IT_GRADER="<your-model-id>" bun src/learn-it.ts probe "{subject}" "{concept}" <explain|apply> {0-100}
bun src/learn-it.ts target "{subject}" <competent|proficient|expert>   # what they're aiming for
```

Set a `target` for upskillers so `mastery` focuses on the gap between where they are and where they want to be, instead of re-teaching what they already know.

## Home assessment (always actionable)

Never hand back "review 5 cards." Issue a structured task from a template, then design the *content* to hit the learner's weak spots:

```bash
bun src/learn-it.ts assess "{subject}" [explain|apply|build]
```

`assess` copies the right template into `subjects/{subject}/assessments/{date}-{kind}.md` (kind defaults from the phase) and reports the weakest cards + the next-tier gap. **Fill in the `## Task` section** of that file with a concrete, varied prompt — explain *why* from memory, apply it to a NEW problem, debug a broken example, or (milestone) build something real. Keep the file's structure; only the question is yours. The learner writes their answer into the file.

## Evaluate (turn a submission into evidence)

After the learner submits, grade it **against the rubric template** and record it:

```bash
LEARN_IT_GRADER="<your-model-id>" bun src/learn-it.ts evaluate "{subject}" <explain|apply|build> <score 0-100> [file]
```

Score each rubric dimension (see `templates/rubric/{kind}.md`) — do not invent your own scale. `>= 70` passes. This logs evidence that feeds mastery; a passing **build** is required to reach expert.

**Grade as a skeptic, not a fan.** You default to agreeing with the learner — that sycophancy is exactly what makes a self-graded score worthless. Every rubric opens with a *refute-first* step: attack the answer before you score it, and score only what survives. **For any evidence that would promote a tier** (a `build`, an `explain` at the expert gate, or an `apply` scoring 90+), grade it **twice, independently, and record the lower score** — a second skeptical pass is cheap insurance against a number that unlocks expert.

## Mastery & rewards (earned, harsh, honest)

Mastery is computed in the database from logged performance (`reviews` + `evidence`) — never self-reported, so it cannot be gamed. Tiers follow the Dreyfus ladder and are **brutal by design**: volume never lifts a tier. Climbing needs proven retention (concepts recalled after long gaps) and higher-Bloom evidence — and **expert is unreachable without a real build**.

```bash
bun src/learn-it.ts mastery "{subject}"     # tier, % to next tier, exactly what's blocking
```

**Reward = informational, never currency.** Name genuine milestones — a concept surviving 30 days, an apply assessment passed, a tier earned ("you recalled this cold after 30 days — durable long-term memory"). No points, badges, or streak pressure. A tier-up is rare and worth marking.

## Stages

### (no args) -- resume
- **Action**: `bun src/learn-it.ts` → dashboard across all subjects.

### /learn-it init {subject}
- **Action**: `bun src/learn-it.ts init "{subject}"`. Confirm `subjects/{subject}/audit.md` is ready to fill.

### /learn-it explore-topic {subject}
- **Action**: Read `stages/explore-topic.md`. Map the subject into concepts and register them (`addconcept`); write the map to `roadmap.md`. Refines the audit rather than trusting it.

### /learn-it explore-gaps {subject}
- **Action**: Read `stages/explore-gaps.md`. Probe the learner across the concepts at rising difficulty; record each with `probe` (places them at their real level, up to proficient). Write calibrated findings to `audit.md`; optionally set a `target`.

### /learn-it plan {subject}
- **Action**: Read `stages/plan.md` + `subjects/{subject}/audit.md`. Write `subjects/{subject}/roadmap.md`, then **register every roadmap leaf as a concept** (coverage and mastery measure against these):
  ```bash
  bun src/learn-it.ts addconcept "{subject}" "{concept}"
  ```

### /learn-it concept {term}
- **Action**: Read `stages/concept.md`. Explain via analogy and mechanism (no dry definitions). Append insights to `subjects/{subject}/notes.md`.

### /learn-it anchor {facts}
- **Action**: Read `stages/anchor.md`. Build mnemonics (palace / acronym / story) for raw facts.

### /learn-it extract {subject}
- **Action**: Read `stages/extract.md`. Turn notes + mnemonics into Q/A pairs, each tied to a concept:
  ```bash
  bun src/learn-it.ts addcard "{subject}" "{concept}" "{question}" "{answer}"
  ```

### /learn-it review [subject]
- **Action**: Read `stages/review.md`. The `due` queue is **interleaved across both subjects and concepts** (consecutive cards come from different concepts where possible — that contextual interference is deliberate). One at a time, grade the typed answer 0-5:
  ```bash
  bun src/learn-it.ts due ["{subject}"]
  LEARN_IT_GRADER="<your-model-id>" bun src/learn-it.ts grade {cardId} {0-5}
  ```
- **Rule**: the learner must type a full answer. No "I know this" shortcuts.
- **On a miss (grade < 3): teach, don't just reschedule.** Before the next card, give short *elaborative* feedback — why the answer was wrong, the correct mental model, and a cue that discriminates this card from the one it was confused with. A bare "wrong, next" wastes the most valuable moment in the loop (corrective feedback is one of the highest-leverage interventions there is). Keep it tight; then move on.

### /learn-it feynman {subject}
- **Action**: Read `stages/feynman.md`. Reverse roles: the learner teaches, you play the novice and probe gaps. Record it as explain evidence:
  ```bash
  LEARN_IT_GRADER="<your-model-id>" bun src/learn-it.ts evaluate "{subject}" explain {0-100}
  ```

### /learn-it exam {subject}
- **Action**: Read `stages/exam.md`. Run a hard, scored test on a NEW problem. Record it as apply evidence, then report mastery:
  ```bash
  LEARN_IT_GRADER="<your-model-id>" bun src/learn-it.ts evaluate "{subject}" apply {0-100}    # >= 90 needed toward expert
  ```
