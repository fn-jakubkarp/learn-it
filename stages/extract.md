---
stage: extract
phase: anchor
gate: anchor
description: Convert filled-in notes and mnemonics into question-answer flashcards.
---

A purely mechanical operation. The agent scans your filled-in markdown notes, walks through the generated mnemonics, and formats them into raw question-answer pairs. The result lands directly in the `flashcards` table in SQLite with an interval of zero assigned.
