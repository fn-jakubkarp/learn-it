# 🧠 Learn-it -- AI Mastery Pipeline

*Learn new skills, evaluate your knowledge gaps, and upskill effectively.*

Recognition isn't the same as recall. You can recognize an answer when you see it, but can you retrieve it from memory without cues? Learn-it is designed to help you learn in a way that ensures deep understanding and long-term retention, not just surface-level familiarity.

## 🚀 About The Project

Your brain is lazy. It will trick you into thinking that recognizing information means you actually know it.

Learn-it solves this by using the best learning practices from cognitive psychology and education science and bringing them to your AI. 

**Learn-it** is a tool that helps you learn smarter by generating personalized learning paths and applying proven, science-backed methodologies like spaced repetition and active recall.

Whether you are mastering a new programming language, preparing for medical exams, or just learning a new hobby, Learn-it structures your process to ensure knowledge goes straight into your long-term memory.

## 🧬 Core Methodology

Learn-it is built around a 6-step framework based on how the human brain naturally processes, encodes, and consolidates information:

### 1. Diagnosis & Roadmap Architecture
* **Evaluate current knowledge & missing gaps:** Before you start, you need an audit of what you know and what you don't.
* **Prepare an upskilling path:** Learn-it breaks down massive subjects into digestible chunks, creating a tailored study plan to prevent cognitive overload.

### 2. Conceptual Understanding
* **Conceptualize:** Don't memorize facts until you understand the underlying mechanisms. Build the "big picture" and connect new concepts to things you already know. 

### 3. Anchoring Facts
* **Use mnemonics:** For raw data that can't be deduced logically (names, dates, syntax), use techniques like the Memory Palace or acronyms to glue the facts into your working memory.

### 4. Active Recall — through many surfaces
* **Ditch passive reading:** Rereading notes gives an illusion of competence; the engine credits it as recognition only, never as proof.
* **Retrieve, however fits:** the real work is pulling a concept *from memory* — by re-explaining it (Feynman), answering a sharp quiz question, doing a small real task, or reviewing a card. **Flashcards are one surface, not the point.** Each is a retrieval that strengthens the trace.

### 5. Spaced Repetition — on concepts, any surface
* **Consolidate knowledge:** memory is built by forgetting and re-retrieving, spaced out over time.
* **The concept is the unit.** Each *concept* carries its own schedule (FSRS — the modern successor to SM-2 Anki adopted), advanced by whichever surface you reinforce it with — re-explain, quiz, re-read, or a card. `reinforce` surfaces the concepts that have gone stale, weakest first; you keep them alive by *varying* how you hit them. (Weights are FSRS v4 defaults, not yet fitted to you, so the ~90% recall target is approximate.) Spacing uses the **real time elapsed**, so grinding the same day moves nothing — only genuine retention across real gaps counts.

### 6. Brutal Verification & Transfer
* **Real-world scenarios:** Try to explain the topic simply, applying it to real-life examples (The Feynman Technique). 
* **Exam yourself:** Test your knowledge in conditions similar to the real environment.
* **Rule #1: Do not cheat yourself.** If you think "I know this, I don't need to say it out loud" — you are falling for the illusion of knowledge. Always force a complete answer.

## 🗂️ Ownership Model

Learn-it keeps three concerns apart so the engine never overwrites your thinking, and so your progress always has a single source of truth.

**Knowledge — you author, the engine only reads:**
- `subjects/{subject}/audit.md` — your knowledge-gap self-assessment.
- `subjects/{subject}/notes.md` — your explanations and conceptual links.
- `subjects/{subject}/roadmap.md` — the study plan you agreed to.
- `subjects/{subject}/assessments/*.md` — issued tasks + your submissions.

**State — the engine owns this; don't hand-edit:**
- `data/learn_it.db` — the source of truth for cards, the recall log, and mastery evidence. (A subject's *phase* and *tier* aren't stored — they're computed from your Knowledge + State, so they can't be faked.)

