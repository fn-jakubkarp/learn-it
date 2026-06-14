---
stage: explore-topic
phase: diagnose
gate: diagnose
description: Map the subject's territory into concepts before the learner is tested — so even gaps they can't name are on the map.
---

The learner can't list what they don't know. Before any diagnosis, the agent maps the **territory** of the subject: what does mastering this actually require?

The agent lays out the landscape of the subject and breaks it into **concepts** (lesson-sized leaves), foundation-first. It also sketches what the upper tiers look like here — what a *proficient* vs an *expert* practitioner can do — so the learner sees the whole climb, not just the next step.

Output: a candidate concept list written to `roadmap.md` and registered with `addconcept "<subject>" "<concept>"`. This map is what `explore-gaps` probes the learner against, and what coverage and mastery are later measured on. It refines the learner's self-reported `audit.md` rather than trusting it.
