---
title: Supabase Anti-Corruption Layer Refactor Plan
created: 2026-06-12
type: refactor-plan
---

# Supabase Anti-Corruption Layer Refactor Plan

Product: refactoring plan only. No production code changes in this document.

## STEP 0 - Context Discovery

### Base Documents

- The stack is Astro 6 SSR with SolidJS islands, Supabase, and Cloudflare Workers: `README.md:9`, `README.md:10`, `README.md:13`, `README.md:14`.
- Supabase is declared as both authentication and backend persistence: `README.md:13`, `README.md:76`.
- Supabase environment values are documented as server-only secrets: `README.md:76`.
- The tech-stack decision intentionally kept the starter's Supabase and Cloudflare structure while replacing React islands with SolidJS: `context/foundation/tech-stack.md:24`.
- Infrastructure docs mark Supabase as external operational state: `context/foundation/infrastructure.md:61`, and warn that Worker rollback does not roll back Supabase migrations/data: `context/foundation/infrastructure.md:62`, `context/foundation/infrastructure.md:74`, `README.md:200`.
- The docs declare a product invariant for buyer question bases: repeat visits preserve the initialized copy and reset is the explicit replacement path: `README.md:111`, `context/foundation/prd.md:72`, `context/foundation/prd.md:115`.

There is no document saying Supabase itself must be swappable. The stronger intent-vs-code signal is operational: Supabase is external state and server-only infrastructure, but its SDK/query shape is currently visible in application services, SSR pages, API handlers, type declarations, and tests.

### Package Manifest Dependencies

Runtime dependencies include Astro/Solid, Sentry, Supabase, zod, and UI helpers: `package.json:19`, `package.json:20`, `package.json:22`, `package.json:24`, `package.json:25`, `package.json:26`, `package.json:27`, `package.json:33`, `package.json:37`.

Dev/runtime tooling includes Playwright, Supabase CLI, Vitest, and Wrangler: `package.json:42`, `package.json:54`, `package.json:57`, `package.json:58`.

### Code Layers Found

- Framework/runtime: `astro.config.mjs`, `src/env.d.ts`, `src/middleware.ts`.
- Infrastructure helpers: `src/lib/supabase.ts`, `src/lib/config-status.ts`, Sentry config files.
- Application/API routes: `src/pages/api/**`.
- Server-rendered page composition: `src/pages/**/*.astro`.
- Product services: `src/lib/services/**`.
- Domain-ish shared types and generated database contract: `src/types.ts`.
- UI components/islands: `src/components/**`.
- Test fixtures and E2E helpers: `src/test/**`, `tests/e2e/**`.

## STEP 1 - Leaking Dependency Identification

### Candidate A: Supabase (`@supabase/ssr`, `@supabase/supabase-js`)

Direct package knowledge:

- `package.json:26` declares `@supabase/ssr`.
- `package.json:27` declares `@supabase/supabase-js`.
- `src/env.d.ts:3` exposes `import("@supabase/supabase-js").User` in Astro locals.
- `src/lib/supabase.ts:1` imports `createServerClient` and `parseCookieHeader` from `@supabase/ssr`.
- `tests/e2e/support/auth.ts:3` imports `createClient` from `@supabase/supabase-js`.
- `src/test/fixtures/offer-preparation-client.ts:1` imports `SupabaseClient`.
- `src/lib/services/offers.ts:1` imports `SupabaseClient`.
- `src/lib/services/questions.ts:1` imports `SupabaseClient`.
- `src/lib/services/offer-extraction-results.ts:1` imports `SupabaseClient`.
- `src/lib/services/offer-preparation.ts:1` imports `SupabaseClient`.

Concrete client creation and auth/query knowledge outside an adapter:

- `src/lib/supabase.ts:6` creates a client from request headers and cookies.
- `src/lib/supabase.ts:10` returns `createServerClient<Database>(...)`.
- `src/middleware.ts:7` creates the concrete client.
- `src/middleware.ts:12` calls `supabase.auth.getUser()`.
- `src/pages/dashboard.astro:9` creates a concrete client in page frontmatter.
- `src/pages/dashboard.astro:10` passes the client to `loadBuyerQuestionBase`.
- `src/pages/offers/index.astro:8` creates a concrete client in page frontmatter.
- `src/pages/offers/index.astro:9` passes the client to `listSavedOffers`.
- `src/pages/offers/[id].astro:13` creates a concrete client in page frontmatter.
- `src/pages/offers/[id].astro:14` passes the client to `loadSavedOffer`.
- `src/pages/offers/[id].astro:20` branches on the concrete client.
- `src/pages/offers/[id].astro:21` passes the client to `loadOfferExtractionResult`.
- `src/pages/offers/[id].astro:22` passes the client to `loadBuyerQuestionBase`.
- `src/pages/api/auth/signin.ts:9` creates a concrete client.
- `src/pages/api/auth/signin.ts:13` calls `supabase.auth.signInWithPassword`.
- `src/pages/api/auth/signup.ts:9` creates a concrete client.
- `src/pages/api/auth/signup.ts:13` calls `supabase.auth.signUp`.
- `src/pages/api/auth/signout.ts:5` creates a concrete client.
- `src/pages/api/auth/signout.ts:7` calls `supabase.auth.signOut`.
- `src/pages/api/questions/reset.ts:32` creates a concrete client.
- `src/pages/api/questions/reset.ts:37` passes it to `resetBuyerQuestionBase`.
- `src/pages/api/offers/create.ts:40` creates a concrete client.
- `src/pages/api/offers/create.ts:45` passes it to `createSavedOffer`.
- `src/pages/api/offers/[id]/prepare.ts:26` creates a concrete client.
- `src/pages/api/offers/[id]/prepare.ts:31` passes it to `prepareOfferViewing`.
- `src/pages/api/offers/[id]/delete.ts:34` creates a concrete client.
- `src/pages/api/offers/[id]/delete.ts:39` passes it to `deleteSavedOffer`.

Supabase query-builder/table/RPC shape in services:

- `src/lib/services/offers.ts:4` aliases `SupabaseClient<Database>`.
- `src/lib/services/offers.ts:6` reconstructs a `FlatOfferRow` from `Database["public"]["Tables"]["flat_offers"]["Row"]`.
- `src/lib/services/offers.ts:46` accepts `client: OfferClient` in a product service.
- `src/lib/services/offers.ts:48` calls `.from("flat_offers")`.
- `src/lib/services/offers.ts:67` calls `.from("flat_offers")`.
- `src/lib/services/offers.ts:89` calls `.from("flat_offers")`.
- `src/lib/services/offers.ts:106` calls `.from("flat_offers").delete()`.
- `src/lib/services/questions.ts:4` aliases `SupabaseClient<Database>`.
- `src/lib/services/questions.ts:6` reconstructs a `BuyerQuestionRow` from `Database["public"]["Tables"]["buyer_questions"]["Row"]`.
- `src/lib/services/questions.ts:22` accepts `client: QuestionClient` in a product service.
- `src/lib/services/questions.ts:23` calls `rpc("ensure_buyer_question_base")`.
- `src/lib/services/questions.ts:30` calls `.from("buyer_questions")`.
- `src/lib/services/questions.ts:46` calls `rpc("reset_buyer_question_base")`.
- `src/lib/services/offer-extraction-results.ts:5` aliases `SupabaseClient<Database>`.
- `src/lib/services/offer-extraction-results.ts:7` reconstructs `OfferExtractionResultRow`.
- `src/lib/services/offer-extraction-results.ts:42` calls `.from("offer_extraction_results")`.
- `src/lib/services/offer-extraction-results.ts:73` calls `.from("offer_extraction_results")`.
- `src/lib/services/offer-preparation.ts:9` aliases `SupabaseClient<Database>`.
- `src/lib/services/offer-preparation.ts:29` accepts the concrete client in orchestration.
- `src/lib/services/offer-preparation.ts:35`, `src/lib/services/offer-preparation.ts:44`, `src/lib/services/offer-preparation.ts:61`, and `src/lib/services/offer-preparation.ts:82` pass the same client through multiple product operations.

Generated database shape leaks into shared domain types:

- `src/types.ts:83` defines DB insert/update helpers.
- `src/types.ts:98` defines `FlatOfferRecord`.
- `src/types.ts:108` defines `OfferExtractionResultRecord`.
- `src/types.ts:120` defines `BuyerQuestionRecord`.
- `src/types.ts:131` defines `QuestionTemplateRecord`.
- `src/types.ts:140` exports `Database`.
- `src/types.ts:143` exposes `flat_offers`.
- `src/types.ts:149` exposes `offer_extraction_results`.
- `src/types.ts:158` exposes `buyer_questions`.
- `src/types.ts:171` exposes `question_templates`.
- `src/types.ts:179` exposes database functions.
- `src/types.ts:189` exposes the database enum.

Tests know the SDK shape:

- `tests/e2e/support/auth.ts:38` creates an admin client.
- `tests/e2e/support/auth.ts:39` calls `admin.auth.admin.createUser`.
- `tests/e2e/support/auth.ts:64` calls `admin.auth.admin.deleteUser`.
- `tests/e2e/support/auth.ts:78` constructs a service-role client.
- `src/test/fixtures/offer-preparation-client.ts:39` returns `SupabaseClient<Database> & FakeSupabaseClient`.
- `src/test/fixtures/offer-preparation-client.ts:72` fakes table queries.

