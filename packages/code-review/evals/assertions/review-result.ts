import { parseReview } from "../../review-contract.ts";
import { ReviewResult } from "../../common/review-schema.ts";
import type { ReviewFixture } from "../fixtures/types.ts";

export function createFailingReviewAssertion(expected: ReviewFixture["expected"]) {
  return (output: string) => {
    try {
      ReviewResult.parse(JSON.parse(output));
      const review = parseReview(output);
      const ceilings = expected.scoreCeilings;
      const meetsCeilings =
        review.criteria.implementationCorrectness.score <= ceilings.implementationCorrectness &&
        review.criteria.testRiskCoverage.score <= ceilings.testRiskCoverage &&
        review.criteria.securitySafety.score <= ceilings.securitySafety;

      return {
        pass: review.verdict === "fail" && meetsCeilings,
        score: review.verdict === "fail" && meetsCeilings ? 1 : 0,
        reason:
          "Response must be canonical nested review JSON with a fail verdict and fixture-specific score ceilings.",
      };
    } catch (error) {
      return { pass: false, score: 0, reason: error instanceof Error ? error.message : "Invalid review JSON." };
    }
  };
}
