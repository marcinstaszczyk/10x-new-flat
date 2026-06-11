# Add Sentry Error Reporting Plan

## Overview

Finish the existing partial Sentry integration so production server and browser `warn`/`error` events reach Sentry for the Astro 6 app deployed on Cloudflare Workers.

The repository already has most of the server-side setup in place. This plan tightens that setup, adds browser-side initialization, documents the DSN and deployment steps, verifies with a temporary smoke endpoint/page, and removes the smoke code before completion.

## Current State Analysis

The app already uses Astro server output with the Cloudflare adapter. `wrangler.jsonc` points the Worker entrypoint at `./sentry.server.config.ts`, and that file wraps the Astro Cloudflare handler with `Sentry.withSentry`. The wrapper reads `SENTRY_DSN`, disables Sentry when the DSN is absent, and captures `console.warn` plus `console.error`.

The Astro integration is already present in `astro.config.mjs` with telemetry disabled and Sentry source maps disabled. The Sentry packages are already installed in both package manifests. `SENTRY_DSN` already exists in `.env.example` and the Astro env schema as an optional server-only secret.

Browser capture is not configured yet. There is no `sentry.client.config.*` file and no public browser-readable Sentry env binding. Because browser code cannot read server-only Astro env values, the same Sentry DSN value should be exposed through a public browser variable while keeping the existing Worker `SENTRY_DSN` binding for server runtime.

The original change notes include two Sentry setup patterns with the same conventional filename: a Cloudflare Worker entrypoint named `sentry.server.config.ts`, and Sentry's normal Astro server SDK init file pattern `sentry.server.config.*`. In this repository, root `sentry.server.config.ts` is the Worker entrypoint. Implementation must not assume it is a normal `Sentry.init()` module.

### Key Discoveries

- `astro.config.mjs:13` already registers `@sentry/astro` with telemetry disabled and source maps disabled.
- `astro.config.mjs:25` already declares server-only `SENTRY_DSN`.
- `sentry.server.config.ts:8` wraps the Cloudflare handler with `Sentry.withSentry`.
- `sentry.server.config.ts:12` captures `console.warn` and `console.error`.
- `wrangler.jsonc:4` already uses the custom Sentry Worker entrypoint.
- `.env.example:7` already lists `SENTRY_DSN`.
- `package.json:24` and `package.json:25` already include `@sentry/astro` and `@sentry/cloudflare`.
- Context7 docs for `/getsentry/sentry-javascript` confirm the Cloudflare `withSentry` wrapper and `captureConsoleIntegration({ levels: ["warn", "error"] })` configuration shape.
- `@sentry/astro` auto-detects root `sentry.server.config.*` files as server SDK init files, so this plan must explicitly protect the custom Worker entrypoint from being treated as an unrelated SDK init module.

## Desired End State

- Production Worker runtime sends unhandled server errors and server `console.warn`/`console.error` events to Sentry.
- Browser runtime sends browser errors and browser `console.warn`/`console.error` events to Sentry.
- The same Sentry project DSN value is used for both server and browser capture, represented as `SENTRY_DSN` for Worker/server access and `PUBLIC_SENTRY_DSN` for browser access.
- Source map upload remains disabled.
- No filters are added beyond capturing only `warn` and `error`.
- A temporary smoke route or page proves server and browser capture, then is removed before the change is considered complete.
- README and env templates explain local, CI, and Cloudflare setup without committing any real DSN or auth token.

## What We're NOT Doing

- No Sentry source map upload setup.
- No `SENTRY_AUTH_TOKEN`, Sentry org, or Sentry project config.
- No session replay, profiling, performance tracing, metrics, or custom logging abstraction.
- No warning/error filters beyond Sentry's `warn` and `error` level selection.
- No permanent debug route, public test button, or smoke endpoint.
- No database changes.

## Implementation Approach

Treat the existing server integration as the baseline and avoid reinstalling or restructuring Sentry. Add the missing browser config and public DSN binding, then verify the end-to-end behavior with temporary smoke code that is explicitly removed in the final phase.

The browser DSN is not a private secret, but it must still be handled intentionally. Use the same DSN value Sentry provided, with two env variable names because Astro and Cloudflare access server and browser env differently.