### Candidate B: OpenRouter HTTP API

Files that know OpenRouter:

- `README.md:127` says extraction is a server-side contract probe.
- `README.md:129` names OpenRouter.
- `README.md:141` describes the OpenRouter contract check and secret handling.
- `src/lib/services/extraction.ts:1` reads OpenRouter env values.
- `src/lib/services/extraction.ts:14` re-exports `buildOpenRouterRequest`.
- `src/lib/services/extraction.ts:39` resolves `OPENROUTER_API_KEY`.
- `src/lib/services/extraction.ts:45` calls `callOpenRouterExtraction`.
- `src/lib/services/extraction-provider.ts:4` hardcodes the OpenRouter chat completions URL.
- `src/lib/services/extraction-provider.ts:26` exposes `OpenRouterExtractionOptions`.
- `src/lib/services/extraction-provider.ts:34` reconstructs provider response shape.
- `src/lib/services/extraction-provider.ts:48` exports `callOpenRouterExtraction`.
- `src/lib/services/extraction-contract.ts:66` builds an OpenRouter-shaped request.
- `src/lib/services/extraction-contract.ts:74` uses provider `response_format`.
- `src/components/offers/OfferPreparationResult.astro:89` displays provider model metadata.
- `scripts/check-extraction-contract.mjs:7` imports `callOpenRouterExtraction`.
- `scripts/check-extraction-contract.mjs:12` reads `OPENROUTER_API_KEY`.
- `scripts/check-extraction-contract.mjs:28` calls `callOpenRouterExtraction`.
- `tests/e2e/README.md:21` depends on an OpenRouter mock switch.

This is a leak, but the provider-specific request/response shape is mostly inside extraction services. The UI leak is `model`, not an SDK object.

### Candidate C: zod

Files that know zod:

- `package.json:37` declares `zod`.
- `src/lib/services/extraction-contract.ts:1` imports zod.
- `src/lib/services/extraction-contract.ts:49` exports a zod schema.
- `src/lib/services/offer-extraction-results.ts:3` imports `completedExtractionResultSchema`.
- `src/lib/services/offer-extraction-results.ts:67` uses `safeParse`.
- `src/pages/api/questions/reset.ts:2` imports zod.
- `src/pages/api/questions/reset.ts:8` defines a zod request schema.
- `src/pages/api/questions/reset.ts:24` calls `safeParse`.
- `src/pages/api/offers/create.ts:2` imports zod.
- `src/pages/api/offers/create.ts:8` defines a zod request schema.
- `src/pages/api/offers/create.ts:30` calls `safeParse`.
- `src/pages/api/offers/[id]/prepare.ts:3` imports zod.
- `src/pages/api/offers/[id]/prepare.ts:10` defines a zod params schema.
- `src/pages/api/offers/[id]/prepare.ts:21` calls `safeParse`.
- `src/pages/api/offers/[id]/delete.ts:2` imports zod.
- `src/pages/api/offers/[id]/delete.ts:8` defines a zod request schema.
- `src/pages/api/offers/[id]/delete.ts:25` calls `safeParse`.

This crosses API and service layers, but it is validation tooling, not persistence/auth infrastructure. Replacement cost is lower than Supabase.

## STEP 2 - Classification and #1 Choice

| Dependency | Affected layers/files | Replacement risk today | Document intent divergence | Assessment |
|---|---:|---|---|---|
| Supabase | Very high: env typing, infra helper, middleware, API routes, SSR pages, services, shared database types, fixtures, E2E support | High: auth, cookies, RLS-backed persistence, table/RPC names, service-role test setup, migration coupling | Medium: docs do not promise Supabase swap, but they declare server-only secrets and external DB state; code lets SDK/query shape drive application services | Worst leak |
| OpenRouter HTTP API | Medium: extraction service, contract builder, script, UI metadata, E2E mock | Medium: provider prompt/response format and model metadata | Low: docs already call it a server-side contract probe | Contained enough for now |
| zod | Medium: API handlers and extraction contract | Low/medium: validation syntax swap | Low: no replaceability intent | Not the main boundary risk |

Choice: Supabase is the #1 leak. It affects the most layers, carries the highest replacement cost, and leaks both persistence shape and auth SDK shape into application boundaries. The biggest DDD smell is not that Supabase exists; it is that product services receive `SupabaseClient<Database>` and reconstruct table rows instead of depending on narrow ports.

