---
stage: extract
phase: anchor
gate: anchor
description: Convert filled-in notes and mnemonics into question-answer flashcards, each tied to a concept.
---

A purely mechanical operation. The agent scans the learner's filled-in markdown notes, walks through the generated mnemonics, and formats them into raw question-answer pairs. Every card is attached to one of the subject's **concepts** (`addcard "<subject>" "<concept>" "<q>" "<a>"`) and lands in the `flashcards` table with a zero interval, due immediately.
