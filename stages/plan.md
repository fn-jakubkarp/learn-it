---
stage: plan
phase: diagnose
gate: diagnose
description: Turn the filled-in audit into a roadmap of concepts and register them in the database.
---

This stage runs once the learner has filled in the audit. The agent reads it, compares it against the objective body of knowledge for the subject, and generates the target `roadmap.md` — broken into **concepts** (lesson-sized leaves).

Each concept on the roadmap must then be registered: `addconcept "<subject>" "<concept>"`. This concept list is what coverage and mastery are measured against, so the roadmap and the registered concepts must match. A concept is the unit a flashcard attaches to.