## Decisions

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Capture scope | Server and browser | User wants production `error` and `warn` events, and confirmed browser capture too. | User |
| DSN value | Same Sentry DSN value for server and browser | Matches Sentry project setup while keeping Astro access boundaries explicit. | User + Plan |
| Env names | `SENTRY_DSN` and `PUBLIC_SENTRY_DSN` | Worker config needs server env; browser config needs public env. | Plan |
| Verification | Temporary smoke route/page, removed before completion | Proves real capture without leaving a permanent debug surface. | User |
| Source maps | Keep disabled | Avoids auth-token/org/project setup and upload complexity for this change. | User |
| Noise filters | None beyond warn/error levels | User explicitly wants no additional filtering now. | User |
| Server init ownership | Root `sentry.server.config.ts` stays the Cloudflare Worker entrypoint; any regular Sentry server SDK init must use an explicit separate path or be disabled if the Worker wrapper covers server capture. | Prevents `@sentry/astro` auto-detection from misusing the Worker entrypoint as a normal SDK init file. | Review |
| Browser DSN availability | `PUBLIC_SENTRY_DSN` is a client build-time public variable, not a Worker runtime secret. | `import.meta.env.PUBLIC_SENTRY_DSN` is bundled into browser code by Astro/Vite. | Review |

## Phase 1: Normalize Sentry Configuration

### Overview

Make the existing Sentry setup explicit and consistent before adding browser capture. This phase should preserve current server behavior while preparing a browser-readable DSN variable.

### Changes Required

#### 1. Astro integration and env schema

**File**: `astro.config.mjs`

**Intent**: Keep the current Sentry Astro integration and source map behavior stable, while adding the public DSN contract needed by browser config.

**Contract**:

- Preserve `output: "server"`.
- Preserve `sentry({ telemetry: false, sourcemaps: { disable: true } })`.
- Preserve server-only optional `SENTRY_DSN`.
- Add an optional browser-readable public Sentry DSN env binding, expected name `PUBLIC_SENTRY_DSN`, using Astro's client/public env schema shape.
- Explicitly handle `@sentry/astro` server-init behavior: do not let the integration auto-import the Worker entrypoint as a plain `Sentry.init()` server config. If the Worker wrapper is sufficient for server capture, disable or bypass normal server SDK init for this change; if a normal server SDK init is still needed, put it in a distinct file and wire it through an explicit `serverInitPath`.
- Do not add Sentry auth token, org, project, source map upload options, tracing, profiling, or replay config.

#### 2. Worker wrapper review

**File**: `sentry.server.config.ts`

**Intent**: Keep Cloudflare Worker server capture aligned with current Sentry guidance and the user's warn/error requirement.

**Contract**:

- Keep importing the Astro Cloudflare handler from `@astrojs/cloudflare/entrypoints/server`.
- Keep wrapping the handler with `Sentry.withSentry`.
- Keep reading DSN from Worker env `SENTRY_DSN`.
- Keep Sentry disabled when `SENTRY_DSN` is absent.
- Keep `Sentry.captureConsoleIntegration({ levels: ["warn", "error"] })`.
- Keep this file's role as the Cloudflare Worker entrypoint, not a normal `Sentry.init()` server SDK config.
- Do not add filters, sampling, tracing, profiling, or logging wrappers.

#### 3. Cloudflare entrypoint review

**File**: `wrangler.jsonc`

**Intent**: Ensure deployed Workers use the Sentry-wrapped handler.

**Contract**:

- Keep `main` pointed at `./sentry.server.config.ts`.
- Preserve existing compatibility flags unless implementation proves a Sentry-specific flag is required.
- Do not move back to the default Astro Cloudflare entrypoint.

### Success Criteria

#### Automated Verification

- `pnpm run lint` passes.
- `pnpm run build` passes with Sentry DSN values absent.

#### Manual Verification

- Review `astro.config.mjs` and confirm source maps remain disabled.
- Review `sentry.server.config.ts` and confirm server console capture is limited to `warn` and `error`.
- Review `wrangler.jsonc` and confirm the custom Sentry Worker entrypoint remains active.

**Implementation Note**: If Astro's env schema rejects the chosen `PUBLIC_SENTRY_DSN` declaration shape, adjust only the schema syntax. Do not replace the server/client env split with a hard-coded DSN.

**Implementation Note**: Before changing Sentry config, verify the existing build behavior around root `sentry.server.config.ts`. The implementation must leave a clear, working ownership model: Worker entrypoint wrapping through `Sentry.withSentry`, plus browser init through `sentry.client.config.ts`.

---

## Phase 2: Add Browser Error and Console Capture

### Overview

Add browser-side Sentry initialization so client runtime errors and browser `console.warn`/`console.error` events are reported.

### Changes Required

#### 1. Browser Sentry config

**File**: `sentry.client.config.ts`

**Intent**: Initialize Sentry in browser runtime with the same project DSN and the requested warn/error console capture.

**Contract**:

- Import Sentry from `@sentry/astro`.
- Read the DSN from the browser-readable public env value, expected `import.meta.env.PUBLIC_SENTRY_DSN`.
- Enable Sentry only when the public DSN is present.
- Configure `Sentry.captureConsoleIntegration({ levels: ["warn", "error"] })`.
- Do not enable source maps, tracing, replay, profiling, metrics, or custom filters.
- Do not include the real DSN literal in source code.

