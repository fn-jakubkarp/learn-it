---
stage: quiz
phase: recall
description: One sharp recall/apply question on a concept, graded by meaning — a retrieval surface lighter than an assessment.
---

**Goal:** a quick retrieval check — *not* a full assessment. One question that forces the learner to pull the concept from memory or apply it in the small.

## Method
1. Ask ONE question on the concept — a "why / what-breaks-if / which-and-why", not a yes/no. No hints, no answer visible.
2. The learner answers from memory.
3. Grade 0–5 by **meaning** (tolerant of phrasing), then record it as a quiz exposure:
   ```bash
   bun src/learn-it.ts expose "<subject>" "<concept>" quiz <0-5>
   ```
4. On a miss, give short elaborative feedback before moving on.

## Where it sits
- A quiz is **retrieval** — it advances the concept's spaced clock and counts toward "proven" across real gaps (unlike re-reading).
- A quiz is **not** an assessment. Assessments are substantive, actionable deliverables ("build a class with one method that does X", "solve this new problem") graded against a rubric → `assess` / `evaluate`. Don't water those down into quizzes, and don't inflate a quiz into one.
