import { parseReview } from "../../review-contract.ts";
import { criticalTransferFixture } from "../fixtures/critical-transfer.ts";

export function hasFailingCriticalReview(output: string) {
  try {
    const review = parseReview(output);
    const ceilings = criticalTransferFixture.expected.scoreCeilings;
    const meetsCeilings =
      review.criteria.implementationCorrectness.score <= ceilings.implementationCorrectness &&
      review.criteria.testRiskCoverage.score <= ceilings.testRiskCoverage &&
      review.criteria.securitySafety.score <= ceilings.securitySafety;

    return {
      pass: review.verdict === "fail" && meetsCeilings,
      score: review.verdict === "fail" && meetsCeilings ? 1 : 0,
      reason: "Response must be canonical nested review JSON with a fail verdict and low critical-risk scores.",
    };
  } catch (error) {
    return { pass: false, score: 0, reason: error instanceof Error ? error.message : "Invalid review JSON." };
  }
}
