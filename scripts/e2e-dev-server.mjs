import fs from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

process.env.SUPABASE_SERVICE_ROLE_KEY ??= readEnvValue("SUPABASE_SERVICE_ROLE_KEY") ?? "";
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for Playwright E2E tests.");
}

const isWindows = process.platform === "win32";
const command = isWindows ? "cmd.exe" : "npx";
const args = isWindows
  ? ["/d", "/s", "/c", "npx astro dev --host 127.0.0.1 --port 4321"]
  : ["astro", "dev", "--host", "127.0.0.1", "--port", "4321"];

const child = spawn(command, args, {
  env: {
    ...process.env,
    E2E_OPENROUTER_MOCK: "true",
    WRANGLER_HOME: path.resolve(".wrangler-home"),
    XDG_CONFIG_HOME: path.resolve(".wrangler-config"),
  },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

function readEnvValue(name) {
  for (const file of [".env", ".dev.vars"]) {
    if (!fs.existsSync(file)) {
      continue;
    }

    const line = fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .find((entry) => entry.trim().startsWith(`${name}=`));

    if (line) {
      return line
        .slice(line.indexOf("=") + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }

  return undefined;
}
