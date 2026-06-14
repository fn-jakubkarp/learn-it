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

### 4. Active Recall
* **Ditch passive reading:** Rereading notes gives an illusion of competence. 
* **Quizzes & Flashcards:** Learn-it forces your brain to retrieve information from scratch. The physical act of reaching into your memory strengthens neural pathways.

### 5. Spaced Repetition
* **Consolidate knowledge:** Memory is formed through the process of forgetting and remembering. 
* **Optimized intervals:** Learn-it schedules your reviews based on the Ebbinghaus forgetting curve (e.g., 1 day, 3 days, 7 days, 14 days, 30 days) to lock knowledge into long-term memory.

### 6. Brutal Verification & Transfer
* **Real-world scenarios:** Try to explain the topic simply, applying it to real-life examples (The Feynman Technique). 
* **Exam yourself:** Test your knowledge in conditions similar to the real environment.
* **Rule #1: Do not cheat yourself.** If you think "I know this, I don't need to say it out loud" — you are falling for the illusion of knowledge. Always force a complete answer.

## 🗂️ Ownership Model

Learn-it keeps three concerns apart so the engine never overwrites your thinking, and so your progress always has a single source of truth.

**Knowledge — you author, the engine only reads:**
- `topics/{topic}/audit.md` — your knowledge-gap self-assessment.
- `topics/{topic}/notes.md` — your explanations and conceptual links.
- `topics/{topic}/roadmap.md` — the study plan you agreed to.

**State — the engine owns this; don't hand-edit:**
- `data/learn_it.db` — the source of truth for scheduling, card intervals, and each topic's current phase.

**Engine — versioned logic and prompts:**
- `stages/*.md` — the instructions for each learning stage.
- `src/*.ts` — router, scheduler, and SQLite bridge.

**The one rule:** the engine writes *State*, reads *Knowledge*, and never edits a file you authored.

## 🔄 The Learning Lifecycle

A topic isn't a bag of commands you run in any order — it **walks a sequence of phases** that mirror how memory is built. The engine records each topic's phase and refuses to run a stage the topic hasn't earned yet (no exam before you've recalled anything).

```
diagnose → conceptualize → anchor → recall → space → verify → mastered
```

| Phase | Stage | What happens |
|-------|-------|--------------|
| `diagnose` | `init`, `plan` | Audit your gaps; turn the audit into a roadmap. |
| `conceptualize` | `concept` | Build the big picture by analogy and mechanism. |
| `anchor` | `anchor`, `extract` | Glue raw facts with mnemonics; extract them into cards. |
| `recall` / `space` | `review` | The scheduler quizzes you on due cards and reschedules. |
| `verify` | `feynman`, `exam` | Teach it back; pass a hard test to reach `mastered`. |

## ⚙️ The Engine

| File | Role |
|------|------|
| `src/learn-it.ts` | Session router — resume, gate, advance, and the card commands. |
| `src/lifecycle.ts` | Phase order and the gating rules between stages. |
| `src/scheduler.ts` | SM-2 spaced-repetition core (intervals, ease, due queue). |
| `src/init-db.ts` | Creates the SQLite schema. |
| `data/learn_it.db` | Source of truth for phase + scheduling state. |
| `stages/*.md` | The instructions for each learning stage. |

## 💻 Getting Started

```bash
bun install
bun src/init-db.ts                       # create the database

bun src/learn-it.ts init "rust-ownership"   # start a topic (fill its audit.md)
bun src/learn-it.ts                          # resume: what to study right now
```

Then drive it conversationally with the skill: `/learn-it` resumes your active topic; `/learn-it review` runs today's due cards.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## 🙏 Acknowledgements

The skill-router and per-stage prompt scaffold draws inspiration from [career-ops](https://github.com/santifer/career-ops) (MIT, © Santiago Fernández de Valderrama). Learn-it's methodology, scheduling engine, and domain logic are its own.

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.
