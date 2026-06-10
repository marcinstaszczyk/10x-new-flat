import fs from "node:fs";
import path from "node:path";

const ENV_FILES = [".env", ".dev.vars"];

export function loadE2eEnv() {
  for (const file of ENV_FILES) {
    const absolutePath = path.resolve(file);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    const entries = parseEnvFile(fs.readFileSync(absolutePath, "utf8"));
    for (const [key, value] of Object.entries(entries)) {
      process.env[key] ??= value;
    }
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for Playwright E2E tests.`);
  }

  return value;
}

function parseEnvFile(content: string): Record<string, string> {
  const entries: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    entries[key] = stripQuotes(value);
  }

  return entries;
}

function stripQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}
