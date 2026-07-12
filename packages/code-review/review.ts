import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Codex } from "@openai/codex-sdk";
import { REVIEWER_PROMPT, REVIEW_JSON_SCHEMA, ReviewCriteria, ReviewResult } from "./common/review-schema.ts";

type CodexProvider = "local" | "openai" | "openrouter";

const FlatReviewResult = ReviewCriteria.extend({
  verdict: ReviewResult.shape.verdict,
  summary: ReviewResult.shape.summary,
});

function packageDir(): string {
  return dirname(fileURLToPath(import.meta.url));
}

function isMainModule(): boolean {
  if (!process.argv[1]) return false;
  return resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

function loadSampleDiff(): string {
  const sample = process.argv[2] ?? "sample-1";
  const path = join(packageDir(), "data", `${sample}.md`);
  let diff = readFileSync(path, "utf8").trim();

  if (diff.startsWith("```")) {
    diff = diff.replace(/^```[a-z]*\n/, "").replace(/\n```$/, "");
  }

  return `${diff}\n`;
}

export async function readDiff(): Promise<string> {
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];

    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }

    const piped = Buffer.concat(chunks).toString("utf8").trim();
    if (piped) return `${piped}\n`;
  }

  return loadSampleDiff();
}

function parseReview(response: string): ReviewResult {
  const parsedJson: unknown = JSON.parse(response);
  const parsedReview = ReviewResult.safeParse(parsedJson);
  if (parsedReview.success) return parsedReview.data;

  const parsedFlatReview = FlatReviewResult.safeParse(parsedJson);
  if (parsedFlatReview.success) {
    const { verdict, summary, ...criteria } = parsedFlatReview.data;
    return { criteria, verdict, summary };
  }

  throw new Error(
    `Invalid structured review output: ${parsedReview.error.message}\nResponse: ${response.slice(0, 2_000)}`,
  );
}

function codexEnvironment(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] =>
        entry[1] !== undefined &&
        entry[0] !== "OPENAI_API_KEY" &&
        entry[0] !== "OPENROUTER_API_KEY" &&
        entry[0] !== "CODEX_API_KEY",
    ),
  );
}

function codexProvider(): CodexProvider {
  const provider = process.env.CODEX_PROVIDER ?? "local";
  if (provider === "local" || provider === "openai" || provider === "openrouter") return provider;

  throw new Error(`Unsupported CODEX_PROVIDER: ${provider}`);
}

function requiredEnvironmentVariable(name: "OPENAI_API_KEY" | "OPENROUTER_API_KEY"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);

  return value;
}

function codexClient(): Codex {
  const provider = codexProvider();
  const env = codexEnvironment();
  const config = {
    shell_environment_policy: {
      inherit: "core",
      ignore_default_excludes: false,
      exclude: ["CODEX_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY", "GITHUB_TOKEN"],
    },
  };

  if (provider === "local") return new Codex({ env, config });

  if (provider === "openai") {
    return new Codex({ apiKey: requiredEnvironmentVariable("OPENAI_API_KEY"), env, config });
  }

  env.OPENROUTER_API_KEY = requiredEnvironmentVariable("OPENROUTER_API_KEY");

  return new Codex({
    env,
    config: {
      ...config,
      model_provider: "openrouter",
      model_providers: {
        openrouter: {
          name: "openrouter",
          base_url: "https://openrouter.ai/api/v1",
          env_key: "OPENROUTER_API_KEY",
        },
      },
    },
  });
}

export async function review(diff: string): Promise<ReviewResult> {
  const codex = codexClient();
  const thread = codex.startThread({
    model: process.env.CODEX_REVIEW_MODEL,
    sandboxMode: "read-only",
    approvalPolicy: "never",
    webSearchMode: "disabled",
    skipGitRepoCheck: true,
  });

  const turn = await thread.run(`${REVIEWER_PROMPT}\n\nReview this diff:\n\n${diff}`, {
    outputSchema: REVIEW_JSON_SCHEMA,
  });

  return parseReview(turn.finalResponse);
}

if (isMainModule()) {
  const diff = await readDiff();
  process.stdout.write(`${JSON.stringify(await review(diff), null, 2)}\n`);
}
