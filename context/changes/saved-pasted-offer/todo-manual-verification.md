# Manual Verification Todo

Phase 2 automated verification has passed, but manual verification is still pending.

- [ ] With local Supabase and `pnpm run dev`, sign in and open `/offers`; confirm an empty state appears for a buyer with no offers.
- [ ] Create an offer with title, pasted content, and source URL; confirm redirect to detail and read-only saved content.
- [ ] Create an offer without a source URL; confirm the detail page handles the missing URL cleanly.
- [ ] Submit invalid create input and confirm a generic retryable error appears without saving a row.
- [ ] Return to `/offers` and confirm offers are listed newest-updated first.
- [ ] Open the detail page repeatedly and confirm it does not mutate the saved row.
- [ ] Cancel delete and confirm the offer remains.
- [ ] Confirm delete and verify the row disappears from the list and from direct detail access.
- [ ] Sign in as another buyer or simulate another buyer locally and confirm they cannot see or delete the first buyer's offers.
- [ ] Confirm `/offers`, `/offers/new`, offer detail, and `/api/offers/**` redirect unauthenticated users to sign in.
