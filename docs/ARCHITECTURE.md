# Architecture

learn-it is an AI learning pipeline built on cognitive science: spaced repetition (SM-2), active recall, the Feynman technique, Bloom's depth levels, and the Dreyfus skill-acquisition ladder. The agent is a **mentor with tools**, not a course on rails.

## 2-tier structure: subjects → concepts

"Topic" is two different sizes of thing, so they're split:

- **Subject** — the thing you *master*: "Rust", "Computer Networking". Carries the roadmap, the inferred phase, and the Dreyfus **mastery tier**.
- **Concept** — a lesson-sized leaf under a subject: "ownership", "IP address types". Cards attach here. A concept is *proven-or-not*; it has no tier.

The **roadmap is the concept list**. Coverage and mastery roll up from concepts, so you can't be "expert in a single fact" — that's just a concept under some subject.

## The engine (`src/`)

| File | Role |
|------|------|
| `init-db.ts` | SQLite schema: `subjects`, `concepts`, `flashcards`, append-only `reviews`, `evidence`. |
| `scheduler.ts` | SM-2 spaced repetition; every grade logs a `reviews` row with the interval the card survived. |
| `mastery.ts` | Dreyfus tiers computed from logged performance (no volume credit). |
| `lifecycle.ts` | Phase **map** (diagnose→…→mastered); infers phase from real state, advises but never blocks. |
| `learn-it.ts` | CLI router: dashboard, concepts, cards, probe, assess/evaluate, mastery, target. |

State (phase, tier) is **never stored** — it's computed from Knowledge (`subjects/<s>/*.md`, learner-authored) + the logged tables. The engine writes State, reads Knowledge, never edits a file you authored.

## The learning map (not a railroad)

```
diagnose → conceptualize → anchor → recall → space → verify → mastered
```

- **Any stage on demand.** Nothing is blocked; the watcher nudges when you jump ahead.
- **Inferred phase.** Audit filled? concepts planned? cards? reviews? applied evidence? → the phase follows.
- **Many subjects at once**, each at its own phase. The review queue interleaves due cards across all of them.

Stages live as prompts in `stages/*.md`; the skill router is `.agents/skills/learn-it/SKILL.md`.

## Diagnose before you teach

A learner can't list what they don't know, and an experienced one shouldn't start at novice. So after `init`:

1. **explore-topic** — map the subject into concepts (`addconcept`).
2. **explore-gaps** — *test* the learner across the map (`probe`), placing them at their real level. Placement is **earned** (logged evidence), never declared; a single session reaches at most **proficient**.

Set a `target` tier so the watcher focuses on the gap between where the learner is and where they want to be.

## Mastery (harsh, earned, un-gameable)

Dreyfus ladder: `novice → advanced-beginner → competent → proficient → expert`.

- Computed from the append-only `reviews` + `evidence` logs — never self-reported, so it can't be faked.
- **Medium-agnostic.** A concept is *proven* by retention (cards recalled after long gaps) **or** by passing higher-Bloom evidence (explain / apply / build). Flashcards are one stream, not the score.
- **Volume never lifts a tier.** Climbing needs proven concepts + demonstrated evidence.
- **Expert** additionally requires a passing **build** and **durability** — long-term retention OR passing apply/build evidence spread over real time (≥3 days, ≥30-day span).
- **Rewards are informational, not currency** — name genuine milestones (a concept surviving 30 days, a tier earned); no points/badges/streaks.

## Assessment loop (structured, not improvised)

```
assess (issue from template) → learner submits → evaluate (score vs rubric) → evidence → mastery
```

- `templates/assessment/{explain,apply,build}.md` — fixed task structure; the AI fills only the question.
- `templates/rubric/{explain,apply,build}.md` — fixed scoring dimensions + scale; the AI can't invent its own.
- `subjects/<subject>/assessments/<date>-<kind>.md` — the issued task, the submission, and the result.

A `build` is the milestone tier — a small but real artifact, interrogated before scoring; the only path to the evidence an expert rating requires.

## Honest limits

A chat CLI can't observe study that happens outside the conversation, and can't fully prevent a looked-up answer or a borrowed artifact. The agent acts as a witness/examiner — it credits only what's demonstrated to it, and probing ("why X? what breaks if Y?") makes evidence hard to fake — but this is mitigation, not proof.
