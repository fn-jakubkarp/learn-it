---
stage: explore-gaps
phase: diagnose
gate: diagnose
description: Probe the learner against the concept map to find real gaps and place them at their true level — not always novice.
---

A placement diagnostic, not a self-report. People mis-estimate their own knowledge (Dunning-Kruger), so the agent **tests** the learner across the concept map at rising difficulty — like adaptive testing, pushing until they fall off. The point is two-fold: find the real gaps, and place an existing practitioner at their true level instead of starting everyone at novice.

For each concept worth checking, the agent poses an `explain` or `apply` prompt and scores it against the matching rubric, then records concept-level evidence:

```bash
bun src/learn-it.ts probe "<subject>" "<concept>" <explain|apply> <score 0-100>
```

A passing probe marks that concept **proven** — so a senior who already knows the material is lifted immediately, up to **proficient**. It cannot reach **expert**: that tier requires a real build plus durability (retention over time or evidence spread across many days), which a single session can't fake.

The agent writes the calibrated findings (known / shaky / unknown per concept) into `audit.md`, replacing the learner's guesswork. If the learner has a goal beyond their current level, set it so the watcher focuses on the gap:

```bash
bun src/learn-it.ts target "<subject>" <competent|proficient|expert>
```
