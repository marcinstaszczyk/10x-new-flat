import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ExtractionRequestInput, OfferExtractionResult } from "@/types";
import { extractOfferPreparation } from "./extraction";
import type { ExtractionFailureReason, ExtractionMetadata, ExtractionServiceResult } from "./extraction-provider";
import { createOfferExtractionResult, loadOfferExtractionResult } from "./offer-extraction-results";
import { loadSavedOffer } from "./offers";
import { loadBuyerQuestionBase } from "./questions";

type OfferPreparationClient = SupabaseClient<Database>;
export type ExtractOfferPreparation = (input: ExtractionRequestInput) => Promise<ExtractionServiceResult>;

interface PrepareOfferViewingOptions {
  extractOfferPreparation?: ExtractOfferPreparation;
}

export type PrepareOfferViewingResult =
  | {
      ok: true;
      result: OfferExtractionResult;
    }
  | {
      ok: false;
      reason: "not_found" | "already_exists" | "question_base" | "storage" | ExtractionFailureReason;
      metadata?: ExtractionMetadata;
    };

type PrepareOfferViewingFailureReason = Extract<PrepareOfferViewingResult, { ok: false }>["reason"];

export async function prepareOfferViewing(
  client: OfferPreparationClient,
  offerId: string,
  options: PrepareOfferViewingOptions = {},
): Promise<PrepareOfferViewingResult> {
  const extractor = options.extractOfferPreparation ?? extractOfferPreparation;
  const offerResult = await loadSavedOffer(client, offerId);
  if (!offerResult.ok) {
    return { ok: false, reason: "storage" };
  }

  if (!offerResult.offer) {
    return { ok: false, reason: "not_found" };
  }

  const existingResult = await loadOfferExtractionResult(client, offerId);
  if (!existingResult.ok) {
    return { ok: false, reason: "storage" };
  }

  if (existingResult.result) {
    logPrepareBlocked(offerId, existingResult.result.model, existingResult.result.latencyMs);
    return {
      ok: false,
      reason: "already_exists",
      metadata: {
        model: existingResult.result.model,
        latencyMs: existingResult.result.latencyMs,
      },
    };
  }

  const questionResult = await loadBuyerQuestionBase(client);
  if (!questionResult.ok) {
    return { ok: false, reason: "question_base" };
  }

  const extractionResult = await extractor({
    offer: {
      id: offerResult.offer.id,
      title: offerResult.offer.title,
      pastedContent: offerResult.offer.pastedContent,
    },
    questions: questionResult.questions
      .filter((question) => question.type === "open_question")
      .map((question) => ({ id: question.id, text: question.text })),
  });

  if (!extractionResult.ok) {
    logPrepareFailure(offerId, extractionResult.reason, extractionResult.metadata, extractionResult.diagnostic);
    return { ok: false, reason: extractionResult.reason, metadata: extractionResult.metadata };
  }

  const createResult = await createOfferExtractionResult(client, {
    offerId,
    result: extractionResult.result,
    model: extractionResult.metadata.model,
    latencyMs: extractionResult.metadata.latencyMs,
  });

  if (!createResult.ok) {
    const reason = createResult.reason === "already_exists" ? "already_exists" : "storage";
    logPrepareFailure(offerId, reason, extractionResult.metadata);
    return { ok: false, reason, metadata: extractionResult.metadata };
  }

  return { ok: true, result: createResult.result };
}

function logPrepareFailure(
  offerId: string,
  reason: PrepareOfferViewingFailureReason,
  metadata?: ExtractionMetadata,
  diagnostic?: string,
) {
  console.warn("offer_preparation_failed", {
    offerId,
    reason,
    model: metadata?.model,
    latencyMs: metadata?.latencyMs,
    diagnostic,
  });
}

function logPrepareBlocked(offerId: string, model: string, latencyMs: number) {
  console.warn("offer_preparation_blocked", {
    offerId,
    reason: "already_exists",
    model,
    latencyMs,
  });
}
