---
stage: explore-gaps
phase: diagnose
gate: diagnose
description: Probe the learner against the concept map to find real gaps and place them at their true level — react-to-cues, not free-recall; teach a little at each gap.
---

**Goal:** placement by demonstration, not self-report. Self-assessment correlates weakly with real skill — people can't rank what they don't yet know — so **test**, don't ask. This is where the three things the tool exists to separate get separated: what the learner *can do*, what they *think they know but can't* (the illusion of competence), and what they *never knew existed*. Find the real gaps, and lift an experienced learner to their true level instead of starting everyone at novice.

**Inputs:** the registered concept map (from `explore-topic`).

## Method — adaptive, ONE concept at a time, react-not-recall
This is an interactive climb, not a questionnaire. You walk the map *for* the learner so they never face a blank page — they react to a concrete cue, which is far easier and more honest than free recall. Work **one concept per round**:

1. **Open with a recognition cue, then a real question.** Name the concept and a one-line frame ("Next: *database indexes* — the thing that makes lookups fast"), then ask **one** question at the lowest difficulty still worth checking. **Wait for the answer.** Recognising the name isn't knowing it — the question is what places them.
2. **Climb on success.** Right? Ask the next-harder question on the *same* concept (recall → mechanism → trade-off → apply). Wrong/unsure? You've found the **fall-off point** — stop climbing this concept; that gap is the signal.
3. **Teach a little at the fall-off (one line, then move on).** The moment they fall off, drop a single-sentence gist so the session feels like a tutor, not an interrogation — *"🟡 Gist: every index speeds reads but slows writes; we'll go deep in `concept`."* Keep it to a sentence or two; the deep teaching is `concept`'s job, not this stage's. If they were **confident and still fell off**, name it plainly and kindly: *"That's a 🟡 — feels solid at the surface, but the trade-off is the gap. Good one to know about."* Surfacing the illusion *is* the value.
4. **Score and record**, grader pinned, against the matching rubric (`templates/rubric/{explain,apply}.md`), **refute-first** — credit only what survives a skeptical read:
   ```bash
   LEARN_IT_GRADER="<your-model-id>" bun src/learn-it.ts probe "<subject>" "<concept>" <explain|apply> <0-100>
   ```
   Surface the emitted glyph as-is (🟢 known · 🟡 shaky · 🔴 blank).
5. Move to the next concept and repeat. Cover the concepts worth checking before handing off.
6. **Write the calibrated readout** into `audit.md`, between `<!-- DIAGNOSIS:START -->` and `<!-- DIAGNOSIS:END -->` — three grouped lists, glyph-led:
   - **🟢 Proven** — climbed to mechanism/trade-off.
   - **🟡 Think you know** — confident or familiar, but fell off (name *where* it broke).
   - **🔴 Blank** — never surfaced by the learner; the map put it there. This list is the answer to "I feel like I'm missing everything" — now it's specific.
   Leave the markers in place. This block is generated, never hand-typed by the learner.

**Why one at a time:** batching questions kills adaptation — you can't pick the next difficulty without seeing the last answer, and the learner can't show *where* they fall off. A wall of questions across five concepts also reads as an exam, not a diagnosis.

## Worked probe — concept: "database index", rising difficulty
> **Cue:** "Next: *database indexes* — what makes a lookup fast."
> **L1 recall (explain):** "What's an index for?" → "speeds up lookups." ✓ keep climbing.
> **L2 mechanism (explain):** "Why is it faster — what's the structure?" → "a sorted tree, fewer hops." ✓ still climbing.
> **L3 trade-off (explain):** "When does an index *hurt*?" → "…not sure." ✗ fell off here.
> **Teach (one line):** "🟡 Gist: every index is extra structure to maintain — writes pay for read speed. We'll unpack it in `concept`."
> **L4 apply:** not reached.
>
> **Placement:** solid on *what* + *mechanism*, blank on *trade-offs*. Score the `explain` ~60 (knows it, real gap) → concept marked **shaky**, not proven. Goes in the 🟡 *think you know* list with the trade-off noted as the gap.

Don't stop at the first right answer — an easy question only proves the floor. Climb until they miss.

## Scoring guide — what a probe score means
- **85–100** — handled mechanism *and* trade-offs / edge cases. Proven (🟢).
- **70–84** — solid core, minor gaps. Proven, note the edge.
- **40–69** — knows the *what*, not the *why*. Shaky (🟡) — partial retrieval, so it counts as *covered* but NOT proven.
- **0–39** — recall only, or wrong. Blank (🔴) — a **gap marker**, not coverage: a bombed probe never advances mastery (score honestly, don't pad a near-zero to 40 to be kind).

## Gate — placement caps at proficient
A passing probe marks a concept **proven**, lifting a senior learner immediately — but a single session reaches at most **proficient**. Expert needs a real build plus durability over time (long retention, or evidence spread across many days), which one session can't fake. The engine enforces this; don't imply otherwise.

## Confirm the target
If `init` didn't already set a target and the learner has a goal, set it now so `mastery` scores the gap to *there*:
```bash
bun src/learn-it.ts target "<subject>" <competent|proficient|expert>
```

## NEVER
- Open with free-recall ("tell me everything you know about X") — give a cue to react to · stop at the first correct answer · batch many questions or many concepts into one turn (kills the adaptive climb) · let a confident claim pass unprobed · inflate a blank to be kind · turn the one-line gist into a lecture (deep teaching is `concept`) · declare expert from one session.

## Hand-off
Diagnose the concepts worth checking **before** teaching — untested concepts place at novice, and phase only leaves `diagnose` once concepts are actually probed (the `concept` watcher flags a half-diagnosed map). When the probe pass is done → `plan` (reconcile + order the roadmap). If you must stop early, **say so and let the learner choose**: finish diagnosing, or proceed deliberately on a specific known-weak concept.
