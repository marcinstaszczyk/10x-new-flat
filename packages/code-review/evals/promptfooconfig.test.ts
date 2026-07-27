import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REVIEW_JSON_SCHEMA } from "../common/review-schema.ts";
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

  it("requires strict schema output with enough completion budget", () => {
    for (const provider of config.providers.slice(0, 2)) {
      expect(provider.config).toMatchObject({
        max_tokens: 4096,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "code_review",
            strict: true,
            schema: REVIEW_JSON_SCHEMA,
          },
        },
      });
    }
  });

  it("pairs every fixture with its own structural assertion and rubric", () => {
    for (const fixture of reviewFixtures) {
      const test = config.tests.find((candidate) => candidate.description === fixture.id);
      const assertion = test?.assert[0];
      const rubric = test?.assert[1];
      const assertionValue = assertion?.value;

      expect(assertion?.type).toBe("javascript");
      expect(typeof assertionValue).toBe("function");
      if (typeof assertionValue !== "function") throw new Error("Missing JavaScript assertion.");
      expect(assertionValue.expected).toBe(fixture.expected);
      expect(rubric?.type).toBe("llm-rubric");
      expect(rubric?.value).toBe(readFileSync(new URL(`./${fixture.rubricPath}`, import.meta.url), "utf8"));
    }
  });
});
