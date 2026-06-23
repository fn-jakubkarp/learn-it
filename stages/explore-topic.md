---
stage: explore-topic
phase: diagnose
gate: diagnose
description: Map the subject's territory into concepts before testing — so gaps the learner can't name are still on the map.
---

**Goal:** the learner can't list what they don't know. Lay out the whole territory first, so even unnamed gaps land on the map. This concept list becomes what coverage and mastery are measured against.

**Inputs:** the subject and its `audit.md`.

## Method
1. Map what mastering this subject actually requires — foundation-first, in real dependency order.
2. Break it into **concepts**: lesson-sized leaves ("ownership", "IP address types") — not subject-sized ("Rust"), not single facts.
3. Sketch the climb: what a *proficient* vs an *expert* practitioner can do here — so the learner sees the whole mountain, not just the next step.
4. Write the candidate list to `subjects/<subject>/roadmap.md` (open the file with frontmatter — `type: roadmap`, `subject: <subject>`) and register each — registration must happen here so `explore-gaps` has concepts to `probe` against:
   ```bash
   bun src/learn-it.ts addconcept "<subject>" "<concept>"
   ```

This is the **candidate** map. `explore-gaps` tests it and `plan` reconciles it — so don't agonise over perfection here; get the territory down so probing has something to push on.

## NEVER
- Trust the audit as the map — the audit refines into this, it doesn't define it.
- Emit concepts too coarse to prove or too fine to be a lesson.

## Hand-off
Concepts registered → `explore-gaps` (probe the learner against this map).
