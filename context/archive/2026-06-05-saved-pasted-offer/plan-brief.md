# Saved Pasted Offer - Plan Brief

> Full plan: `context/changes/saved-pasted-offer/plan.md`

## What & Why

Build the saved-offer workspace that S-03 extraction will consume. A logged-in buyer can save pasted offer-page content as a private flat offer, revisit the saved detail, and hard-delete it when no longer needed.

## Starting Point

The buyer question-base slice is implemented: auth middleware resolves users, the dashboard is protected, server services wrap Supabase calls, and database ownership tests exist. No offer table, offer service, `/offers` routes, or offer DTOs exist yet.

## Desired End State

Buyers have a dedicated `/offers` area with list, create, detail, and confirmed delete behavior. Each saved offer contains a title, pasted content, optional source URL, and timestamps. The UI stays honest before extraction exists by showing only the saved source material.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Stored fields | Title, pasted content, optional source URL | Enough to identify, revisit, and later extract without adding structured attributes early. |
| UI location | Dedicated `/offers` area | Keeps question base and saved offers as separate product areas. |
| Create flow | Server-rendered form page | Matches current app patterns and avoids client state for MVP. |
| Detail content | Read-only saved source material | Avoids nonfunctional extraction placeholders. |
| Delete behavior | Confirmed hard delete | Meets the privacy requirement for sensitive pasted content. |
| List order | Newest-updated first | Makes recent preparation work easiest to resume and supports future edits. |
| Edit scope | No editing in S-02 | Keeps the slice focused on create, revisit, and delete. |

## Scope

**In scope:**

- `flat_offers` schema, RLS, grants, constraints, and pgTAP ownership tests.
- Shared offer DTO and server offer service.
- Protected `/offers`, `/offers/new`, and `/offers/[id]` pages.
- Zod-validated create and delete API routes.
- Confirmed hard-delete UI and dashboard navigation link.
- README manual verification guidance.

**Out of scope:**

- Extraction, structured offer attributes, comparison, scoring, notes, or link import.
- Editing, autosave, soft delete, undo, or draft recovery.
- Client-side offer state management or a new application test runner.

## Architecture / Approach

The database owns privacy through a buyer-owned `flat_offers` table with RLS. Astro pages render list/create/detail views, while API routes validate form input and call a server offer service using the request-scoped Supabase client. A small Solid form handles delete confirmation; the browser never talks to Supabase directly.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Offer persistence and ownership | Database schema, RLS, DTOs, and pgTAP contract | RLS or grants must deny anonymous, cross-buyer, and update paths. |
| 2. Server-rendered offer flow | List, create, detail, delete, navigation, docs, and browser checks | Sensitive content must not be saved without a working owner-only delete path. |

**Prerequisites:** Completed S-01 question-base work, local Supabase/Docker, and an authenticated test buyer.
**Estimated effort:** Approximately 2 implementation sessions across 2 phases.

## Open Risks & Assumptions

- Direct database inserts may store any nonblank `source_url`; user-facing URL validation happens in the API route.
- Offer editing is intentionally deferred, so correcting a saved mistake requires delete and recreate.
- Future extraction tables must define explicit deletion behavior when `flat_offers` is deleted.
- UI behavior has manual coverage only because the repository has no application test runner.

## Success Criteria Summary

- A buyer can create, revisit, and hard-delete a private saved offer.
- Buyers never see or mutate another buyer's offers, and anonymous access is denied.
- Invalid create input fails safely without raw database errors or saved rows.
- Database tests, lint, build, and documented manual browser checks pass.
