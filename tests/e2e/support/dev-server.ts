import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { loadE2eEnv } from "./env";

const serverMetaPath = path.resolve("test-results/.server.json");

interface ServerMeta {
  pid: number;
}

export async function startDevServer(baseURL: string) {
  loadE2eEnv();

  if (process.env.PLAYWRIGHT_BASE_URL || (await canReach(baseURL))) {
    return;
  }

  await fs.mkdir(path.dirname(serverMetaPath), { recursive: true });

  const isWindows = process.platform === "win32";
  const child = spawn(
    isWindows ? "cmd.exe" : "npx",
    isWindows
      ? ["/d", "/s", "/c", "npx astro dev --host 127.0.0.1 --port 4321"]
      : ["astro", "dev", "--host", "127.0.0.1", "--port", "4321"],
    {
      detached: true,
      env: {
        ...process.env,
        E2E_OPENROUTER_MOCK: "true",
        WRANGLER_HOME: path.resolve(".wrangler-home"),
        XDG_CONFIG_HOME: path.resolve(".wrangler-config"),
      },
      stdio: "ignore",
    },
  );

  child.unref();
  if (child.pid === undefined) {
    throw new Error("Failed to start dev server process.");
  }

  await fs.writeFile(serverMetaPath, JSON.stringify({ pid: child.pid } satisfies ServerMeta));
  await waitForServer(baseURL);
}

export async function stopDevServer() {
  const meta = await readServerMeta();
  if (!meta) {
    return;
  }

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(meta.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    process.kill(-meta.pid, "SIGTERM");
  }

  await fs.rm(serverMetaPath, { force: true });
}

async function waitForServer(baseURL: string) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 120_000) {
    if (await canReach(baseURL)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for dev server at ${baseURL}.`);
}

async function canReach(baseURL: string) {
  try {
    const response = await fetch(baseURL);
    return response.status < 500;
  } catch {
    return false;
  }
}

async function readServerMeta(): Promise<ServerMeta | null> {
  try {
    const content = await fs.readFile(serverMetaPath, "utf8");
    return JSON.parse(content) as ServerMeta;
  } catch {
    return null;
  }
}