## STEP 3 - Diagnosis

### Boundary Leak 1: Framework Locals Expose Supabase User

Current:

```ts
// src/env.d.ts:3
user: import("@supabase/supabase-js").User | null;
```

The request context type now depends on Supabase. Middleware resolves the SDK user directly and stores it unchanged: `src/middleware.ts:12`, `src/middleware.ts:13`. Server-rendered pages consume `Astro.locals.user` for display: `src/pages/dashboard.astro:8`, `src/pages/dashboard.astro:23`, `src/pages/offers/index.astro:7`, `src/pages/offers/index.astro:24`, `src/pages/offers/[id].astro:11`, `src/pages/offers/[id].astro:44`.

Impact: changing auth provider changes global env typing, middleware, and every page that assumes Supabase's user shape.

### Boundary Leak 2: API/Page Layer Creates and Passes Infrastructure Client

Current API/page examples:

```ts
// src/pages/offers/index.astro:8-9
const supabase = createClient(Astro.request.headers, Astro.cookies);
const offerList = supabase ? await listSavedOffers(supabase) : { ok: false };
```

```ts
// src/pages/api/offers/create.ts:40-45
const supabase = createClient(context.request.headers, context.cookies);
...
const createResult = await createSavedOffer(supabase, result.data);
```

```ts
// src/pages/api/offers/[id]/prepare.ts:26-31
const supabase = createClient(context.request.headers, context.cookies);
...
const result = await prepareOfferViewing(supabase, params.data.id, buildPrepareOptions(context));
```

Impact: route handlers and page frontmatter are coupled to Supabase client creation and null-client configuration flow. They should depend on an application service or port, not on a database SDK.

### Boundary Leak 3: Product Services Depend on `SupabaseClient<Database>`

Current:

```ts
// src/lib/services/offers.ts:1-4
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SavedOffer } from "@/types";
type OfferClient = SupabaseClient<Database>;
```

```ts
// src/lib/services/questions.ts:1-4
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BuyerQuestion, Database } from "@/types";
type QuestionClient = SupabaseClient<Database>;
```

```ts
// src/lib/services/offer-preparation.ts:1-9
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ExtractionRequestInput, OfferExtractionResult } from "@/types";
type OfferPreparationClient = SupabaseClient<Database>;
```

Impact: the domain/application service signatures expose a replaceable infrastructure client. Unit tests then fake Supabase instead of fake domain ports: `src/test/fixtures/offer-preparation-client.ts:39`, `src/test/fixtures/offer-preparation-client.ts:72`.

### Boundary Leak 4: Table Rows Are Reconstructed in Several Services

Current duplicated row reconstruction:

```ts
// src/lib/services/offers.ts:6-8
type FlatOfferRow = Pick<
  Database["public"]["Tables"]["flat_offers"]["Row"],
  "id" | "title" | "source_url" | "pasted_content" | "created_at" | "updated_at"
>;
```

```ts
// src/lib/services/questions.ts:6-8
type BuyerQuestionRow = Pick<
  Database["public"]["Tables"]["buyer_questions"]["Row"],
  "id" | "source_template_id" | "question_type" | "text" | "position"
>;
```

```ts
// src/lib/services/offer-extraction-results.ts:7-10
type OfferExtractionResultRow = Pick<
  Database["public"]["Tables"]["offer_extraction_results"]["Row"],
  "id" | "offer_id" | "status" | "result" | "model" | "latency_ms" | "created_at" | "updated_at"
>;
```

Mapping is duplicated per service:

- `src/lib/services/offers.ts:115` maps `FlatOfferRow` to `SavedOffer`.
- `src/lib/services/questions.ts:55` maps `BuyerQuestionRow` to `BuyerQuestion`.
- `src/lib/services/offer-extraction-results.ts:108` maps `OfferExtractionResultRow` to `OfferExtractionResult`.

Impact: database snake_case and table projections are not isolated. A table rename, column rename, or SDK query-builder replacement touches multiple product services.

### Boundary Leak 5: Shared `types.ts` Mixes Domain Types and Database Contract

Current:

- Domain-facing `SavedOffer` is defined at `src/types.ts:11`.
- Domain-facing `BuyerQuestion` is defined at `src/types.ts:3`.
- Database records start in the same file at `src/types.ts:83`.
- `Database` is exported from the same shared module at `src/types.ts:140`.

Impact: a common import from `@/types` can bring domain entities and Supabase database contract into the same ownership area. This makes it too easy for future UI/API code to reach for table rows instead of domain objects.

### Dangerous Leak Check