#### 2. Env templates and local docs

**Files**: `.env.example`, README env/deployment sections

**Intent**: Make it clear that both env names use the same Sentry-provided DSN value.

**Contract**:

- Add `PUBLIC_SENTRY_DSN=` to `.env.example`.
- Document that local `.env` and `.dev.vars` should set both `SENTRY_DSN` and `PUBLIC_SENTRY_DSN` to the same Sentry DSN value when testing Sentry.
- Document that Cloudflare deployment needs `SENTRY_DSN` configured as a Worker secret or binding.
- Document that `PUBLIC_SENTRY_DSN` must be available to the browser build through the environment used by the production build, including GitHub Actions if CI builds the deploy artifact. It is not enough to add it only as a Worker runtime secret because `import.meta.env.PUBLIC_SENTRY_DSN` is resolved into client code at build time.
- Do not document or request `SENTRY_AUTH_TOKEN`.
- Do not paste any real DSN into committed files.

### Success Criteria

#### Automated Verification

- `pnpm run lint` passes.
- `pnpm run build` passes with Sentry DSN values absent.

#### Manual Verification

- Review browser config and confirm it cannot read `SENTRY_DSN` directly.
- Review `.env.example` and README and confirm no real DSN or auth token is committed.
- Review deployment docs and confirm `PUBLIC_SENTRY_DSN` is described as build-time public configuration, not only a Worker runtime secret.
- Confirm source map upload is still disabled after browser config is added.

---

## Phase 3: Verify With Temporary Smoke Code

### Overview

Use a temporary route or endpoint to prove server and browser events reach Sentry, then remove the route before completion.

### Changes Required

#### 1. Temporary smoke route or page

**Files**: temporary route under `src/pages/**` or `src/pages/api/**`

**Intent**: Provide a short-lived, explicit way to trigger one server warning/error and one browser warning/error during implementation verification.

**Contract**:

- Add the smallest temporary route or page needed for verification.
- Make the route clearly temporary in name and code.
- Prefer a protected route if using a page; if using an API endpoint, keep it obscure and remove it in this phase.
- Trigger server-side `console.warn` and either a controlled thrown error or `console.error` event.
- Trigger browser-side `console.warn` and either a controlled thrown error or `console.error` event.
- Do not expose secrets in response bodies, page content, logs, or Sentry event payloads.
- Do not commit the route as a permanent feature.

#### 2. Live smoke execution

**Files**: no permanent files required

**Intent**: Confirm Sentry receives events before declaring the integration done.

**Contract**:

- Run the app or deploy a preview with `SENTRY_DSN` and `PUBLIC_SENTRY_DSN` set to the same Sentry project DSN value.
- Visit or call the temporary smoke route.
- Confirm Sentry receives server warning/error events.
- Confirm Sentry receives browser warning/error events.
- Record only a short manual verification note in the implementation handoff or progress, not event payload contents.

#### 3. Remove temporary smoke code

**Files**: same temporary route/page files

**Intent**: Leave no debug route or public test trigger in the product.

**Contract**:

- Delete the temporary smoke route/page after Sentry receipt is confirmed.
- Ensure no navigation, middleware entry, or docs point to the removed route.
- Keep only durable configuration and documentation changes.

### Success Criteria

#### Automated Verification

- `pnpm run lint` passes after smoke code is removed.
- `pnpm run build` passes after smoke code is removed.

#### Manual Verification

- Confirm Sentry received at least one server-side warning or error from the smoke.
- Confirm Sentry received at least one browser-side warning or error from the smoke.
- Confirm the temporary smoke route/page is removed before completion.

**Implementation Note**: If local Sentry receipt cannot be confirmed because DSN access or deployment access is unavailable, leave the manual smoke unchecked in `## Progress` and report the blocker. Do not keep the temporary route as a workaround.

---

## Phase 4: Final Documentation and Handoff

### Overview

Finish operational docs and ensure future agents know how Sentry is configured without adding new behavior.

### Changes Required

#### 1. README Sentry section

**File**: `README.md`

**Intent**: Document Sentry setup beside the existing environment and deployment guidance.

**Contract**:

- Explain that Sentry captures server and browser production errors plus `console.warn`/`console.error`.
- Explain that source maps are intentionally disabled.
- Explain that both `SENTRY_DSN` and `PUBLIC_SENTRY_DSN` use the same Sentry-provided DSN value.
- Explain that real DSN values belong in local env files and Cloudflare/GitHub secret configuration, not source control.
- Keep wording concise.

#### 2. Change progress update

**File**: `context/changes/add-sentry/plan.md`

**Intent**: Track implementation verification mechanically for future `/10x-implement` and review runs.

