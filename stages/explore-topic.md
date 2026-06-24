---
stage: explore-topic
phase: diagnose
gate: diagnose
description: Map the subject's full territory into concepts before testing — so gaps the learner can't name are still on the map.
---

**Goal:** lay out the **whole** field, foundation to edge, *independent of what the learner can recall*. This is the fix for "I feel like I'm missing 99%": the map's completeness comes from the body of knowledge, not from the learner's memory, so unnamed gaps still land on it. This concept list becomes what coverage and mastery are measured against.

**Inputs:** the subject and its captured **goal** (the *why* + target tier from `init`).

## Method
1. Map what mastering this subject actually requires — foundation-first, in real dependency order. Aim for **full coverage of the territory**, not a summary of the obvious parts. If a competent practitioner would know it, it belongs on the map even if the learner has never heard of it — *especially* then.
2. Break it into **concepts**: lesson-sized leaves ("ownership", "IP address types") — not subject-sized ("Rust"), not single facts.
3. **Steer with the goal, don't shrink to it.** The target tier sets where the climb *ends* (proficient vs expert), and the *why* flags which branches matter most — but never prune the map down to only what the learner already suspects exists. The point is to show them the parts of the mountain they couldn't have named.
4. Sketch the climb: what a *proficient* vs an *expert* practitioner can do here — so the learner sees the whole mountain, not just the next step.
5. Write the candidate list to `subjects/<subject>/roadmap.md` (open the file with frontmatter — `type: roadmap`, `subject: <subject>`) and register each — registration must happen here so `explore-gaps` has concepts to `probe` against:
   ```bash
   bun src/learn-it.ts addconcept "<subject>" "<concept>"
   ```

This is the **candidate** map. `explore-gaps` tests it and `plan` reconciles it — so don't agonise over perfection; get the full territory down so probing has something to push on.

## NEVER
- Let the goal or the learner's hunch bound the map — coverage comes from the field, not from recall.
- Emit concepts too coarse to prove or too fine to be a lesson.

## Hand-off
Concepts registered → `explore-gaps` (probe the learner against this map). Don't stop and wait — flow straight into probing; the learner experiences map + diagnosis as one session.