No browser island currently imports `@supabase/*`; direct browser-side SDK leakage was not found. The dangerous boundary is server-side layering: SSR pages and API handlers construct and pass a concrete Supabase client, while services encode table and RPC details. The global `src/env.d.ts:3` Supabase user type is still dangerous because it turns a provider-specific auth object into an application-wide contract.

## STEP 4 - ACL Design

### Target Ownership

Supabase-specific code should live under one adapter boundary:

```text
src/lib/adapters/supabase/
  server-client.ts
  auth-session.adapter.ts
  buyer-workspace.repository.ts
  mappers.ts
  database.types.ts
  errors.ts
```

Domain/application-facing code should know only ports and domain data:

```text
src/lib/services/
  auth-session.ts
  buyer-workspace.ts
  offer-preparation.ts
  ports.ts

src/lib/domain/
  buyer.ts
  saved-offer.ts
  buyer-question.ts
  offer-extraction-result.ts
```

Keep names flexible during implementation, but keep the ownership rule strict: `@supabase/*`, `SupabaseClient`, `Database["public"]`, table names, column names, RPC names, and Supabase auth methods belong only in `src/lib/adapters/supabase/**`.

### Domain Value Objects and Entities

Core domain shape:

```ts
type Result<T, E = "storage"> = { ok: true; value: T } | { ok: false; reason: E };

class BuyerId {
  private constructor(readonly value: string) {}

  static fromProviderId(value: string): Result<BuyerId, "invalid_buyer_id"> {
    if (!value.trim()) return { ok: false, reason: "invalid_buyer_id" };
    return { ok: true, value: new BuyerId(value) };
  }
}

interface AuthenticatedBuyer {
  id: BuyerId;
  email: string | null;
}

interface SavedOffer {
  id: string;
  title: string;
  sourceUrl: string | null;
  pastedContent: string;
  createdAt: string;
  updatedAt: string;
}

interface BuyerQuestion {
  id: string;
  sourceTemplateId: string | null;
  type: "category" | "open_question";
  text: string;
  position: number;
}

interface OfferExtractionResult {
  id: string;
  offerId: string;
  status: "completed";
  result: ExtractionResult;
  model: string;
  latencyMs: number;
  createdAt: string;
  updatedAt: string;
}
```

ACL-only value objects:

```ts
// src/lib/adapters/supabase/mappers.ts
type SupabaseUser = import("@supabase/supabase-js").User;
type FlatOfferRow = Database["public"]["Tables"]["flat_offers"]["Row"];
type BuyerQuestionRow = Database["public"]["Tables"]["buyer_questions"]["Row"];
type OfferExtractionResultRow = Database["public"]["Tables"]["offer_extraction_results"]["Row"];

const SupabaseBuyer = {
  fromUser(user: SupabaseUser): Result<AuthenticatedBuyer, "invalid_buyer_id"> {
    const id = BuyerId.fromProviderId(user.id);
    if (!id.ok) return id;
    return { ok: true, value: { id: id.value, email: user.email ?? null } };
  },
};

const SupabaseSavedOffer = {
  fromRow(row: FlatOfferRow): SavedOffer {
    return {
      id: row.id,
      title: row.title,
      sourceUrl: row.source_url,
      pastedContent: row.pasted_content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  toInsert(input: CreateOfferInput) {
    return {
      title: input.title,
      source_url: input.sourceUrl,
      pasted_content: input.pastedContent,
    };
  },
};

const SupabaseBuyerQuestion = {
  fromRow(row: BuyerQuestionRow): BuyerQuestion {
    return {
      id: row.id,
      sourceTemplateId: row.source_template_id,
      type: row.question_type,
      text: row.text,
      position: row.position,
    };
  },
};

const SupabaseOfferExtractionResult = {
  fromRow(row: OfferExtractionResultRow): Result<OfferExtractionResult, "invalid_result"> {
    const parsed = completedExtractionResultSchema.safeParse(row.result);
    if (!parsed.success) return { ok: false, reason: "invalid_result" };

    return {
      ok: true,
      value: {
        id: row.id,
        offerId: row.offer_id,
        status: row.status,
        result: parsed.data,
        model: row.model,
        latencyMs: row.latency_ms,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    };
  },

  toInsert(input: CreateOfferExtractionResultInput) {
    return {
      offer_id: input.offerId,
      result: input.result,
      model: input.model,
      latency_ms: input.latencyMs,
    };
  },
};
```

This keeps dependency shape in the ACL value objects. Core domain types do not import Supabase, `Database`, or table row types.

### Narrow Ports