**Contract**:

- Keep the `## Progress` checklist aligned with phase success criteria.
- During implementation, append commit SHAs only after steps land.
- Do not mark manual Sentry receipt complete unless it was actually verified.

### Success Criteria

#### Automated Verification

- `pnpm run lint` passes.
- `pnpm run build` passes.

#### Manual Verification

- Review README and confirm it documents both server and browser Sentry setup.
- Review the final file list and confirm no temporary smoke route/page remains.
- Review committed config and confirm no real DSN or auth token is present.

---

## Testing Strategy

### Automated Verification

- `pnpm run lint` is required because this change touches TypeScript config and possibly Astro files.
- `pnpm run build` is required because this change touches Astro integration, env schema, and Cloudflare Worker entrypoint behavior.
- No new unit tests are required unless implementation introduces testable helper logic. This plan should prefer direct config over new abstractions.

### Manual Testing Steps

1. Configure local or preview env with `SENTRY_DSN` and `PUBLIC_SENTRY_DSN` set to the same Sentry project DSN value.
2. Add the temporary smoke route/page.
3. Run the app or deploy a preview.
4. Trigger the server warning/error smoke.
5. Trigger the browser warning/error smoke.
6. Confirm both event sources arrive in Sentry.
7. Remove the temporary smoke route/page.
8. Re-run `pnpm run lint` and `pnpm run build`.

## Performance Considerations

Capturing only errors and warning/error console calls should have low runtime overhead. Browser capture adds client bundle/runtime work from the Sentry SDK, but this plan does not add tracing, replay, profiling, or metrics, which are the heavier observability features.

## Migration Notes

- No Supabase migration is needed.
- Dependency installation is already complete; lockfiles should not change unless implementation discovers a missing package or version mismatch.
- Deployment needs env/secrets configured outside source control. `SENTRY_DSN` belongs in Worker runtime secrets or bindings; `PUBLIC_SENTRY_DSN` must be present in the production build environment that generates browser assets.
- CI should continue to build without Sentry DSN values because both DSN variables are optional.

## References

- Change identity: `context/changes/add-sentry/change.md`
- Existing Astro integration: `astro.config.mjs:13`
- Existing Sentry env schema: `astro.config.mjs:25`
- Existing Worker wrapper: `sentry.server.config.ts:8`
- Existing console capture: `sentry.server.config.ts:12`
- Existing Cloudflare entrypoint: `wrangler.jsonc:4`
- Existing Sentry package dependencies: `package.json:24`, `package.json:25`
- Existing env template: `.env.example:7`
- Sentry docs checked through Context7: `/getsentry/sentry-javascript`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` - <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Normalize Sentry Configuration

#### Automated

- [x] 1.1 `pnpm run lint` passes. — ca3cd48
- [x] 1.2 `pnpm run build` passes with Sentry DSN values absent. — ca3cd48

#### Manual

- [x] 1.3 Review `astro.config.mjs` and confirm source maps remain disabled. — ca3cd48
- [x] 1.4 Review `sentry.server.config.ts` and confirm server console capture is limited to `warn` and `error`. — ca3cd48
- [x] 1.5 Review `wrangler.jsonc` and confirm the custom Sentry Worker entrypoint remains active. — ca3cd48

### Phase 2: Add Browser Error and Console Capture

#### Automated

- [x] 2.1 `pnpm run lint` passes. — ce76b11
- [x] 2.2 `pnpm run build` passes with Sentry DSN values absent. — ce76b11

#### Manual

- [x] 2.3 Review browser config and confirm it cannot read `SENTRY_DSN` directly. — ce76b11
- [x] 2.4 Review `.env.example` and README and confirm no real DSN or auth token is committed. — ce76b11
- [x] 2.5 Confirm source map upload is still disabled after browser config is added. — ce76b11

### Phase 3: Verify With Temporary Smoke Code

#### Automated

- [x] 3.1 `pnpm run lint` passes after smoke code is removed.
- [x] 3.2 `pnpm run build` passes after smoke code is removed.

#### Manual

- [x] 3.3 Confirm Sentry received at least one server-side warning or error from the smoke.
- [x] 3.4 Confirm Sentry received at least one browser-side warning or error from the smoke.
- [x] 3.5 Confirm the temporary smoke route/page is removed before completion.

### Phase 4: Final Documentation and Handoff

#### Automated

- [ ] 4.1 `pnpm run lint` passes.
- [ ] 4.2 `pnpm run build` passes.

#### Manual

- [ ] 4.3 Review README and confirm it documents both server and browser Sentry setup.
- [ ] 4.4 Review the final file list and confirm no temporary smoke route/page remains.
- [ ] 4.5 Review committed config and confirm no real DSN or auth token is present.
