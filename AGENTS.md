# Repository Guidelines

This is an Astro 6 server-rendered app with SolidJS islands, Tailwind CSS v4, Supabase auth, and Cloudflare Workers deployment. Product and stack context lives in @context/foundation/prd.md and @context/foundation/tech-stack.md.

## Critical Rules

- Keep `output: "server"` in @astro.config.mjs; API routes must export `const prerender = false`.
- `src/middleware.ts` resolves the user on every request and stores it in `context.locals.user`. Use that value for protected server-rendered pages instead of client-side auth checks.
- Supabase env values are server-only secrets. Create server clients through `src/lib/supabase.ts`; keep `SUPABASE_URL` and `SUPABASE_KEY` server-only via `astro:env/server`. Add or rename variables in @astro.config.mjs, and keep `.env`, `.dev.vars`, and @.env.example aligned.
- New Supabase tables must enable RLS and define explicit SELECT, INSERT, UPDATE, and DELETE policies for each role that can access the table.
- API routes use uppercase `GET`/`POST` exports, set `prerender = false`, and validate request input with zod.
- Do not write under @context/archive/; archived changes are immutable.
- Do not invent a test command: no test runner or test config exists. For UI/auth changes, run `pnpm run dev` and manually verify the affected route or auth flow; otherwise state why no manual check was needed.

## Commands

- Use scripts from @package.json; Node version is fixed in @.nvmrc.
- Before handing off, run `pnpm run lint` and `pnpm run build` unless the change only touches docs; report skipped commands.
- CI in @.github/workflows/ci.yml uses `npm ci`, `npx astro sync`, `npm run lint`, and `npm run build`; account for both lockfiles when changing dependencies.

## Project Shape

- Stack: Astro 6 SSR, SolidJS islands, Tailwind 4, Supabase auth, shadcn/ui components, Cloudflare Workers.
- API endpoints live in `src/pages/api/**` and export `APIRoute` handlers.
- Auth endpoints live in `src/pages/api/auth/{signin,signup,signout}.ts`; pages live in `src/pages/auth/{signin,signup,confirm-email}.astro`; protected page example is `src/pages/dashboard.astro`.
- `src/components/` holds Astro components and Solid `.tsx` islands; shared primitives live in `src/components/ui/`.
- `src/lib/` holds reusable helpers such as `createClient` and `cn`.
- `src/middleware.ts` owns auth population and `PROTECTED_ROUTES`; add protected paths there.
- Shared entities and DTOs go in `src/types.ts`.
- `supabase/` contains local Supabase config; @wrangler.jsonc owns Cloudflare runtime settings.

## Coding Conventions

- Use `@/` imports for `src` paths; `@/*` maps to `./src/*` in @tsconfig.json.
- Use Astro components for static content/layout; use SolidJS only when interactivity is needed.
- Solid components use `PascalCase.tsx`, local interfaces named `Props`, `createSignal` local state, and default exports for page-level islands.
- Move Solid logic shared by 2+ components to `src/components/hooks/use<Name>.ts`; keep page-only signals local.
- Use `cn()` from `@/lib/utils` for conditional or merged Tailwind classes; do not concatenate class strings manually.
- UI variants follow the existing `cva` pattern in @src/components/ui/button.tsx. Components in `src/components/ui/` follow the shadcn-style "new-york" variant.
- API auth handlers redirect with query-string errors and call `createClient(context.request.headers, context.cookies)`; preserve the null-client path because auth is disabled when Supabase config is missing.
- Put cross-route/domain operations used by 2+ callers in `src/lib/services/<name>.ts`; keep single-use helpers beside the caller.
- Name Supabase migrations `YYYYMMDDHHmmss_short_description.sql` in `supabase/migrations/`.

## Git

- Recent history uses short Conventional Commit prefixes, mainly `chore:` and `docs:`.
- Ensure the GitHub Actions CI gate can pass with required Supabase secrets.

## References

- Scripts and lint-staged config: @package.json.
- Setup, Supabase local dev, and deployment: @README.md.
- Node version: @.nvmrc.
- Env template: @.env.example.
- CI workflow: @.github/workflows/ci.yml.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 2, Lesson 2

Turn one roadmap item into the first implementation cycle with the **change planning chain**:

```
/10x-roadmap -> /10x-new -> /10x-plan -> /10x-plan-review -> /10x-implement
```

`/10x-new`, `/10x-plan`, `/10x-plan-review`, and `/10x-implement` are the lesson focus. `/10x-frame` and `/10x-research` are not required rituals here; they are escalation paths introduced in the next lesson.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Change setup (lesson focus)** | |
| `/10x-new <change-id>` | You selected a roadmap item and need a stable change folder. Creates `context/changes/<change-id>/change.md` so planning, implementation, progress, commits, and later review all share one identity. Use AFTER roadmap selection, BEFORE `/10x-plan`. |
| **Planning (lesson focus)** | |
| `/10x-plan <change-id>` | You have a change folder and need a reviewable implementation plan. Reads roadmap context, foundation docs, codebase evidence, and any existing change notes; writes `plan.md` and `plan-brief.md` with phases, file contracts, success criteria, and `## Progress`. |
| **Plan readiness (lesson focus)** | |
| `/10x-plan-review <change-id>` | You have `plan.md` and need a light pre-code readiness check. Use it to catch missing end state, weak contracts, malformed progress, scope drift, or blind spots before code changes begin. |
| **Implementation (lesson focus)** | |
| `/10x-implement <change-id> phase <n>` | You have an approved plan and want to execute one phase with verification, manual gate, commit ritual, and SHA write-back to `## Progress`. |
| **Lifecycle closure** | |
| `/10x-archive <change-id>` | A change is merged or intentionally closed. Move it out of active `context/changes/` into archive state. |

### How the chain hands off

- `/10x-new` creates the durable change identity.
- `/10x-plan` turns that identity into an implementation contract.
- `/10x-plan-review` checks the plan before the agent mutates code.
- `/10x-implement` executes one planned phase, verifies, asks for manual confirmation when needed, commits, and records progress.

### Lesson boundaries

- Plan is the default router after roadmap selection. Start with `/10x-plan` unless the problem is unclear or external evidence is blocking.
- Do not run `/10x-frame + /10x-research` as ceremony for every change.
- Do not turn this lesson into a full end-to-end product build. A checkpoint with a planned and partially or fully implemented stream is valid.
- Code review of the implemented diff belongs to Lesson 3 via `/10x-impl-review`.
- Lifecycle closure via `/10x-archive` after a change is merged or intentionally closed.

### Paths used by this lesson

- `context/foundation/roadmap.md` - upstream roadmap
- `context/changes/<change-id>/change.md` - change identity
- `context/changes/<change-id>/plan.md` - implementation contract
- `context/changes/<change-id>/plan-brief.md` - compressed handoff
- `context/foundation/lessons.md` - recurring rules and pitfalls
- `docs/reference/contract-surfaces.md` - load-bearing names registry

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
