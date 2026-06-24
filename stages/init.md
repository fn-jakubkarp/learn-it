---
stage: init
phase: diagnose
gate: diagnose
description: Scaffold a new subject and capture the learner's goal — not a self-inventory. Placement is measured later, never declared here.
---

**Goal:** stand the subject up and capture *why* the learner is here + how far they want to go — nothing else. The learner does **not** inventory what they know: free-recall onto a blank page is the hardest, least reliable task there is, and self-report is the one thing this tool refuses to trust. Where they actually stand is *measured* by `explore-gaps`, then written back for them. This stage should take under a minute and feel like the start of being taught, not an intake form.

**Inputs:** a subject name.

## Method
1. Scaffold the subject:
   ```bash
   bun src/learn-it.ts init "<subject>" [slug]
   ```
   Assigns a short, ascii, filesystem-safe **slug** (auto-derived from the name, e.g. `egzamin-krotkofalowca-klasa-1`; pass an explicit one as the optional 2nd arg to keep it terse). Creates `subjects/<slug>/` and an `audit.md` whose only learner-written field is the goal; the rest is a generated readout `explore-gaps` fills. **Use the slug as the `{subject}` arg in every later command** — it's stable and quote-safe; the full name works too but is fragile.
2. **Capture the goal in conversation — two short questions, not a form:**
   - *Why are you learning this?* (the real motivation — "ship a CLI at work", "pass an exam", "stop fearing it")
   - *How far do you want to get?* (map their answer to a tier: competent / proficient / expert)
   Write their answers into the **Goal** lines of `audit.md`, and if they named a target, set it now:
   ```bash
   bun src/learn-it.ts target "<subject>" <competent|proficient|expert>
   ```
   No clear goal? Fine — say it can be set anytime and move on. Don't stall on it.
3. **Flow straight into mapping.** Don't hand back a file and wait. The moment the goal is captured, continue into `explore-topic` in the same session — the learner should feel one continuous "let's see where you are", not four commands to run.

## NEVER
- Ask the learner to list what they know / are vague on / are blank on. That inventory is what `explore-gaps` *produces by testing* — collecting it here measures nothing and demoralises.
- Write anything into the **Where you stand** block — that's `explore-gaps`'s output.
- Treat the goal as a placement. A goal is a destination, not evidence; it never lifts a tier.

## Hand-off
Goal captured → `explore-topic` (map the whole territory). Phase does **not** advance on a filled goal — it advances once the map is built and concepts are actually probed, so an unprobed subject correctly stays at `diagnose`.
