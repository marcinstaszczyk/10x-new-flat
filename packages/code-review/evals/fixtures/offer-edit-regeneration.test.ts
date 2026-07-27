import { describe, expect, it } from "vitest";
import { offerEditRegenerationFixture, REQUIRED_FINDING_IDS } from "./offer-edit-regeneration.ts";

describe("offer edit and regeneration fixture", () => {
  it("defines exactly three distinct required findings", () => {
    const findingIds = offerEditRegenerationFixture.expected.findings.map((finding) => finding.id);

    expect(findingIds).toEqual(REQUIRED_FINDING_IDS);
    expect(new Set(findingIds)).toHaveLength(3);
  });

  it("requires a failed review with low scores for material risk areas", () => {
    expect(offerEditRegenerationFixture.expected.verdict).toBe("fail");
    expect(offerEditRegenerationFixture.expected.scoreCeilings).toEqual({
      implementationCorrectness: 4,
      testRiskCoverage: 4,
      securitySafety: 4,
    });
  });

  it("contains the three intentional flaws without application test changes", () => {
    expect(offerEditRegenerationFixture.diff).toContain('create policy "Authenticated buyers can read any flat offer"');
    expect(offerEditRegenerationFixture.diff).toContain("with check (true)");
    expect(offerEditRegenerationFixture.diff).toContain("deleteOfferExtractionResult(client, offerId)");
    expect(offerEditRegenerationFixture.diff).toContain("set:html={item.evidenceText}");
    expect(offerEditRegenerationFixture.diff).not.toMatch(/^diff --git a\/.*\.test\.(?:ts|tsx|astro)/m);
  });
});
