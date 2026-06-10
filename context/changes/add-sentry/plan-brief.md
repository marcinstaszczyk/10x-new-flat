# Add Sentry Error Reporting - Plan Brief

> Full plan: `context/changes/add-sentry/plan.md`

## What & Why

Finish Sentry error reporting for the Astro 6 Cloudflare Worker app. The goal is for production server and browser `error` and `warn` events to reach Sentry without adding tracing, replay, source map upload, or permanent debug routes.

## Starting Point

Most server-side setup already exists: dependencies are installed, Astro has the Sentry integration, Wrangler uses a custom Sentry Worker entrypoint, and the Worker wrapper captures `console.warn` and `console.error`. Browser capture is not configured yet.

## Desired End State

Server and browser runtime errors plus `console.warn`/`console.error` events reach the same Sentry project. The same DSN value is configured as `SENTRY_DSN` for Worker/server code and `PUBLIC_SENTRY_DSN` for browser code. Source maps stay disabled, no extra filters are added, and temporary smoke code is removed after verification.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Capture scope | Server and browser | User confirmed both runtimes should report production warn/error events. |
| DSN value | Same Sentry DSN | Sentry provides one project DSN suitable for both runtimes. |
| Env names | `SENTRY_DSN` plus `PUBLIC_SENTRY_DSN` | Astro needs explicit server/client access boundaries. |
| Verification | Temporary smoke route/page | Proves real delivery while avoiding a permanent debug surface. |
| Source maps | Disabled | User confirmed no source map upload setup for now. |
| Filters | None beyond warn/error | User confirmed no filtering yet. |

## Scope

**In scope:**

- Preserve existing Worker-side Sentry wrapper.
- Add browser-side Sentry initialization.
- Add public browser DSN env contract.
- Document local and deployment DSN setup.
- Verify with temporary smoke code, then remove it.
- Run lint and build.

**Out of scope:**

- Source map upload and `SENTRY_AUTH_TOKEN`.
- Tracing, replay, profiling, metrics, or custom logging wrappers.
- Permanent smoke/debug routes.
- New database or app feature work.

## Architecture / Approach

The Worker entrypoint remains `sentry.server.config.ts`, wrapping Astro's Cloudflare handler with `Sentry.withSentry`. Browser capture is added through `sentry.client.config.ts`, initialized from a public DSN env value and configured to capture warning/error console calls. Verification uses temporary app code that is removed before handoff.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Normalize Config | Stable server config and public DSN schema | Breaking existing Worker entrypoint or source map setting. |
| 2. Browser Capture | Browser Sentry config and env docs | Accidentally treating server-only env as browser-readable. |
| 3. Smoke Verify | Real Sentry receipt for server and browser | Leaving temporary smoke code behind. |
| 4. Handoff Docs | README and final checklist | Missing deployment/env guidance. |

**Prerequisites:** access to the Sentry DSN and a local or preview environment where Sentry events can be checked.
**Estimated effort:** one focused implementation session across four small phases.

## Open Risks & Assumptions

- `PUBLIC_SENTRY_DSN` may need Astro-specific schema syntax adjustment during implementation.
- Manual Sentry verification depends on access to the Sentry project.
- Cloudflare environment setup may differ between local `.dev.vars`, CI, and deployed Worker settings.

## Success Criteria (Summary)

- Server and browser warn/error smoke events are visible in Sentry.
- `pnpm run lint` and `pnpm run build` pass after smoke code is removed.
- No real DSN, Sentry auth token, or permanent smoke route is committed.
