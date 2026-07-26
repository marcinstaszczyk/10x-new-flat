import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const resultPath = resolve(".promptfoo/critical-transfer-results.json");

if (!process.env.OPENROUTER_API_KEY) {
  throw new Error("OPENROUTER_API_KEY is required for the local code-review evaluation.");
}

await mkdir(dirname(resultPath), { recursive: true });
const command = process.platform === "win32" ? "promptfoo.cmd" : "promptfoo";
const result = spawnSync(command, ["eval", "-c", "evals/promptfooconfig.ts", "-o", resultPath], {
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
if (!existsSync(resultPath)) throw new Error("Promptfoo did not create the result report.");
