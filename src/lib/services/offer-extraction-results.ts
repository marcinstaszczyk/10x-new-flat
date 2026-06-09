import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ExtractionResult, OfferExtractionResult } from "@/types";

type OfferExtractionResultClient = SupabaseClient<Database>;

type OfferExtractionResultRow = Pick<
  Database["public"]["Tables"]["offer_extraction_results"]["Row"],
  "id" | "offer_id" | "status" | "result" | "model" | "latency_ms" | "created_at" | "updated_at"
>;

export interface CreateOfferExtractionResultInput {
  offerId: string;
  result: ExtractionResult;
  model: string;
  latencyMs: number;
}

export type LoadOfferExtractionResultResult =
  | {
      ok: true;
      result: OfferExtractionResult | null;
    }
  | {
      ok: false;
    };

export type CreateOfferExtractionResultResult =
  | {
      ok: true;
      result: OfferExtractionResult;
    }
  | {
      ok: false;
      reason: "already_exists" | "storage";
    };

export async function loadOfferExtractionResult(
  client: OfferExtractionResultClient,
  offerId: string,
): Promise<LoadOfferExtractionResultResult> {
  const { data, error } = await client
    .from("offer_extraction_results")
    .select("id, offer_id, status, result, model, latency_ms, created_at, updated_at")
    .eq("offer_id", offerId)
    .maybeSingle()
    .overrideTypes<OfferExtractionResultRow | null, { merge: false }>();

  if (error) {
    return { ok: false };
  }

  return {
    ok: true,
    result: data ? mapOfferExtractionResult(data) : null,
  };
}

export async function createOfferExtractionResult(
  client: OfferExtractionResultClient,
  input: CreateOfferExtractionResultInput,
): Promise<CreateOfferExtractionResultResult> {
  const { data, error } = await client
    .from("offer_extraction_results")
    .insert({
      offer_id: input.offerId,
      result: input.result,
      model: input.model,
      latency_ms: input.latencyMs,
    })
    .select("id, offer_id, status, result, model, latency_ms, created_at, updated_at")
    .single()
    .overrideTypes<OfferExtractionResultRow, { merge: false }>();

  if (error) {
    return { ok: false, reason: error.code === "23505" ? "already_exists" : "storage" };
  }

  return {
    ok: true,
    result: mapOfferExtractionResult(data),
  };
}

export function mapOfferExtractionResult(row: OfferExtractionResultRow): OfferExtractionResult {
  return {
    id: row.id,
    offerId: row.offer_id,
    status: row.status,
    result: row.result,
    model: row.model,
    latencyMs: row.latency_ms,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
