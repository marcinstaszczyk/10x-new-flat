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

## Communication Language

- Communicate with the user and write project documentation in English unless the user explicitly requests another language.
- Preserve another language only when quoting or editing existing localized content.
- Never infer the preferred language from source-document language, locale, timezone, file names, or repository contents.

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

## 10xDevs AI Toolkit - Module 2, Lesson 3

Review AI-generated code before merge with the **implementation review chain**:

```
/10x-implement -> /10x-impl-review -> triage -> (/10x-lesson | fix | skip | disagree)
```

`/10x-impl-review` is the lesson focus. Review is a quality gate, not an instruction to fix every finding.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Code review (lesson focus)** | |
| `/10x-impl-review <change-id>` | You have implemented code and want a structured review before merge. The skill checks plan adherence, scope discipline, safety and quality, architecture, pattern consistency, and success criteria, then presents findings for triage. |
| **Recurring lesson outcome** | |
| `/10x-lesson` | A finding reveals a recurring project rule or agent failure pattern. Record it in `context/foundation/lessons.md` instead of treating it as a one-off note. |

### Triage discipline

- Severity says how bad the finding is. Impact says how much the decision matters now.
- Valid outcomes: fix now, fix differently, skip, accept as risk, record as recurring rule (`/10x-lesson`), disagree.
- Fix critical findings. Do not burn hours on low-impact observations just because the agent found them.
- Conscious skipping of low-impact findings is a valid review outcome, not negligence.
- If you disagree with a finding, record why. Wrong agent reasoning is also signal.

### Review boundaries

- This lesson reviews implemented code. It does not create the plan, execute new phases, or teach CI review.
- Testing strategy and quality gates are introduced in Module 3.
- Do not use `/10x-contract` as a triage outcome in this lesson.

### Paths used by this lesson

- `context/changes/<change-id>/plan.md` - expected implementation contract
- `context/changes/<change-id>/reviews/` - review output
- `context/foundation/lessons.md` - recurring lessons

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
