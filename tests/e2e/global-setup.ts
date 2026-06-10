import { chromium, expect, type FullConfig } from "@playwright/test";
import { authStatePath, createE2eUser, resolveBaseUrl } from "./support/auth";
import { startDevServer } from "./support/dev-server";

export default async function globalSetup(config: FullConfig) {
  const baseURL = resolveBaseUrl(config);
  await startDevServer(baseURL);

  const user = await createE2eUser();
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(`${baseURL}/auth/signin`, { waitUntil: "domcontentloaded" });
    await page.getByLabel("Email").fill(user.email);
    await page.getByRole("textbox", { name: "Password" }).fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(`${baseURL}/`);

    await page.goto(`${baseURL}/offers`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Saved offers", exact: true })).toBeVisible();
    await page.context().storageState({ path: authStatePath });
  } catch (error) {
    const { deleteE2eUser } = await import("./support/auth");
    await deleteE2eUser();
    throw error;
  } finally {
    await browser.close();
  }
}
