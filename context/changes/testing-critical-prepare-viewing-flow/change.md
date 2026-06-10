---
change_id: testing-critical-prepare-viewing-flow
title: Critical prepare-viewing flow tests
status: planned
created: 2026-06-09
updated: 2026-06-10
archived_at: null
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Critical prepare-viewing flow".
Risks covered: #1 Buyer cannot complete the primary prepare-viewing flow after pasting a long offer; #4 Extraction output looks complete but loses answered, unanswered, doubtful, or unmapped distinctions. Test types planned: integration + e2e/manual smoke + on-demand contract check.
Risk response intent:
- Risk #1: prove a saved long offer can be prepared and reviewed without losing the pasted context; challenge that a passing schema check means the user flow works; avoid live LLM on every change and happy-path-only UI checks.
- Risk #4: prove missing, doubtful, known, and unmapped offer facts land in the correct user-visible buckets; challenge that provider output already carries the final app truth; avoid mirroring current bucket transformation as the oracle.
