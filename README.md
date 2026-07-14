# 10x Astro Starter

![](./public/template.png)

A modern, opinionated starter template for building fast, accessible web applications.

## Tech Stack

- [Astro](https://astro.build/) v6 - Modern web framework with server-first rendering
- [SolidJS](https://www.solidjs.com/) v1 - UI library for interactive components
- [TypeScript](https://www.typescriptlang.org/) v5 - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4 - Utility-first CSS framework
- [Supabase](https://supabase.com/) - Authentication and backend-as-a-service
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge deployment runtime

## Prerequisites

- Node.js v24.15.0 (as specified in `.nvmrc`)
- pnpm

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/przeprogramowani/10x-astro-starter.git
cd 10x-astro-starter
```

2. Install dependencies:

```bash
pnpm install
```

3. Set up Supabase and configure environment variables — see [Supabase Configuration](#supabase-configuration) below.

4. Create a `.dev.vars` file for local Cloudflare dev secrets:

```bash
cp .env.example .dev.vars
```

5. Run the development server:

```bash
pnpm run dev
```

## Available Scripts

- `pnpm run dev` - Start development server (Cloudflare workerd runtime)
- `pnpm run build` - Build for production
- `pnpm run preview` - Preview production build
- `pnpm run test:app` - Run deterministic application tests
- `pnpm run check:extraction-contract` - Run the live OpenRouter extraction contract check
- `pnpm run lint` - Run ESLint with type-checked rules
- `pnpm run lint:fix` - Auto-fix ESLint issues
- `pnpm run format` - Run Prettier

## Project Structure

```md
.
├── src/
│ ├── layouts/ # Astro layouts
│ ├── pages/ # Astro pages
│ │ └── api/ # API endpoints
│ ├── components/ # UI components (Astro & SolidJS)
│ └── assets/ # Static assets
├── public/ # Public assets
├── wrangler.jsonc # Cloudflare Workers config
```

## Supabase Configuration

This project uses [Supabase](https://supabase.com/) for authentication and product persistence. Environment variables are declared via Astro's `astro:env` schema and are treated as **server-only secrets** — they are never exposed to the client.

### First-time setup (local, no cloud project needed)

Requires [Docker](https://www.docker.com/) and ~7 GB RAM.

1. Create your `.env` file:

```bash
cp .env.example .env
```

2. Start the local stack (downloads Docker images on first run):

```bash
pnpm exec supabase start
```

3. Copy the credentials printed by the CLI into your `.env` and `.dev.vars`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from CLI output>
```

4. To stop the stack when done:

```bash
pnpm exec supabase stop
```

The local Studio UI is available at `http://localhost:54323`.

### Buyer question base

Authenticated buyers receive a personal question base lazily. The first `/dashboard` visit initializes the buyer-owned copy from active `question_templates`; repeat visits preserve that copy and do not synchronize later template changes automatically.

The dashboard includes a confirmed reset action. Reset is destructive: it deletes every current buyer question, including future personal rows, and recreates the list from the active template document.

Manual dashboard verification uses local Supabase plus `pnpm run dev`: sign in, open `/dashboard`, confirm the ordered list is created, reload to verify the row set is stable, cancel reset to verify no mutation, then confirm reset and verify the success feedback plus complete ordered list.

### Saved pasted offers

Authenticated buyers can use `/offers` to save private flat-offer source material before extraction exists. Each saved offer has a title, pasted offer-page content, and an optional source URL. Saved offers are read-only in this slice: there is no editing, extraction, comparison, scoring, or structured flat-attribute UI.

Deletion is a confirmed hard delete. Once confirmed, the offer row and pasted content are removed immediately and disappear from the list and direct detail access.

Manual saved-offer verification uses local Supabase plus `pnpm run dev`: sign in, open `/offers`, create offers with and without a source URL, confirm read-only detail rendering, submit invalid input to confirm generic error feedback, verify newest-updated list ordering, cancel and confirm delete, and check unauthenticated redirects for `/offers`, `/offers/new`, detail pages, and `/api/offers/**`.

### Extraction contract check

Extraction is currently a server-side contract probe only. Results are not persisted, not shown in the UI, and not connected to saved-offer detail pages in this slice.

The live check uses OpenRouter and requires a process-level API key:

```bash
OPENROUTER_API_KEY=<key> pnpm run check:extraction-contract
```

Optional model override:

```bash
OPENROUTER_MODEL=openai/gpt-5.5
```

The command validates the fixture in `scripts/fixtures/extraction-contract/` against the shared extraction schema and prints only model, latency, bucket counts, and safe failure reasons. It intentionally does not run during `pnpm run build` because it needs network access and a human-approved OpenRouter secret. For hosted or CI use, configure `OPENROUTER_API_KEY` as a Cloudflare Worker or CI secret, not as committed Wrangler plaintext.

### Sentry error reporting

Sentry captures server and browser production errors plus `console.warn` and `console.error`. Source map upload is intentionally disabled.

Use the same Sentry project DSN value for both variables:

```
SENTRY_DSN=<sentry dsn>
PUBLIC_SENTRY_DSN=<same sentry dsn>
```

For local checks, set both values in `.env` and `.dev.vars`. For Cloudflare Workers, configure `SENTRY_DSN` as a runtime secret or binding. `PUBLIC_SENTRY_DSN` must be available where browser assets are built, including GitHub Actions when CI builds the deploy artifact; adding it only as a Worker runtime secret is not enough. Do not commit real DSN values.

### Database content migrations

`supabase/migrations/` is the canonical source for database schema and product content. The fixed Polish buyer-question list is delivered by the question-template migration so local, preview, and production environments receive the same ordered document.

Never edit a migration that has already been applied to a shared environment. Change template wording, ordering, or active status through a new migration so existing buyer copies remain independent and migration history stays reproducible.

### Reset and test the local database

Install dependencies and start Docker before running the pinned Supabase CLI:

```bash
pnpm exec supabase start
```

Apply all migrations from a clean local database:

```bash
pnpm exec supabase db reset
```

`db reset` is destructive: it deletes all local database data before replaying `supabase/migrations/`. Those migrations are the production schema and product-content history; `supabase/tests/database/` contains the executable schema and RLS contract.

Run the complete database test suite:

```bash
pnpm exec supabase test db
```

The tests run in transactions and verify template content, anonymous denial, buyer isolation, ownership mutations, provenance, and account-deletion cleanup.

### Using a cloud Supabase project instead

If you prefer to use a hosted Supabase project, add these variables to your `.env` and `.dev.vars` files:

| Variable       | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `SUPABASE_URL` | Project URL from Supabase dashboard → Settings → API       |
| `SUPABASE_KEY` | `anon` public key from Supabase dashboard → Settings → API |

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon-key>
```

Worker deployment does not apply or roll back Supabase migrations. Applying `supabase/migrations/` to a hosted project is a separate, human-approved operation. Review the migration diff and compatibility impact before running the approved hosted database deployment.

For the initial question-contract migrations:

- If the schema has no consumers and contains no buyer data, a reviewed manual rollback may remove the unused question tables, trigger function, and enum in dependency order.
- Once any consumer or buyer data exists, preserve the current contract and ship a forward-fix migration instead of dropping columns, tables, policies, or rewriting applied history.
- Correct erroneous template content with a new migration that retires or supersedes affected templates. Do not delete referenced templates.
- Before rolling back Worker code, confirm the older application remains compatible with the currently applied database schema.

### Email confirmation in local development

By default Supabase requires email confirmation before a user can sign in. To skip this during local development:

1. Open the Supabase dashboard for your project
2. Go to **Authentication → Email → Confirm email**
3. Toggle it **off**

Users can then sign in immediately after sign-up without clicking a confirmation link.

### Auth routes

| Route                 | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `/auth/signin`        | Email/password sign-in form                                             |
| `/auth/signup`        | Email/password sign-up form                                             |
| `/auth/confirm-email` | Post-signup "check your inbox" page                                     |
| `/dashboard`          | Example protected page (redirects to `/auth/signin` if unauthenticated) |
| `/offers`             | Protected saved-offer workspace for pasted flat-offer content           |

Route protection is handled in `src/middleware.ts`. Add paths to the `PROTECTED_ROUTES` array there to require authentication.

## Deployment

This project deploys to [Cloudflare Workers](https://workers.cloudflare.com/).

1. Build the project:

```bash
pnpm run build
```

2. Deploy with Wrangler:

```bash
npx wrangler deploy
```

Set `SUPABASE_URL`, `SUPABASE_KEY`, and `SENTRY_DSN` as secrets in your Cloudflare dashboard or via `npx wrangler secret put`. Provide `PUBLIC_SENTRY_DSN` to the production build environment.

## CI

GitHub Actions runs Astro sync, deterministic application tests, package-local AI-review tests, workflow validation, lint, and build on every push and PR to `main`. It does not call an AI provider.

Run the reviewer tests locally with:

```bash
npm ci --prefix packages/code-review
npm test --prefix packages/code-review
```

AI code review runs only for same-repository pull requests. Fork PRs intentionally skip it because provider credentials are not exposed to untrusted repositories. A completed review has one terminal label: `ai-cr:passed`, `ai-cr:failed`, or `ai-cr:error`. The error label covers review execution, validation, or input-context failures; a publication failure is surfaced by the required review gate.

Configure `SUPABASE_URL`, `SUPABASE_KEY`, and `PUBLIC_SENTRY_DSN` as repository secrets in GitHub for the build step.

## License

MIT
