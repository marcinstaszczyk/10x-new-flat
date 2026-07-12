import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Codex } from "@openai/codex-sdk";
import { REVIEWER_PROMPT, REVIEW_JSON_SCHEMA, ReviewResult } from "./common/review-schema.ts";

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

  if (!parsedReview.success) {
    throw new Error(`Invalid structured review output: ${parsedReview.error.message}`);
  }

  return parsedReview.data;
}

export async function review(diff: string): Promise<ReviewResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }

  const codex = new Codex({
    apiKey,
    config: {
      shell_environment_policy: {
        inherit: "core",
        ignore_default_excludes: false,
        exclude: ["CODEX_API_KEY", "OPENAI_API_KEY", "GITHUB_TOKEN"],
      },
    },
  });
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
