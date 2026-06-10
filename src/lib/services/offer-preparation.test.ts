import { describe, expect, it } from "vitest";

import type { ExtractionRequestInput } from "@/types";
import { belowLimitPastedContent, checksum, expectedCompletedExtraction } from "@/test/fixtures/extraction";
import {
  createFakeSupabaseClient,
  insertPayload,
  latencyMs,
  model,
  offerExtractionResultRow,
  offerId,
} from "@/test/fixtures/offer-preparation-client";
import type { ExtractionServiceResult } from "./extraction-provider";
import { prepareOfferViewing } from "./offer-preparation";

describe("prepareOfferViewing", () => {
  it("extracts the full saved offer with open questions and persists completed results", testSuccessfulPreparation);
  it("blocks reruns when a completed result already exists", testRerunBlocking);
  it("does not persist when extraction fails", testExtractorFailure);
  it("returns storage failure when persisting a successful extraction fails", testStorageFailure);
});

async function testSuccessfulPreparation() {
  const client = createFakeSupabaseClient();
  const extractionInputs: ExtractionRequestInput[] = [];

  const result = await prepareOfferViewing(client, offerId, {
    extractOfferPreparation: (input) => {
      extractionInputs.push(input);
      return Promise.resolve(extractionSuccess());
    },
  });

  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }

  const extractionInput = extractionInputs[0];
  expect(extractionInput.offer).toMatchObject({ id: offerId, title: "Long saved offer" });
  expect(extractionInput.offer.pastedContent.length).toBe(belowLimitPastedContent.length);
  expect(checksum(extractionInput.offer.pastedContent)).toBe(checksum(belowLimitPastedContent));
  expect(extractionInput.questions).toEqual([
    { id: "question-parking", text: "Is parking included?" },
    { id: "question-neighborhood", text: "How loud is the neighborhood?" },
  ]);
  expect(client.insertedExtractionResults).toEqual([insertPayload()]);
  expect(result.result).toMatchObject({ offerId, result: expectedCompletedExtraction, model, latencyMs });
}

async function testRerunBlocking() {
  const existingResult = offerExtractionResultRow();
  const client = createFakeSupabaseClient({ existingResult });
  let extractorWasCalled = false;

  const result = await prepareOfferViewing(client, offerId, {
    extractOfferPreparation: () => {
      extractorWasCalled = true;
      return Promise.resolve(extractionSuccess());
    },
  });

  expect(extractorWasCalled).toBe(false);
  expect(client.insertedExtractionResults).toEqual([]);
  expect(result).toEqual({
    ok: false,
    reason: "already_exists",
    metadata: { model: existingResult.model, latencyMs: existingResult.latency_ms },
  });
}

async function testExtractorFailure() {
  const client = createFakeSupabaseClient();

  const result = await prepareOfferViewing(client, offerId, {
    extractOfferPreparation: () =>
      Promise.resolve({
        ok: false,
        reason: "provider",
        diagnostic: "Provider failed.",
        metadata: { model, latencyMs },
      }),
  });

  expect(client.insertedExtractionResults).toEqual([]);
  expect(result).toEqual({ ok: false, reason: "provider", metadata: { model, latencyMs } });
}

async function testStorageFailure() {
  const client = createFakeSupabaseClient({ insertError: { code: "unexpected" } });

  const result = await prepareOfferViewing(client, offerId, {
    extractOfferPreparation: () => Promise.resolve(extractionSuccess()),
  });

  expect(client.insertedExtractionResults).toEqual([insertPayload()]);
  expect(result).toEqual({ ok: false, reason: "storage", metadata: { model, latencyMs } });
}

function extractionSuccess(): ExtractionServiceResult {
  return { ok: true, result: expectedCompletedExtraction, metadata: { model, latencyMs } };
}
