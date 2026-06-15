# Rubric: apply (solve a problem)

Score each dimension 0-20; total 0-100. Pass at >= 70.

**Before scoring — try to refute.** Attack the solution: find the input that breaks it, the step that's luck not reasoning, the case it ignores. Score what survives. The model defaults to agreeing with the learner; this step is the counterweight. When torn between two bands, pick the lower.

**Band, every dimension:** `0-5` absent or wrong · `6-12` partial, real gaps · `13-16` solid, minor gaps · `17-20` full (column below).

| Dimension | Full marks (17-20) | Zero marks (0-5) |
|-----------|--------------------|------------------|
| Correctness | The solution actually works / is right. | It does not work or is wrong. |
| Transfer | Applied to the NEW situation, not a memorized answer. | A recited card, not the problem asked. |
| Method | Sound approach and valid reasoning, not luck. | Right answer, no valid reasoning. |
| Edge handling | Considers failure modes and boundary cases. | Ignores the obvious failure case. |
| Efficiency | Reasonable, not needlessly convoluted. | Wildly convoluted or wasteful. |

`evaluate` records: total score, pass/fail, and the single weakest dimension to work on next.
