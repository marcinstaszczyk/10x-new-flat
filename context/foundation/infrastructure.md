---
project: 10xNewFlat
researched_at: 2026-05-27
recommended_platform: Cloudflare Workers
runner_up: Netlify
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 SSR with SolidJS islands
  runtime: Cloudflare Workers
  database: Supabase Postgres
  auth: Supabase Auth
---

# Infrastructure Decision

## Recommendation

**Deploy on Cloudflare Workers.**

The project already uses `@astrojs/cloudflare`, `wrangler`, `output: "server"`, and a Workers-compatible `wrangler.jsonc`, so Cloudflare Workers is the lowest-change deployment path. The user constraints favor a stateless, low-cost MVP with no persistent connections, and Cloudflare's Workers free tier is enough for low traffic if the SSR and extraction routes stay within CPU limits.

Important correction: this is **Cloudflare Workers**, not Cloudflare Pages. The Astro 6 Cloudflare adapter no longer supports Pages for this setup.

## Platform Comparison

Scoring key: Pass = 2, Partial = 1, Fail = 0. Total is the base agent-friendly score before stack-fit and cost weighting.

| Platform | CLI-first | Managed/serverless | Agent-readable docs | Stable deploy API | MCP/integration | Total | Fit for this MVP |
|---|---:|---:|---:|---:|---:|---:|---|
| Cloudflare Workers | Pass | Pass | Pass | Pass | Pass | 10 | Best fit: current adapter, lowest cost, global edge available even if not required. |
| Netlify | Pass | Pass | Pass | Pass | Pass | 10 | Strong fallback, but requires switching from Cloudflare adapter and Wrangler config. |
| Vercel | Pass | Pass | Pass | Pass | Partial | 9 | Strong DX, but requires adapter switch and has Hobby/Pro cost and rollback limits. Vercel MCP is beta as checked 2026-05-27. |
| Railway | Pass | Pass | Pass | Pass | Pass | 10 | Great agent story, but needs Node/container-style deployment and a paid Hobby baseline for realistic use. |
| Render | Partial | Pass | Partial | Pass | Partial | 7 | Free web services exist, but free production limitations and less direct Astro edge fit make it weaker. |
| Fly.io | Pass | Partial | Pass | Pass | Partial | 8 | Excellent for persistent processes, but no free tier and more VM/container operations than this MVP needs. |

Cloudflare, Netlify, and Vercel were shortlisted after applying the stack and cost weighting. Railway scores well in isolation, but the current app is already shaped around Cloudflare Workers and the user prioritized minimum monthly cost.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Cloudflare wins because it is already the configured target and supports the project's Astro 6 SSR path through `@astrojs/cloudflare` and `wrangler deploy`. It also provides a CLI-first workflow, Workers Logs, rollback through Worker versions, preview URLs through Worker versions, and official MCP servers for API/docs/builds. The main caveat is runtime fit: Workers are not full Node servers, so heavy extraction dependencies must be checked against `workerd`.

#### 2. Netlify

Netlify is the best fallback if Cloudflare runtime constraints block the project. It has an official Astro adapter, CLI, deploy previews, rollback, logs, and an official MCP server. The cost model is now credit-based; the free plan can work for small MVPs, but production deploys, requests, bandwidth, and compute all consume credits.

#### 3. Vercel

Vercel has polished deploy, logs, rollback, and an official Astro adapter. Its MCP server is beta as checked on 2026-05-27. It is less attractive here because the project is not Next.js, the Cloudflare adapter would need to be replaced, and the free Hobby plan has usage and commercial-context caveats.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate - Weaknesses

1. The app has a 60-second extraction requirement. If extraction becomes CPU-heavy inside the Worker instead of waiting on an external API, the free tier CPU limits can break the flow.
2. Astro 6 with Cloudflare uses `workerd`, not a full Node runtime. Any package that depends on unsupported Node APIs can pass local TypeScript checks and still fail in the target runtime.
3. The existing `wrangler.jsonc` name is still `10x-astro-starter`. If it is not renamed before first production deploy, the deployed Worker will inherit the starter name.
4. Supabase remains external. Preview and production Workers can accidentally point at the same Supabase project unless secrets and environments are intentionally separated.
5. Rollback only reverts Worker code/config versions. Supabase schema migrations and data changes do not roll back with `wrangler rollback`.

### Pre-Mortem - How This Could Fail

Six months after launch, the Cloudflare choice failed because the team treated "serverless SSR" as equivalent to a normal Node server. Offer extraction started as an external API call, but later code added local parsing, document handling, and validation packages that depended on Node APIs and consumed too much CPU. Preview deployments used the same Supabase project as production, so test users polluted production data and one schema migration broke old Worker versions. The team relied on rollback during an incident, but the failing deploy had already applied an incompatible Supabase migration. `wrangler rollback` restored the Worker code while the database stayed on the new schema, so the app remained broken. The root cause was not Cloudflare itself; it was failing to treat Workers runtime limits, per-environment secrets, and database migrations as separate operational concerns.