```ts
// src/lib/services/ports.ts
interface AuthSessionPort {
  currentBuyer(): Promise<AuthenticatedBuyer | null>;
  signInWithPassword(input: { email: string; password: string }): Promise<Result<void, "invalid_credentials" | "configuration">>;
  signUpWithPassword(input: { email: string; password: string }): Promise<Result<void, "rejected" | "configuration">>;
  signOut(): Promise<void>;
}

interface BuyerWorkspaceRepository {
  listOffers(): Promise<Result<SavedOffer[]>>;
  createOffer(input: CreateOfferInput): Promise<Result<SavedOffer>>;
  findOffer(offerId: string): Promise<Result<SavedOffer | null>>;
  deleteOffer(offerId: string): Promise<Result<void>>;

  loadQuestionBase(): Promise<Result<BuyerQuestion[]>>;
  resetQuestionBase(): Promise<Result<void>>;

  findExtractionResult(offerId: string): Promise<Result<OfferExtractionResult | null>>;
  createExtractionResult(
    input: CreateOfferExtractionResultInput,
  ): Promise<Result<OfferExtractionResult, "already_exists" | "storage" | "invalid_result">>;
}
```

Adapter:

```ts
// src/lib/adapters/supabase/buyer-workspace.repository.ts
class SupabaseBuyerWorkspaceRepository implements BuyerWorkspaceRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async listOffers() {
    const { data, error } = await this.client
      .from("flat_offers")
      .select("id, title, source_url, pasted_content, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (error) return { ok: false, reason: "storage" };
    return { ok: true, value: data.map(SupabaseSavedOffer.fromRow) };
  }

  async loadQuestionBase() {
    const ensured = await this.client.rpc("ensure_buyer_question_base");
    if (ensured.error) return { ok: false, reason: "storage" };

    const { data, error } = await this.client
      .from("buyer_questions")
      .select("id, source_template_id, question_type, text, position")
      .order("position", { ascending: true });

    if (error) return { ok: false, reason: "storage" };
    return { ok: true, value: data.map(SupabaseBuyerQuestion.fromRow) };
  }
}
```

Adapter factory:

```ts
// src/lib/adapters/supabase/server-client.ts
function createSupabaseRequestScope(requestHeaders: Headers, cookies: AstroCookies): RequestScope | null {
  const client = createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    cookies: { getAll, setAll },
  });

  return {
    auth: new SupabaseAuthSessionAdapter(client),
    workspace: new SupabaseBuyerWorkspaceRepository(client),
  };
}
```

Documentation-driven decision to encode in the ACL: create the SSR client per request and keep cookie read/write handling in `server-client.ts`. The current code already has per-request inputs at `src/lib/supabase.ts:6`, cookie reads at `src/lib/supabase.ts:13`, and cookie writes at `src/lib/supabase.ts:18`; do not move that into API handlers.

## STEP 5 - Proof of Isolation and Before/After

### Swap Proof

After the refactor, replacing Supabase persistence/auth with another provider should touch only:

- `src/lib/adapters/supabase/**` deleted or replaced by a new adapter.
- Package manifest and lockfiles for dependency replacement.
- Adapter-level tests and E2E auth helper if the replacement provider changes test-user provisioning.

It should not touch:

- `src/pages/api/offers/create.ts`.
- `src/pages/api/offers/[id]/delete.ts`.
- `src/pages/api/offers/[id]/prepare.ts`.
- `src/pages/api/questions/reset.ts`.
- `src/pages/offers/index.astro`.
- `src/pages/offers/[id].astro`.
- `src/pages/dashboard.astro`.
- `src/lib/services/offer-preparation.ts`.
- UI components under `src/components/**`.
- Core domain files under `src/lib/domain/**`.

### Before/After: Offer List Page

Before:

```ts
// src/pages/offers/index.astro:8-9
const supabase = createClient(Astro.request.headers, Astro.cookies);
const offerList = supabase ? await listSavedOffers(supabase) : { ok: false };
```

After:

```ts
const scope = createRequestScope(Astro.request.headers, Astro.cookies);
const offerList = scope ? await listSavedOffers(scope.workspace) : { ok: false };
```

`listSavedOffers` accepts `BuyerWorkspaceRepository`, not `SupabaseClient<Database>`.

### Before/After: Create Offer API

Before:

```ts
// src/pages/api/offers/create.ts:40-45
const supabase = createClient(context.request.headers, context.cookies);
...
const createResult = await createSavedOffer(supabase, result.data);
```

After:

```ts
const scope = createRequestScope(context.request.headers, context.cookies);
if (!scope) return redirectToCreate(context);

const createResult = await createSavedOffer(scope.workspace, result.data);
```

The API handler owns HTTP parsing and redirects. The adapter owns persistence.

