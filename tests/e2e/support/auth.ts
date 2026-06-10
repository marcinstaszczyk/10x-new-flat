import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { FullConfig } from "@playwright/test";
import type { Database } from "@/types";
import { loadE2eEnv, requireEnv } from "./env";

export const authDirectory = path.resolve("test-results/.auth");
export const authStatePath = path.join(authDirectory, "user.json");
export const authMetaPath = path.join(authDirectory, "user-meta.json");

interface E2eUser {
  id: string;
  email: string;
  password: string;
}

export function resolveBaseUrl(config: FullConfig): string {
  const baseURL = config.projects[0]?.use.baseURL;
  if (typeof baseURL === "string") {
    return baseURL;
  }

  return process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4321";
}

export async function createE2eUser(): Promise<E2eUser> {
  loadE2eEnv();
  await fs.mkdir(authDirectory, { recursive: true });

  const timestamp = Date.now();
  const user = {
    id: "",
    email: `e2e-north-star-${timestamp}@example.test`,
    password: `E2e-password-${timestamp}!`,
  };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Could not create E2E user: ${error.message}`);
  }

  user.id = data.user.id;
  await fs.writeFile(authMetaPath, JSON.stringify(user, null, 2));

  return user;
}

export async function deleteE2eUser() {
  loadE2eEnv();

  const user = await readE2eUser();
  if (!user) {
    return;
  }

  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(user.id);
  await fs.rm(authDirectory, { recursive: true, force: true });
}

async function readE2eUser(): Promise<E2eUser | null> {
  try {
    const content = await fs.readFile(authMetaPath, "utf8");
    return JSON.parse(content) as E2eUser;
  } catch {
    return null;
  }
}

function createAdminClient() {
  return createClient<Database>(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
