---
stage: init
phase: diagnose
gate: diagnose
description: Scaffold a new subject on disk and open an audit file for the learner to fill in.
---

**Goal:** capture an honest starting inventory in the learner's own words — raw material to be *tested*, never trusted. Nothing is taught until the learner has said what they think they know.

**Inputs:** a subject name.

## Method
1. Scaffold the subject:
   ```bash
   bun src/learn-it.ts init "<subject>"
   ```
   Creates `subjects/<subject>/` and an empty `audit.md`.
2. Hand the learner the audit file. Ask for three honest buckets:
   - **Know** — could explain it cold, right now.
   - **Vague** — heard of it, couldn't teach it.
   - **Blank** — doesn't know what they don't know.
3. Say it plainly: this is a starting guess, not a grade. `explore-gaps` will test it — confident claims get probed.

## NEVER
- Pre-fill or "improve" the audit for them — a borrowed inventory measures nothing.
- Start teaching before the audit exists.

## Hand-off
Audit filled → `explore-topic` (map the territory). Phase follows reality, so an empty audit just keeps the subject at `diagnose`.
