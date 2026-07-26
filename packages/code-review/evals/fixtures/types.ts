import type { ReviewInput } from "../../review-contract.ts";

export interface ExpectedFinding {
  id: string;
  description: string;
}

export interface ReviewFixture extends ReviewInput {
  id: string;
  rubricPath: string;
  expected: {
    verdict: "fail";
    scoreCeilings: {
      implementationCorrectness: number;
      testRiskCoverage: number;
      securitySafety: number;
    };
    findings: readonly ExpectedFinding[];
  };
}
