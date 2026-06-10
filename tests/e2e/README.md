# E2E Seed

`seed.spec.ts` covers the North Star S-03 flow and test-plan risks #1/#4:
a logged-in buyer saves a long offer, prepares it, and reviews answered,
unanswered, doubtful, and unmapped extraction buckets.

Local run:

```powershell
pnpm.cmd exec playwright install chromium
pnpm.cmd run test:e2e
```

Required local or CI env:

- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

The Playwright dev web server sets `E2E_OPENROUTER_MOCK=true`, so this test
never calls OpenRouter. Auth, routing, API handlers, and Supabase persistence
stay real. To move this into CI, start/reset local Supabase, install Chromium,
then run `pnpm run test:e2e` after `npm run test:app`.