### Before/After: Offer Preparation Orchestration

Before:

```ts
// src/lib/services/offer-preparation.ts:29-35
export async function prepareOfferViewing(
  client: OfferPreparationClient,
  offerId: string,
  options: PrepareOfferViewingOptions = {},
): Promise<PrepareOfferViewingResult> {
  const extractor = options.extractOfferPreparation ?? extractOfferPreparation;
  const offerResult = await loadSavedOffer(client, offerId);
```

After:

```ts
export async function prepareOfferViewing(
  workspace: BuyerWorkspaceRepository,
  offerId: string,
  options: PrepareOfferViewingOptions = {},
): Promise<PrepareOfferViewingResult> {
  const extractor = options.extractOfferPreparation ?? extractOfferPreparation;
  const offerResult = await workspace.findOffer(offerId);
```

The orchestration no longer passes a concrete infrastructure client through several operations.

### Before/After: UI Receives Domain Data

Before:

```ts
// src/pages/offers/[id].astro:20-22
if (supabase && offer) {
  preparationResult = await loadOfferExtractionResult(supabase, offer.id);
  questionBase = await loadBuyerQuestionBase(supabase);
}
```

The UI page frontmatter decides when to call three persistence services with the same concrete client.

After:

```ts
const pageData = scope
  ? await loadOfferDetailPage(scope.workspace, offerId)
  : { ok: false };
```

The page receives `offer`, `preparation`, and `questions` as ready domain data. The component remains unchanged because it already receives `OfferExtractionResult` and `BuyerQuestion` props at `src/components/offers/OfferPreparationResult.astro:9`, `src/components/offers/OfferPreparationResult.astro:10`, `src/components/offers/OfferPreparationResult.astro:11`.

### Open Questions Resolved for the ACL

- SSR client lifetime: keep per-request creation in the adapter factory. Current code already requires headers/cookies per request at `src/lib/supabase.ts:6`.
- Cookie persistence: keep cookie parsing and setting in the adapter factory. Current implementation reads cookies at `src/lib/supabase.ts:13` and writes at `src/lib/supabase.ts:18`.
- Auth identity: convert Supabase `User` to `AuthenticatedBuyer` in `SupabaseBuyer.fromUser`, then store only `AuthenticatedBuyer | null` in locals. Do not expose `@supabase/supabase-js.User` from `src/env.d.ts:3`.
- Service-role E2E setup: keep admin user provisioning outside product services. Current helper uses service-role construction at `tests/e2e/support/auth.ts:78`; move that to adapter test support or keep it as E2E infrastructure, never as application API.
- Database conflict codes: encode Supabase code `23505` only in the repository adapter. Current service maps it at `src/lib/services/offer-extraction-results.ts:85`.

## STEP 6 - Verification and Phase Plan

### Current Files That Know Supabase

Source and test files:

- `src/env.d.ts:3`
- `src/lib/supabase.ts:1`
- `src/lib/supabase.ts:6`
- `src/middleware.ts:7`
- `src/middleware.ts:12`
- `src/pages/dashboard.astro:9`
- `src/pages/dashboard.astro:10`
- `src/pages/offers/index.astro:8`
- `src/pages/offers/index.astro:9`
- `src/pages/offers/[id].astro:13`
- `src/pages/offers/[id].astro:14`
- `src/pages/offers/[id].astro:20`
- `src/pages/offers/[id].astro:21`
- `src/pages/offers/[id].astro:22`
- `src/pages/api/auth/signin.ts:9`
- `src/pages/api/auth/signin.ts:13`
- `src/pages/api/auth/signup.ts:9`
- `src/pages/api/auth/signup.ts:13`
- `src/pages/api/auth/signout.ts:5`
- `src/pages/api/auth/signout.ts:7`
- `src/pages/api/questions/reset.ts:32`
- `src/pages/api/questions/reset.ts:37`
- `src/pages/api/offers/create.ts:40`
- `src/pages/api/offers/create.ts:45`
- `src/pages/api/offers/[id]/prepare.ts:26`
- `src/pages/api/offers/[id]/prepare.ts:31`
- `src/pages/api/offers/[id]/delete.ts:34`
- `src/pages/api/offers/[id]/delete.ts:39`
- `src/lib/services/offers.ts:1`
- `src/lib/services/offers.ts:4`
- `src/lib/services/offers.ts:6`
- `src/lib/services/offers.ts:48`
- `src/lib/services/offers.ts:67`
- `src/lib/services/offers.ts:89`
- `src/lib/services/offers.ts:106`
- `src/lib/services/questions.ts:1`
- `src/lib/services/questions.ts:4`
- `src/lib/services/questions.ts:6`
- `src/lib/services/questions.ts:23`
- `src/lib/services/questions.ts:30`
- `src/lib/services/questions.ts:46`
- `src/lib/services/offer-extraction-results.ts:1`
- `src/lib/services/offer-extraction-results.ts:5`
- `src/lib/services/offer-extraction-results.ts:7`
- `src/lib/services/offer-extraction-results.ts:42`
- `src/lib/services/offer-extraction-results.ts:73`
- `src/lib/services/offer-extraction-results.ts:85`
- `src/lib/services/offer-preparation.ts:1`
- `src/lib/services/offer-preparation.ts:9`
- `src/lib/services/offer-preparation.ts:29`
- `src/test/fixtures/offer-preparation-client.ts:1`
- `src/test/fixtures/offer-preparation-client.ts:39`
- `src/test/fixtures/offer-preparation-client.ts:72`
- `tests/e2e/support/auth.ts:3`
- `tests/e2e/support/auth.ts:38`
- `tests/e2e/support/auth.ts:39`
- `tests/e2e/support/auth.ts:64`
- `tests/e2e/support/auth.ts:78`

