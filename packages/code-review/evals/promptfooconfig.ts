import { readFileSync } from "node:fs";
import { hasFailingCriticalReview } from "./assertions/review-result.ts";
import { criticalTransferFixture } from "./fixtures/critical-transfer.ts";
import { renderReviewPrompt } from "../review-contract.ts";

const judgeProvider = {
  id: "openrouter:openai/gpt-5.6-luna",
  config: { temperature: 0 },
};

export default {
  description: "Critical transfer code-review regression evaluation",
  prompts: [renderReviewPrompt(criticalTransferFixture)],
  providers: [
    { id: "openrouter:z-ai/glm-5.1", config: { temperature: 0 } },
    { id: "openrouter:deepseek/deepseek-v4-flash", config: { temperature: 0 } },
    judgeProvider,
  ],
  tests: [
    {
      assert: [
        { type: "javascript", value: hasFailingCriticalReview },
        {
          type: "llm-rubric",
          value: readFileSync(new URL("./rubrics/critical-transfer.md", import.meta.url), "utf8"),
          provider: judgeProvider,
        },
      ],
    },
  ],
};
