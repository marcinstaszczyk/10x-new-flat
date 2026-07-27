import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { reviewFixtures } from "./fixtures/index.ts";
import config from "./promptfooconfig.ts";

describe("Promptfoo configuration", () => {
  it("uses one variableized prompt and one fixture-labelled test per fixture", () => {
    expect(config.prompts).toHaveLength(1);
    expect(config.prompts[0]).toContain("{{title}}");
    expect(config.prompts[0]).toContain("{{description}}");
    expect(config.prompts[0]).toContain("{{diff}}");
    expect(config.tests).toHaveLength(reviewFixtures.length);

    for (const fixture of reviewFixtures) {
      const test = config.tests.find((candidate) => candidate.description === fixture.id);
      expect(test?.vars).toMatchObject({
        fixtureId: fixture.id,
        title: fixture.title,
        diff: fixture.diff,
      });
    }
  });

  it("pairs every fixture with its own structural assertion and rubric", () => {
    for (const fixture of reviewFixtures) {
      const test = config.tests.find((candidate) => candidate.description === fixture.id);
      const assertion = test?.assert[0];
      const rubric = test?.assert[1];

      expect(assertion?.type).toBe("javascript");
      expect(typeof assertion?.value).toBe("function");
      expect(rubric?.type).toBe("llm-rubric");
      expect(rubric?.value).toBe(readFileSync(new URL(`./${fixture.rubricPath}`, import.meta.url), "utf8"));
    }
  });
});
