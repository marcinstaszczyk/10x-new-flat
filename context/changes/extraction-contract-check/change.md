---
change_id: extraction-contract-check
title: Extraction contract check
status: implementing
created: 2026-06-08
updated: 2026-06-09
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- Phase 2 adds `pnpm run check:extraction-contract` as a live OpenRouter contract probe using fixture invariants. The fixture verifies answered, unanswered, doubtful, and unmapped buckets without asserting exact model prose.
- F-02 remains contract-only: extraction results are not persisted and are not visible in the UI. S-03 can use the DTO and service once review UX and lifecycle decisions are planned.
- Hosted or CI execution requires a human-approved `OPENROUTER_API_KEY` secret.
