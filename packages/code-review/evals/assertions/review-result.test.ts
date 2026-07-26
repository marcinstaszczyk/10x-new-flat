import { describe, expect, it } from "vitest";
import { hasFailingCriticalReview } from "./review-result.ts";

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

describe("critical review assertion", () => {
  it("accepts a canonical failing review within the required score ceilings", () => {
    expect(hasFailingCriticalReview(reviewResult())).toMatchObject({ pass: true, score: 1 });
  });

  it("rejects a legacy flat review", () => {
    expect(
      hasFailingCriticalReview(JSON.stringify({ ...criteria, verdict: "fail", summary: "## Fail" })),
    ).toMatchObject({
      pass: false,
      score: 0,
    });
  });

  it("rejects malformed JSON, a passing verdict, and scores above a ceiling", () => {
    expect(hasFailingCriticalReview("not json")).toMatchObject({ pass: false, score: 0 });
    expect(hasFailingCriticalReview(reviewResult({ verdict: "pass" }))).toMatchObject({ pass: false, score: 0 });
    expect(
      hasFailingCriticalReview(
        reviewResult({
          criteria: { ...criteria, securitySafety: { score: 5, rationale: "Unsafe transfer behavior." } },
        }),
      ),
    ).toMatchObject({ pass: false, score: 0 });
  });
});
