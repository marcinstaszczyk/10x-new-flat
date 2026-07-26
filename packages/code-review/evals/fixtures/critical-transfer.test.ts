import { describe, expect, it } from "vitest";
import { criticalTransferFixture, REQUIRED_FINDING_IDS } from "./critical-transfer.ts";

describe("critical transfer fixture", () => {
  it("defines exactly three distinct required findings", () => {
    const findingIds = criticalTransferFixture.expected.findings.map((finding) => finding.id);

    expect(findingIds).toEqual(REQUIRED_FINDING_IDS);
    expect(new Set(findingIds)).toHaveLength(3);
  });

  it("requires a failed review with low scores for material risk areas", () => {
    expect(criticalTransferFixture.expected.verdict).toBe("fail");
    expect(criticalTransferFixture.expected.scoreCeilings).toEqual({
      implementationCorrectness: 4,
      testRiskCoverage: 4,
      securitySafety: 4,
    });
  });

  it("contains independently actionable flaws and a narrow happy-path test", () => {
    expect(criticalTransferFixture.diff).toContain("where: { id: fromAccountId }");
    expect(criticalTransferFixture.diff).toContain("source.balance < amount");
    expect(criticalTransferFixture.diff).toContain("await db.account.update");
    expect(criticalTransferFixture.diff).toContain('it("moves money between two accounts"');
  });
});
