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

## 10xDevs AI Toolkit - Module 2, Lesson 4

Prepare for a harder implementation stream with the **research-backed planning chain**:

```
internal research (/10x-research) + external research (exa.ai, Context7) -> /10x-plan -> /10x-implement -> success
```

The lesson focus is distinguishing internal from external research and using evidence to back planning decisions.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Internal research (lesson focus)** | |
| `/10x-research <change-id>` | You need evidence from the existing codebase — patterns, conventions, integration points, or existing implementations. Runs parallel sub-agents over the repo and writes structured findings to `research.md`. |
| **External research (lesson focus)** | |
| exa.ai | You need AI-native web search for library comparisons, best practices, or ecosystem context that the codebase cannot answer. |
| Context7 (`resolve-library-id` → `get-library-docs`) | You need live, current documentation for a specific library or framework. Resolves a library ID first, then fetches relevant doc pages. |
| **Framing spare wheel** | |
| `/10x-frame <change-id>` | The plan won't converge, the plan doesn't deliver expected results, or persistent drift keeps breaking the implementation. Use as an escape hatch on a separate problem (demonstrated on Space Explorers example), not as pre-research ritual. |
| **Planning and execution** | |
| `/10x-plan <change-id>` / `/10x-implement <change-id> phase <n>` | Use the same planning and execution chain from Lesson 2, now with upstream research evidence feeding the plan. |

### Research discipline

- Internal research (`/10x-research`) answers "what does our codebase already do?" — patterns, schemas, conventions, integration points.
- External research (exa.ai, Context7) answers "what should we do?" — library capabilities, API docs, ecosystem best practices.
- Combine both as evidence-backed input to `/10x-plan`. A plan without research evidence on a non-trivial stream is a guess.
- Agent-friendly docs (`llms.txt`, markdown-for-agents, `/md` endpoints) are a quality signal for library selection — libraries that publish agent-readable docs integrate faster.

### `/10x-frame` as spare wheel

Three triggers for reaching for `/10x-frame`:
1. The plan won't converge — research keeps opening more questions instead of narrowing to a contract.
2. The plan doesn't deliver — implementation repeatedly fails to meet success criteria.
3. Persistent drift — the implementation keeps diverging from the plan in ways that suggest the problem was mis-framed.

Demonstrated on a Space Explorers example, not the SRS path. It is an escape hatch, not a mandatory step.

### Paths used by this lesson

- `context/changes/<change-id>/research.md` - internal research output
- `context/changes/<change-id>/frame.md` - framing output when needed
- `context/changes/<change-id>/plan.md` - evidence-backed implementation contract
- `context/foundation/lessons.md` - recurring rules and pitfalls

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
