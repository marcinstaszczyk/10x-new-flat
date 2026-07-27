import { readFileSync } from "node:fs";
import { createFailingReviewAssertion } from "./assertions/review-result.ts";
import { reviewFixtures } from "./fixtures/index.ts";
import { renderReviewPrompt } from "../review-contract.ts";

const judgeProvider = {
  id: "openrouter:openai/gpt-5.6-luna",
  config: { temperature: 0 },
};

const jsonReviewProviderConfig = {
  response_format: { type: "json_object" },
  temperature: 0,
};

export default {
  description: "Code-review regression evaluation fixtures",
  prompts: [
    renderReviewPrompt({
      title: "{{title}}",
      description: "{{description}}",
      diff: "{{diff}}",
    }),
  ],
  providers: [
    { id: "openrouter:z-ai/glm-5.1", config: jsonReviewProviderConfig },
    { id: "openrouter:deepseek/deepseek-v4-flash", config: jsonReviewProviderConfig },
    judgeProvider,
  ],
  tests: reviewFixtures.map((fixture) => ({
    description: fixture.id,
    vars: {
      fixtureId: fixture.id,
      title: fixture.title,
      description: fixture.description,
      diff: fixture.diff,
    },
    assert: [
      { type: "javascript", value: createFailingReviewAssertion(fixture.expected) },
      {
        type: "llm-rubric",
        value: readFileSync(new URL(`./${fixture.rubricPath}`, import.meta.url), "utf8"),
        provider: judgeProvider,
      },
    ],
  })),
};
