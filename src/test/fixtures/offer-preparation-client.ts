import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, ExtractionResult } from "@/types";
import { belowLimitPastedContent, expectedCompletedExtraction } from "./extraction";

export const offerId = "offer-long-1";
export const model = "test-model";
export const latencyMs = 123;

const createdAt = "2026-06-10T10:00:00.000Z";
const updatedAt = "2026-06-10T10:00:00.000Z";

interface FakeSupabaseOptions {
  existingResult?: OfferExtractionResultRow | null;
  insertError?: { code?: string };
}

interface OfferExtractionResultRow {
  id: string;
  offer_id: string;
  status: "completed";
  result: ExtractionResult;
  model: string;
  latency_ms: number;
  created_at: string;
  updated_at: string;
}

type InsertedExtractionResult = Pick<OfferExtractionResultRow, "offer_id" | "result" | "model" | "latency_ms">;

interface FakeSupabaseClient {
  insertedExtractionResults: InsertedExtractionResult[];
  from(table: string): unknown;
  rpc(name: string): Promise<{ error: null }>;
}

export function createFakeSupabaseClient(
  options: FakeSupabaseOptions = {},
): SupabaseClient<Database> & FakeSupabaseClient {
  const client: FakeSupabaseClient = {
    insertedExtractionResults: [],
    from: (table) => createTableQuery(table, client, options),
    rpc: (name) => {
      if (name !== "ensure_buyer_question_base") {
        throw new Error(`Unexpected RPC: ${name}`);
      }

      return Promise.resolve({ error: null });
    },
  };

  return client as SupabaseClient<Database> & FakeSupabaseClient;
}

export function insertPayload(): InsertedExtractionResult {
  return { offer_id: offerId, result: expectedCompletedExtraction, model, latency_ms: latencyMs };
}

export function offerExtractionResultRow(overrides: Partial<OfferExtractionResultRow> = {}): OfferExtractionResultRow {
  return {
    id: overrides.id ?? "result-1",
    offer_id: overrides.offer_id ?? offerId,
    status: overrides.status ?? "completed",
    result: overrides.result ?? expectedCompletedExtraction,
    model: overrides.model ?? model,
    latency_ms: overrides.latency_ms ?? latencyMs,
    created_at: overrides.created_at ?? createdAt,
    updated_at: overrides.updated_at ?? updatedAt,
  };
}

function createTableQuery(table: string, client: FakeSupabaseClient, options: FakeSupabaseOptions): unknown {
  if (table === "flat_offers") {
    return new SelectQuery(flatOfferRow());
  }

  if (table === "buyer_questions") {
    return new SelectQuery(buyerQuestionRows());
  }

  if (table === "offer_extraction_results") {
    return new OfferExtractionResultsQuery(client, options);
  }

  throw new Error(`Unexpected table: ${table}`);
}

class SelectQuery<Data> {
  constructor(private readonly data: Data) {}

  select(): this {
    return this;
  }

  eq(): this {
    return this;
  }

  order(): this {
    return this;
  }

  maybeSingle(): this {
    return this;
  }

  overrideTypes(): Promise<{ data: Data; error: null }> {
    return Promise.resolve({ data: this.data, error: null });
  }
}

class OfferExtractionResultsQuery {
  private insertPayload: InsertedExtractionResult | null = null;

  constructor(
    private readonly client: FakeSupabaseClient,
    private readonly options: FakeSupabaseOptions,
  ) {}

  select(): this {
    return this;
  }

  eq(): this {
    return this;
  }

  maybeSingle(): this {
    return this;
  }

  single(): this {
    return this;
  }

  insert(payload: InsertedExtractionResult): this {
    this.insertPayload = payload;
    this.client.insertedExtractionResults.push(payload);
    return this;
  }

  overrideTypes(): Promise<{ data: OfferExtractionResultRow | null; error: null | { code?: string } }> {
    if (!this.insertPayload) {
      return Promise.resolve({ data: this.options.existingResult ?? null, error: null });
    }

    if (this.options.insertError) {
      return Promise.resolve({ data: null, error: this.options.insertError });
    }

    return Promise.resolve({
      data: offerExtractionResultRow({
        result: this.insertPayload.result,
        model: this.insertPayload.model,
        latency_ms: this.insertPayload.latency_ms,
      }),
      error: null,
    });
  }
}

function flatOfferRow() {
  return {
    id: offerId,
    title: "Long saved offer",
    source_url: "https://example.test/offer",
    pasted_content: belowLimitPastedContent,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function buyerQuestionRows(): unknown[] {
  return [
    buyerQuestionRow("category-location", "category", "Location", 1),
    buyerQuestionRow("question-parking", "open_question", "Is parking included?", 2),
    buyerQuestionRow("question-neighborhood", "open_question", "How loud is the neighborhood?", 3),
  ];
}

function buyerQuestionRow(id: string, questionType: "category" | "open_question", text: string, position: number) {
  return { id, source_template_id: null, question_type: questionType, text, position };
}