**Engine — versioned logic and prompts:**
- `stages/*.md` — the instructions for each learning stage.
- `templates/*` — fixed assessment + rubric structures (so scoring doesn't drift).
- `src/*.ts` — router, scheduler, mastery, and SQLite bridge.

**The one rule:** the engine writes *State*, reads *Knowledge*, and never edits a file you authored.

## 🧱 Subjects & concepts (2-tier)

"Topic" is two different sizes of thing, so Learn-it splits them:

- **Subject** — the thing you *master*: "Rust", "Computer Networking". Carries the roadmap, the phase, and the **mastery tier**.
- **Concept** — a lesson-sized leaf under a subject: "ownership", "IP address types". Cards attach here. A concept is *retained-or-not* — it has no tier.

The **roadmap is the concept list**, and mastery rolls up from it. So *"types of IP addresses"* isn't a subject you become "expert" in — it's a concept under the *Networking* subject. You can't become an expert in a single fact.

## 🔄 The Learning Map (not a railroad)

The phases mirror how memory is built — but they're a **map a watcher reads, not rails you ride**. You learn how you want; Learn-it gives you the tools and a mentor watching over you.

```
diagnose → conceptualize → recall → space → verify → mastered
```

- **Run any stage on demand.** Nothing is blocked. If you jump ahead, the watcher *nudges* ("you've reviewed 0 cards — an exam now tests little") and lets you decide.
- **Phase is inferred, never set by hand.** Learn-it reads your real state — audit filled? concepts planned? cards made? cards reviewed? — and works out where each subject sits. No cursor to advance, nothing to desync.
- **Many subjects at once.** Run Rust, networking, and cooking in parallel; each sits at its own phase. The review queue interleaves due cards across all of them — which is exactly how spaced repetition is supposed to work.

| Phase | Suggested stage | What happens |
|-------|-----------------|--------------|
| `diagnose` | `init`, `plan` | Audit your gaps; turn the audit into a roadmap of concepts. |
| `conceptualize` | `concept`, `extract` | Build the big picture by analogy and mechanism, then extract it into cards. (`anchor` is an optional tool for gluing raw facts — syntax, names — with mnemonics.) |
| `recall` / `space` | `review` | The scheduler quizzes you on due cards and reschedules. |
| `verify` | `feynman`, `exam` | Teach it back; pass hard assessments to reach `mastered`. |

## 🏅 Mastery (earned, harsh, honest)

Each **subject** has a **mastery tier** on the Dreyfus ladder — deliberately hard to climb, because real expertise is. Knowing how to write a `for` loop makes you a *novice*, full stop.

```
novice → advanced-beginner → competent → proficient → expert
```

- **You cannot grind your way up.** Volume — more cards, more reviews, more hours — never lifts a tier. Climbing needs **proven retention** (recalling a concept *after a long gap*, not the same day) and **evidence that isn't flashcards**: explaining it, applying it to new problems, and — for expert — **building something real**. 100 cards with zero retention? Still advanced-beginner.
- **Flashcards are one stream, not the score.** Mastery is medium-agnostic. A passing *build* is required to reach expert; cards + exams alone cap you at proficient. So someone who ships real work ranks high; someone with a thousand cards and no application does not.
- **The score is un-gameable.** It's computed from an append-only log of what you actually did — every graded recall, every assessment scored against a fixed rubric. Never self-reported, so editing a file can't fake it. (Gaming your own score *is* the illusion of competence — the thing this tool exists to defeat. And a chat CLI can't watch you study, so it only ever credits what you *demonstrate to it*.)
- **You don't always start at novice.** A diagnostic (`explore-topic` maps the subject; `explore-gaps` *tests* you across it) places you at your real level — so a senior upskilling doesn't grind through what they already know. Placement is still **earned, not declared**: you only rise by demonstrating it in the probe. A single diagnostic can reach up to **proficient**; expert still demands a build + durability over time.
- **The watcher helps you get there.** Set a `target` tier and `mastery` focuses on the gap to it; `assess` issues a structured task aimed at the one thing blocking your next step.

```bash
bun src/learn-it.ts probe   "rust" "ownership" apply 85   # diagnostic: place at real level
bun src/learn-it.ts target  "rust" expert                 # what you're aiming for
bun src/learn-it.ts mastery "rust"                         # tier, gap to target, what's blocking
bun src/learn-it.ts assess  "rust" apply                   # issue an assessment from a template
bun src/learn-it.ts evaluate "rust" apply 85               # grade a submission → logged evidence
```

**Rewards are informational, not currency.** No points, badges, or streak pressure — those quietly replace *wanting to understand* with *wanting the number to go up*. Instead, the system names genuine milestones: a concept surviving 30 days, an assessment passed, a tier earned. A tier-up is rare, and it's supposed to feel like one.

## 📝 Assessments (structured, not improvised)

Home assessments aren't "review 5 cards," and they aren't freely improvised by the AI — that would make scoring drift. Each runs a fixed loop:

```
assess (issue from template) → you submit → evaluate (score vs rubric) → evidence → mastery
```

- `templates/assessment/{explain,apply,build}.md` — fixed task structure (the AI fills only the question).
- `templates/rubric/{explain,apply,build}.md` — fixed scoring dimensions + scale (the AI can't make up its own).
- `subjects/{subject}/assessments/{date}-{kind}.md` — the issued task, your submission, and the result.

`build` is the milestone tier — a small but real artifact, interrogated before it's scored. It's the only path to the evidence an `expert` rating requires.

## 💬 More than flashcards

Cards are **one** stream, not the point. Most real learning here happens by *talking* — explaining a concept back, getting probed on a new problem, defending a build. So the engine keeps a **conversational stream** beside the cards:

- **Session notes.** At the end of a working session the mentor records what you covered, where you struggled, and what to revisit (`note`); the dashboard and `resume` surface the latest one, so the next session — even a pure back-and-forth with no card review — picks up with context instead of starting cold.
- **Manage your own material.** `show`, `editcard`, `delcard`, `delconcept`, `suspend` (pause a leech), and `ungrade` (undo a mis-grade — the recall log is replayed to restore exact state).
- **A dashboard.** `bun src/dashboard.ts` serves a tiny local web dashboard (no build, no dependencies) at `http://localhost:4321`: every subject with its tier, phase, due count, and last session note (the stateful watcher), plus a flashcard review engine — read a question, reveal the answer, rate it, and the card reschedules. Under the hood it just calls the same CLI, so the engine still owns the data. (Card grades there are self-graded practice, logged as grader `dashboard`; tiers are still earned through AI-graded assessments.)
- **Or wire your own.** `export` dumps your full state as JSON; `doctor` checks the database's health.

```bash
bun src/dashboard.ts                              # open http://localhost:4321
bun src/learn-it.ts note "rust" "Covered ownership + moves; shaky on lifetimes. Next: borrow checker."
bun src/learn-it.ts export "rust" > rust.json     # raw JSON for your own viewer
bun src/learn-it.ts doctor                         # health check
```

## ⚙️ The Engine

| File | Role |
|------|------|
| `src/learn-it.ts` | Session router — dashboard, watcher, concepts, cards, assess/evaluate, mastery, session notes, `export`, `doctor`. |
| `src/lifecycle.ts` | The phase map: infers a subject's phase and advises (never blocks). |
| `src/scheduler.ts` | FSRS core for flashcards; logs every recall to `reviews` against **real elapsed time**. |
| `src/exposure.ts` | Concept-level spaced exposure: each concept's clock, advanced by any surface (re-explain / quiz / re-read / card). The `reinforce` queue lives here. |
| `src/mastery.ts` | Dreyfus tiers, rolled up over concepts + evidence (no volume credit). |
| `src/init-db.ts` | Creates / migrates the SQLite schema (FKs + WAL on). |
| `src/dashboard.ts` | Build-free local web dashboard (`bun src/dashboard.ts`). |
| `data/learn_it.db` | `subjects`, `concepts`, `flashcards`, append-only `reviews`, `exposures`, `evidence`, and `sessions`. |
| `stages/*.md`, `templates/*` | Stage instructions and fixed assessment/rubric structures. |
| `skills/learn-it/SKILL.md` | The `/learn-it` skill that drives the CLI conversationally. |

## 💻 Getting Started

```bash
bun install
bun src/init-db.ts                     # create the database

bun src/learn-it.ts init "rust"        # start a subject (fill its audit.md)
bun src/learn-it.ts init "networking"  # and another — run as many as you like
bun src/learn-it.ts                     # dashboard: every subject, its tier + what's due
```

Then drive it conversationally with the skill: `/learn-it` shows the dashboard across all your subjects; `/learn-it plan rust` turns your audit into a roadmap of concepts; `/learn-it review` runs today's due cards, interleaved across everything.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## 🙏 Acknowledgements

The skill-router and per-stage prompt scaffold draws inspiration from [career-ops](https://github.com/santifer/career-ops) (MIT, © Santiago Fernández de Valderrama). Learn-it's methodology, scheduling engine, and domain logic are its own.

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.
