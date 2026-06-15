---
stage: plan
phase: diagnose
gate: diagnose
description: Reconcile the audit and probe findings into the final roadmap, and register every concept.
---

**Goal:** lock the roadmap — the concept list coverage and mastery are scored against. The roadmap file and the registered concepts MUST match.

**Inputs:** `audit.md` (now calibrated by `explore-gaps`) and the candidate concepts from `explore-topic`.

## Method
1. Read the calibrated audit against the objective body of knowledge for the subject.
2. Resolve the roadmap into **concepts** (lesson-sized leaves), foundation-first — drop vanity entries, split anything subject-sized.
3. Write `subjects/<subject>/roadmap.md`, then register every leaf:
   ```bash
   bun src/learn-it.ts addconcept "<subject>" "<concept>"
   ```
4. Reconcile: `concepts "<subject>"` must list exactly what's in `roadmap.md`. Drift = mismeasured mastery.

## Gate
Empty audit → the roadmap is generic. The watcher says so; fill the audit first for a tailored plan.

## NEVER
- Let `roadmap.md` and the registered concepts diverge · scope a concept as a whole subject.

## Hand-off
Roadmap locked → `concept` (build understanding), or `review` if cards already exist.