Manifest/docs that know Supabase:

- `package.json:26`
- `package.json:27`
- `package.json:54`
- `README.md:13`
- `README.md:76`
- `context/foundation/infrastructure.md:61`
- `context/foundation/infrastructure.md:62`

### Files That Should Know Supabase After Refactor

Source/test files:

- `src/lib/adapters/supabase/server-client.ts`
- `src/lib/adapters/supabase/auth-session.adapter.ts`
- `src/lib/adapters/supabase/buyer-workspace.repository.ts`
- `src/lib/adapters/supabase/mappers.ts`
- `src/lib/adapters/supabase/database.types.ts`
- `src/lib/adapters/supabase/errors.ts`
- `src/lib/adapters/supabase/*.test.ts`
- `tests/e2e/support/auth.ts`, only if E2E continues to provision Supabase users directly.

No product service, API route, SSR page, UI component, or `src/env.d.ts` should import `@supabase/*`, mention `SupabaseClient`, mention `Database["public"]`, or call `.from()`, `.rpc()`, or `.auth.*`.

Success criterion:

```powershell
rg -n "@supabase|SupabaseClient|createServerClient|Database\\[\\\"public\\\"\\]|\\.from\\(|\\.rpc\\(|auth\\." src tests
```

Expected result after refactor: matches only under `src/lib/adapters/supabase/**` plus the approved E2E infrastructure exception if retained. For a strict source-only check, move E2E user provisioning behind an adapter test helper too.

### Phase Plan

1. Create domain/auth and repository ports.
   - Add `AuthenticatedBuyer`, `BuyerId`, and `BuyerWorkspaceRepository`.
   - Change `src/env.d.ts` to expose `AuthenticatedBuyer | null`, not Supabase `User`.

2. Create the Supabase ACL adapter.
   - Move `createServerClient` and cookie handling from `src/lib/supabase.ts` into `src/lib/adapters/supabase/server-client.ts`.
   - Move `Database` and table record types out of shared `src/types.ts` into `src/lib/adapters/supabase/database.types.ts`.
   - Move row mapping from `src/lib/services/offers.ts`, `src/lib/services/questions.ts`, and `src/lib/services/offer-extraction-results.ts` into `mappers.ts`.

3. Convert product services to ports.
   - Change `offers.ts`, `questions.ts`, and `offer-extraction-results.ts` signatures from `SupabaseClient<Database>` to `BuyerWorkspaceRepository` or split smaller ports if implementation pressure shows the combined port is too wide.
   - Change `offer-preparation.ts` to orchestrate through the port.

4. Convert API routes and SSR pages.
   - Replace direct `createClient(...)` with `createRequestScope(...)`.
   - Keep zod schemas in API routes for HTTP input validation.
   - Keep redirects/status-code mapping in API routes.

5. Convert tests.
   - Replace `createFakeSupabaseClient` with a fake `BuyerWorkspaceRepository`.
   - Keep E2E Supabase admin setup isolated under E2E support or adapter test support.

6. Verify.
   - Run `pnpm.cmd run lint`.
   - Run `pnpm.cmd run build`.
   - Run `pnpm.cmd run test:app` because the repo now has Vitest and service tests.
   - Run the grep success criterion above.
   - For auth/UI flow changes, run `pnpm.cmd run dev` and manually verify `/dashboard`, `/offers`, offer creation, offer detail, reset, delete, sign-in, sign-up, and sign-out, matching the manual verification guidance at `README.md:115` and `README.md:123`.
