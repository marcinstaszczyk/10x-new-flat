import { appendFileSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { parseReview } from "./review-contract.ts";
import type { ReviewResult } from "./common/review-schema.ts";

type Provider = "openai" | "openrouter";

export function validateProviderCredentials(
  provider: string | undefined,
  environment: NodeJS.ProcessEnv = process.env,
): Provider {
  if (provider !== "openai" && provider !== "openrouter") {
    throw new Error("CODEX_PROVIDER must be openai or openrouter");
  }

  const credential = provider === "openai" ? environment.OPENAI_API_KEY : environment.OPENROUTER_API_KEY;
  if (!credential) throw new Error(`${provider === "openai" ? "OPENAI_API_KEY" : "OPENROUTER_API_KEY"} is required`);

  return provider;
}

const criterionLabels = {
  implementationCorrectness: "Implementation correctness",
  idiomaticity: "Idiomaticity",
  complexity: "Complexity",
  testRiskCoverage: "Test-risk coverage",
  documentation: "Documentation",
  securitySafety: "Security and safety",
} as const;

function tableCell(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\|/g, "\\|").trim();
}

export function formatReviewScorecard(review: ReviewResult): string {
  const rows = Object.entries(criterionLabels).map(([key, label]) => {
    const criterion = review.criteria[key as keyof ReviewResult["criteria"]];
    return `| ${label} | ${criterion.score}/10 | ${tableCell(criterion.rationale)} |`;
  });

  return ["## Review scorecard", "", "| Criterion | Score | Rationale |", "| --- | ---: | --- |", ...rows].join("\n");
}

export function serializeActionOutputs(resultJson: string, resultPath: string): string {
  const review = parseReview(resultJson);
  const summary = `${review.summary}\n\n${formatReviewScorecard(review)}`;
  let delimiter = `CODEX_REVIEW_${randomUUID()}`;

  while (summary.includes(delimiter)) {
    delimiter = `CODEX_REVIEW_${randomUUID()}`;
  }

  return [
    `verdict=${review.verdict}`,
    `result-path=${resultPath}`,
    `summary<<${delimiter}`,
    summary,
    delimiter,
    "",
  ].join("\n");
}

function run(): void {
  const command = process.argv[2];
  if (command === "validate-provider") {
    validateProviderCredentials(process.env.CODEX_PROVIDER);
    return;
  }

  if (command === "export-result") {
    const resultPath = process.env.REVIEW_RESULT_PATH;
    const outputPath = process.env.GITHUB_OUTPUT;
    if (!resultPath || !outputPath) throw new Error("REVIEW_RESULT_PATH and GITHUB_OUTPUT are required");

    appendFileSync(outputPath, serializeActionOutputs(readFileSync(resultPath, "utf8"), resultPath));
    return;
  }

  throw new Error("Expected validate-provider or export-result command");
}

if (process.argv[1]?.endsWith("action-contract.ts")) run();