### Unknown Unknowns

- Astro 6 determines the Cloudflare environment during the build phase. For non-production environments, build with `CLOUDFLARE_ENV` set before deploying; do not assume `wrangler deploy --env` alone selects the runtime environment.
- The Astro Cloudflare adapter removed Pages support. Any old "Cloudflare Pages" command or dashboard flow is the wrong target for this project.
- Cloudflare preview URLs are public unless protected with Cloudflare Access.
- Worker secrets are not deleted by normal deploys, but plaintext vars in Wrangler config can overwrite dashboard-edited values. Keep secrets in Worker secrets, not committed config.
- Cloudflare rollback does not change deleted/modified bindings or Supabase schema/data state.

## Operational Story

- **Preview deploys**: Use Cloudflare Workers Builds or `pnpm exec wrangler versions upload --preview-alias <alias>` for a public Worker preview URL. Protect previews with Cloudflare Access before using production-like Supabase data.
- **Secrets**: Store `SUPABASE_URL` and `SUPABASE_KEY` as Worker secrets via `pnpm exec wrangler secret put SUPABASE_URL` and `pnpm exec wrangler secret put SUPABASE_KEY`. Use `.dev.vars` only for local development and keep it uncommitted. Accepted constraint: Supabase env separation is required before meaningful previews.
- **Rollback**: Use `pnpm exec wrangler rollback --message "rollback to previous Worker version"` for code rollback, or pass a specific version ID. Supabase migrations and data changes require a separate manual rollback plan.
- **Approval**: Agents may run lint/build, create preview versions, read logs, and propose deployment commands. A human approves production deploys, secret rotation, Cloudflare Access changes, and any Supabase schema/data migration.
- **Logs**: Use `pnpm exec wrangler tail` for live runtime logs and Cloudflare Workers Logs for retained logs. For build logs, use Workers Builds/GitHub checks or Cloudflare dashboard read-only access.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---:|---:|---|
| CPU-heavy extraction exceeds Worker limits | Devil's advocate | Medium | High | Keep extraction as external API wait plus light validation; load-test the slowest route before production. |
| Unsupported Node APIs in dependencies | Unknown unknowns | Medium | High | Verify new extraction/parser packages with `pnpm run build` and a Worker preview before merging. |
| Preview and production share Supabase data | Devil's advocate | Medium | High | Create separate Supabase projects or at minimum separate credentials and RLS-safe seed data per environment. |
| Rollback does not revert database migrations | Pre-mortem | Medium | High | Require reversible migrations or manual rollback notes before applying schema changes. |
| Old Pages docs/commands cause wrong deploy target | Research finding | Low | Medium | Document Workers-only deployment and reject `pages deploy` commands for this repo. |
| Public preview URLs expose test data | Unknown unknowns | Medium | Medium | Enable Cloudflare Access before previews use real or production-like data. |
| Starter Worker name leaks into production | Devil's advocate | High | Low | Rename `wrangler.jsonc` `name` to `10x-new-flat` before first deploy. |

## Getting Started

1. Rename `wrangler.jsonc` `name` from `10x-astro-starter` to the intended Worker name, likely `10x-new-flat`.
2. Set production Supabase secrets in Cloudflare Workers: `pnpm exec wrangler secret put SUPABASE_URL` and `pnpm exec wrangler secret put SUPABASE_KEY`.
3. Run local verification: `pnpm run lint` and `pnpm run build`.
4. Deploy production only after the human gate: `pnpm exec wrangler deploy`.
5. Verify auth and one protected route on the deployed `workers.dev` URL, then tail logs with `pnpm exec wrangler tail`.

## Out of Scope

- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture: multi-region HA, DR, enterprise observability
- Supabase project provisioning and migration execution

## Sources Checked

- Astro Cloudflare adapter: https://docs.astro.build/en/guides/integrations-guide/cloudflare/
- Cloudflare Workers Astro guide: https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/
- Cloudflare Workers pricing: https://www.cloudflare.com/plans/
- Cloudflare Workers secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Cloudflare Workers rollback: https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/
- Cloudflare preview URLs: https://developers.cloudflare.com/workers/configuration/previews/
- Cloudflare MCP servers: https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/
- Netlify pricing and MCP docs: https://www.netlify.com/pricing/ and https://docs.netlify.com/build/build-with-ai/netlify-mcp-server/
- Vercel pricing and MCP docs: https://vercel.com/pricing and https://vercel.com/docs/agent-resources/vercel-mcp
- Fly.io pricing and CLI docs: https://fly.io/docs/about/pricing/ and https://fly.io/docs/flyctl/
- Railway pricing, CLI, and MCP docs: https://docs.railway.com/pricing, https://docs.railway.com/cli, and https://docs.railway.com/cli/mcp
- Render free tier, CLI, and MCP docs: https://render.com/docs/free, https://render.com/docs/cli, and https://render.com/docs/mcp-server
