import { describe, expect, it } from "vitest";

import { extractOfferPreparation } from "./extraction";
import { extractionQuestions, tooLargePastedContent } from "@/test/fixtures/extraction";

describe("extractOfferPreparation", () => {
  it("rejects too-large pasted content before calling the provider", async () => {
    let providerWasCalled = false;
    const fetcher: typeof fetch = () => {
      providerWasCalled = true;
      return Promise.reject(new Error("Provider should not be called for too-large input."));
    };

    const result = await extractOfferPreparation(
      {
        offer: {
          id: "offer-too-large",
          title: "Too large offer",
          pastedContent: tooLargePastedContent,
        },
        questions: extractionQuestions,
      },
      { fetcher },
    );

    expect(providerWasCalled).toBe(false);
    expect(result).toMatchObject({ ok: false, reason: "input_too_large" });
  });
});
