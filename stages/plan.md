---
stage: plan
phase: diagnose
gate: diagnose
description: Reconcile the audit and probe findings into the final roadmap, and register every concept.
---

**Goal:** *reconcile* the candidate map (from `explore-topic`) with what probing revealed, then lock it — the concept list coverage and mastery are scored against. The roadmap file and the registered concepts MUST match. `explore-topic` already registered the candidates; **plan's job is the deltas, the order, and the target — not re-creating the list.**

**Inputs:** `audit.md` — the goal plus the generated **Where you stand** readout written by `explore-gaps` — and the registered candidate concepts.

## Method
1. Read the calibrated diagnosis (the 🟢/🟡/🔴 readout) against the objective body of knowledge for the subject.
2. **Reconcile against the probe findings:** split anything that probing showed was really two ideas, merge or drop vanity entries the learner clearly owns, add a missing prerequisite a fall-off exposed. Apply only the deltas:
   ```bash
   bun src/learn-it.ts addconcept "<subject>" "<concept>"   # new leaf
   bun src/learn-it.ts delconcept "<subject>" "<concept>"   # dropped leaf
   ```
   If probing confirmed the map as-is, that's a valid, fast outcome — **don't invent churn to look busy.**
3. **Order it foundation-first** in `subjects/<subject>/roadmap.md` (keep its `type: roadmap` frontmatter) — this sequence is what `concept` teaches down, weakest-diagnosed first within the dependencies.
4. **Confirm the target** (`target "<subject>" <tier>`) if `explore-gaps` didn't already set it and the learner has a goal.
5. Reconcile: `concepts "<subject>"` must list exactly what's in `roadmap.md`. Drift = mismeasured mastery.

## Gate
Nothing probed yet → the roadmap is generic (it can only reflect the map, not the learner). The watcher says so; run `explore-gaps` first so plan can reconcile against real placements.

## NEVER
- Let `roadmap.md` and the registered concepts diverge · scope a concept as a whole subject · re-register the whole list when only a couple of leaves changed.

## Hand-off
Roadmap locked → `concept` (build understanding), or `review` if cards already exist.
