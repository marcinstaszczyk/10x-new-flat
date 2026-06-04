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

2. Initialize the local Supabase project (creates a `supabase/` config folder):

```bash
npx supabase init
```

3. Start the local stack (downloads Docker images on first run):

```bash
npx supabase start
```

4. Copy the credentials printed by the CLI into your `.env` and `.dev.vars`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from CLI output>
```

5. To stop the stack when done:

```bash
npx supabase stop
```

The local Studio UI is available at `http://localhost:54323`.

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

Set `SUPABASE_URL` and `SUPABASE_KEY` as secrets in your Cloudflare dashboard or via `npx wrangler secret put`.

## CI

GitHub Actions runs lint + build on every push and PR to `master`. Configure `SUPABASE_URL` and `SUPABASE_KEY` as repository secrets in GitHub for the build step.

## License

MIT
