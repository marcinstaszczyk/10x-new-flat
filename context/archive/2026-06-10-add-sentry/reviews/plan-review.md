<!-- PLAN-REVIEW-REPORT -->
# Add Sentry Plan Review

Date: 2026-06-11
Plan: `context/changes/add-sentry/plan.md`
Status: resolved

## Findings

### Resolved: Server Init Ownership

Severity: P1

The original change notes mix two Sentry patterns that share the `sentry.server.config.*` filename convention: a Cloudflare Worker entrypoint wrapper and Sentry's normal Astro server SDK init file. In this repository, `sentry.server.config.ts` is the Worker entrypoint referenced by `wrangler.jsonc`.

Risk: `@sentry/astro` auto-detects root `sentry.server.config.*` files as server SDK init files. Without an explicit plan rule, implementation could let Astro import the Worker entrypoint as if it were a plain `Sentry.init()` config.

Fix applied:

- Added current-state warning that root `sentry.server.config.ts` is the Worker entrypoint.
- Added decision: server init ownership belongs to the Worker wrapper unless a separate explicit server init path is introduced.
- Added Phase 1 contract requiring implementation to handle Sentry Astro server-init behavior explicitly.
- Updated the plan brief with the same ownership rule.

### Resolved: Browser DSN Build-Time Wiring

Severity: P1

The plan correctly chose `PUBLIC_SENTRY_DSN` for browser capture, but did not clearly state that `import.meta.env.PUBLIC_SENTRY_DSN` is resolved into browser code at build time.

Risk: implementers could configure `PUBLIC_SENTRY_DSN` only as a Cloudflare Worker runtime secret. That would leave browser Sentry disabled in production assets.

Fix applied:

- Added decision: `PUBLIC_SENTRY_DSN` is a client build-time public variable, not a Worker runtime secret.
- Split deployment docs contract between Worker runtime `SENTRY_DSN` and build-time `PUBLIC_SENTRY_DSN`.
- Added manual review criterion for deployment docs.
- Updated migration notes and plan brief to reflect the build-time requirement.

## Remaining Notes

The temporary smoke-code guidance is acceptable after the P1 fixes, but implementation should still avoid a single trigger path where a server throw prevents browser code from loading.
