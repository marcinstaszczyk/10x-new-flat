import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Codex } from "@openai/codex-sdk";
import { REVIEWER_PROMPT, REVIEW_JSON_SCHEMA, type ReviewResult } from "./common/review-schema.ts";
import {
  buildReviewPrompt,
  loadSampleInput,
  parseReview,
  type ReviewInput,
  validateReviewInput,
} from "./review-contract.ts";

type CodexProvider = "local" | "openai" | "openrouter";

function isMainModule(): boolean {
  if (!process.argv[1]) return false;
  return resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function readDiff(path?: string): Promise<string> {
  if (path) return readFileSync(path, "utf8");
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];

    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }

    return Buffer.concat(chunks).toString("utf8");
  }

  return "";
}

export async function readReviewInput(): Promise<ReviewInput> {
  if (process.argv.includes("--sample")) {
    return loadSampleInput(argumentValue("--sample") ?? "sample-1");
  }

  return validateReviewInput({
    title: process.env.CODEX_REVIEW_TITLE ?? "",
    description: process.env.CODEX_REVIEW_DESCRIPTION,
    diff: await readDiff(argumentValue("--diff-file")),
  });
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

export async function review(input: ReviewInput): Promise<ReviewResult> {
  const codex = codexClient();
  const thread = codex.startThread({
    model: process.env.CODEX_REVIEW_MODEL,
    sandboxMode: "read-only",
    approvalPolicy: "never",
    webSearchMode: "disabled",
    skipGitRepoCheck: true,
  });

  const turn = await thread.run(buildReviewPrompt(input, REVIEWER_PROMPT), {
    outputSchema: REVIEW_JSON_SCHEMA,
  });

  return parseReview(turn.finalResponse);
}

if (isMainModule()) {
  process.stdout.write(`${JSON.stringify(await review(await readReviewInput()), null, 2)}\n`);
}
