---
stage: plan
phase: diagnose
gate: diagnose
description: Turn the filled-in audit into a roadmap and seed the topic's metadata in SQLite.
---

This stage only runs once the user has filled in the template. The agent reads the file, compares it against the objective body of knowledge for the field, and generates the target `roadmap.md` file. At the same time it injects the initial metadata (the goal structure) into the local SQLite database.
