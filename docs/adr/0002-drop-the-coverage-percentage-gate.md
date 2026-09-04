---
status: accepted
---

# Drop the 100% test coverage requirement

The repository documented a hard 100% coverage rule in both `CLAUDE.md` and NFR-11. We
have replaced it with a behavior-first policy: build test-first, cover critical paths and
defensive branches, assert through public interfaces, and set no percentage target. A
future reader who finds the old rule in git history should know this was deliberate
rather than erosion.

## Considered Options

- **Keep 100%** — rejected. The rule was never enforced anywhere: neither CI workflow
  runs a coverage tool and no coverage dependency is installed, so it functioned as
  aspiration rather than a gate. Meanwhile it pushed toward padding tests on trivial
  code to hit a number, which is the kind of test that survives no refactor and catches
  no bug.
- **Enforce 100% for real** by adding a CI gate — rejected. It would have made the
  cheapest tests the most valuable ones, and the work that most needs testing here
  (time-dependent warm state, spend-budget exhaustion) is exactly the work a percentage
  target does not prioritise.
- **Behavior-first with no percentage** (chosen).

## Consequences

Nothing in CI changes, because nothing in CI enforced the old rule. What changes is the
instruction to contributors and to agents working in this repo: judgement about which
behaviors matter now replaces an automatic number.

The obvious risk is coverage quietly decaying with no gate to catch it. The mitigation is
the test-first workflow rather than a threshold — code written test-first is covered by
construction, and the policy names the categories that must be covered so "what matters"
is not left entirely to taste.
