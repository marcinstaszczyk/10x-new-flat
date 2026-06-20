---
title: Project Scale
created: 2026-06-12
type: scale-estimate
---

# Project Scale

## Summary

Approximate repository scale, excluding generated/dependency outputs:

| Measure | Count |
|---|---:|
| Files | 116 |
| Text files | 114 |
| Binary assets | 2 |
| LOC, excluding lockfiles | 8,699 |
| LOC, including lockfiles | 29,391 |

This is a small codebase. The lockfiles account for most raw repository lines, so the useful implementation/documentation scale is closer to ~8.7k LOC.

## Method

Count source files with `rg --files`, excluding:

- `node_modules`
- `.git`
- `dist`
- `playwright-report`
- `test-results`
- `context/archive`

Line counts include text-like files (`.astro`, `.css`, `.json`, `.jsonc`, `.md`, `.mjs`, `.ts`, `.tsx`, `.js`, `.yml`, `.yaml`, `.toml`, `.sql`, `.txt`) and exclude `package-lock.json` plus `pnpm-lock.yaml` from the primary LOC number.

## Breakdown By Area

| Area | Files | LOC |
|---|---:|---:|
| `src` | 54 | 3,420 |
| `supabase` | 13 | 2,319 |
| `context` | 13 | 1,880 |
| `tests` | 8 | 310 |
| `scripts` | 8 | 203 |
| Root docs/config | 18 | 567 |

## Breakdown By File Type

| Type | Files | LOC |
|---|---:|---:|
| Markdown | 19 | 2,161 |
| TypeScript | 37 | 2,132 |
| SQL | 12 | 1,962 |
| Astro | 16 | 996 |
| TSX | 10 | 521 |
| TOML | 1 | 357 |
| MJS | 6 | 201 |
| JSON | 5 | 135 |
| CSS | 1 | 118 |
| JavaScript | 1 | 70 |
| JSONC | 1 | 23 |
| YAML/YML | 2 | 16 |
| TXT | 1 | 7 |

## Largest Files

| File | LOC |
|---|---:|
| `context/domain/03-anti-corruption-layer.md` | 648 |
| `supabase/tests/database/offer_extraction_results_contract.test.sql` | 505 |
| `supabase/tests/database/question_ownership_contract.test.sql` | 377 |
| `supabase/config.toml` | 357 |
| `supabase/tests/database/flat_offers_contract.test.sql` | 320 |
| `context/domain/02-invariant-aggregate-refactor.md` | 293 |
| `supabase/tests/database/question_base_lifecycle.test.sql` | 270 |
| `src/lib/services/extraction-contract.ts` | 176 |
| `src/types.ts` | 175 |
| `src/components/offers/OfferPreparationResult.astro` | 171 |
| `context/foundation/test-plan.md` | 167 |
| `src/lib/services/extraction-provider.ts` | 167 |
