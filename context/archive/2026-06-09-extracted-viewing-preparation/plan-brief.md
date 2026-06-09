# Extracted Viewing Preparation - Plan Brief

> Full plan: `context/changes/extracted-viewing-preparation/plan.md`
> Research source: codebase inspection plus `context/changes/extraction-contract-check/plan.md`

## What & Why

Build the first complete product-value slice: a buyer can turn one saved flat offer into a reviewable viewing-preparation result. The app will show answered questions, unanswered questions, doubtful facts, and unmapped offer information without inventing facts or hiding uncertainty.

## Starting Point

Saved offers, buyer question bases, and the OpenRouter extraction contract already exist. What is missing is the S-03 bridge: persistence, a protected trigger, and a review UI on the saved-offer detail page.

## Desired End State

The buyer opens a saved offer, clicks "Prepare viewing", waits with clear feedback, and then sees the persisted preparation result on the same page. Revisiting the offer shows the same result, reruns are blocked for now, and deleting the offer deletes the extracted content too.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Persistence | Save latest result per offer | Revisitability and cascade deletion are required for a useful preparation flow. | Plan |
| Rerun behavior | Block when result exists | Avoids versioning/replacement scope in the first S-03 slice. | User / Plan |
| Trigger | Button on offer detail | Avoids surprise provider cost and fits current saved-offer flow. | User / Plan |
| Long-running UX | Solid button with pending state | Gives feedback during the external call without background jobs. | User / Plan |
| Layout | Sections on offer detail | Keeps source material and extracted preparation together. | User / Plan |
| Ordering | Preserve question categories | Matches the PRD's natural viewing-conversation flow. | User / PRD |
| Errors | Safe statuses plus logs | Buyer sees useful errors while operators keep deeper troubleshooting data without storing failed results. | User / Plan |
| Verification | DB tests, lint/build, manual flow | Covers RLS/cascade risk and the core UX. | User / Plan |

## Scope

**In scope:**

- `offer_extraction_results` table with RLS, one result per offer, and cascade delete.
- Result persistence service and preparation orchestration service.
- Protected `/api/offers/[id]/prepare` POST route.
- Solid "Prepare viewing" button with pending/error states.
- Server-rendered result sections on `/offers/[id]`.
- Database contract test, lint/build gates, and manual UI verification.

**Out of scope:**

- Result history, replacement, delete-result action, retries, queues, polling, streaming, notes, scoring, offer comparison, link import, scraping, or document parsing.

## Architecture / Approach

`/offers/[id]` remains the workspace. The page loads the saved offer, current buyer question base, and any persisted extraction result. A Solid island posts to a protected API route, which calls a thin orchestration service: load offer, block if result exists, load open questions, call `extractOfferPreparation`, persist completed results, log failures without DB changes, and return a safe JSON response.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Persist results | Result table, RLS, cascade, DB types, DB test | Ownership and one-result invariant must be correct. |
| 2. Services and API | Prepare orchestration and protected route | Avoid leaking sensitive content while preserving diagnostics. |
| 3. Offer detail UI | Trigger button and four-bucket review rendering | Long result page must stay scannable and reruns must remain blocked. |

**Prerequisites:** Completed F-02 extraction contract, saved offers, buyer question base, OpenRouter config for manual live generation.
**Estimated effort:** About 2-3 implementation sessions across 3 phases.

## Open Risks & Assumptions

- Storing the result as JSONB is enough for MVP because the app does not query inside individual extracted facts yet.
- Category grouping uses the current buyer question base at render time; if the buyer later edits/reorders questions, old extraction rows may appear under current categories or "Uncategorized".
- Failed extraction attempts are not persisted; safe diagnostics live in Cloudflare logs and the buyer can try again.
- Cloudflare logs are enough for operator troubleshooting in MVP.

## Success Criteria Summary

- Buyer can generate one preparation result from a saved offer and revisit it later.
- Rerun is blocked when a result already exists.
- Offer deletion removes extracted content.
- UI errors are safe, while Cloudflare logs retain useful diagnostics.
