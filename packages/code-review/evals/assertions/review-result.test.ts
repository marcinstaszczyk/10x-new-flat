import { describe, expect, it } from "vitest";
import { criticalTransferFixture } from "../fixtures/critical-transfer.ts";
import { offerEditRegenerationFixture } from "../fixtures/offer-edit-regeneration.ts";
import { createFailingReviewAssertion } from "./review-result.ts";

const criteria = {
  implementationCorrectness: { score: 4, rationale: "The transfer handler has an authorization flaw." },
  idiomaticity: { score: 5, rationale: "The endpoint structure is understandable." },
  complexity: { score: 5, rationale: "The implementation is direct." },
  testRiskCoverage: { score: 4, rationale: "Risky transfer cases are not tested." },
  documentation: { score: 5, rationale: "The behavior is documented sufficiently." },
  securitySafety: { score: 4, rationale: "The transfer can be abused by another account owner." },
};

function reviewResult(overrides = {}) {
  return JSON.stringify({
    criteria,
    verdict: "fail",
    summary: "## Fail\n\nCritical transfer flaws found.",
    ...overrides,
  });
}

describe("failing review assertion", () => {
  it("accepts canonical failing reviews for both fixture contracts", () => {
    expect(createFailingReviewAssertion(criticalTransferFixture.expected)(reviewResult())).toMatchObject({
      pass: true,
      score: 1,
    });
    expect(createFailingReviewAssertion(offerEditRegenerationFixture.expected)(reviewResult())).toMatchObject({
      pass: true,
      score: 1,
    });
  });

  it("rejects a legacy flat review", () => {
    expect(
      createFailingReviewAssertion(criticalTransferFixture.expected)(
        JSON.stringify({ ...criteria, verdict: "fail", summary: "## Fail" }),
      ),
    ).toMatchObject({
      pass: false,
      score: 0,
    });
  });

  it("rejects malformed JSON, a passing verdict, and scores above a ceiling", () => {
    const assert = createFailingReviewAssertion(offerEditRegenerationFixture.expected);

    expect(assert("not json")).toMatchObject({ pass: false, score: 0 });
    expect(assert(reviewResult({ verdict: "pass" }))).toMatchObject({ pass: false, score: 0 });
    expect(
      assert(
        reviewResult({
          criteria: { ...criteria, securitySafety: { score: 5, rationale: "Unsafe transfer behavior." } },
        }),
      ),
    ).toMatchObject({ pass: false, score: 0 });
  });
});
