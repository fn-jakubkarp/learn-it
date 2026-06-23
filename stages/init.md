---
stage: init
phase: diagnose
gate: diagnose
description: Scaffold a new subject on disk and open an audit file for the learner to fill in.
---

**Goal:** capture an honest starting inventory in the learner's own words — raw material to be *tested*, never trusted. Nothing is taught until the learner has said what they think they know. Keep it low-stakes: this is a 2-minute hunch, step 1 of 3 (audit → map → quiz), not an exam.

**Inputs:** a subject name.

## Method
1. Scaffold the subject:
   ```bash
   bun src/learn-it.ts init "<subject>"
   ```
   Creates `subjects/<subject>/` and an `audit.md` with empty buckets and an empty primer block.
2. **Write the primer** (the nudge — overcomes blank-page paralysis): generate ~10 areas this subject touches and write them as bullets *between* the `<!-- PRIMER:START -->` and `<!-- PRIMER:END -->` markers near the bottom of `audit.md`. Short labels, foundation-to-edge, not exhaustive — a memory-jog, not the roadmap (`explore-topic` builds the real map). Leave the markers in place.
3. Hand the learner the audit file. Ask for three honest buckets, in their own words:
   - **Know** — could explain it cold, right now.
   - **Vague** — heard of it, couldn't teach it.
   - **Blank** — doesn't know what they don't know.
4. Say it plainly: dump your own thoughts first, *then* skim the primer for anything you forgot. It's a starting guess, not a grade — don't inflate, and don't worry about being complete. `explore-gaps` will test it; confident claims get probed.

## NEVER
- Pre-fill or "improve" the learner's **buckets** (Know/Vague/Blank/Why) — a borrowed inventory measures nothing. The primer block is the *only* thing the agent writes, and it's cues to react to, never answers in their voice.
- Start teaching before the audit exists.

## Hand-off
Audit filled → `explore-topic` (map the territory). "Filled" ignores the primer block, so the primer alone won't advance the phase — an audit with empty buckets just keeps the subject at `diagnose`.
