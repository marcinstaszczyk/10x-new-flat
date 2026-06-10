import { expect, test, type Page } from "@playwright/test";

// Seed for future browser tests.
// Provenance: roadmap S-03, test-plan risks #1 and #4, manual smoke from
// testing-critical-prepare-viewing-flow Phase 4.

test.describe("North Star prepare-viewing flow", () => {
  test("buyer prepares and reviews a long saved offer with four extraction buckets", async ({ page }) => {
    const timestamp = Date.now();
    const title = `E2E North Star offer ${timestamp}`;
    const sourceUrl = `https://example.test/offers/${timestamp}`;

    await page.goto("/offers/new");
    await page.context().addCookies([
      {
        name: "e2e-openrouter-mock",
        value: "true",
        url: new URL("/", page.url()).toString(),
      },
    ]);

    // Setup: create a unique saved offer through the real authenticated app flow.
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Source URL").fill(sourceUrl);
    await page.getByLabel("Pasted offer content").fill(buildLongOfferContent());
    await page.getByRole("button", { name: "Save offer" }).click();

    await expect(page).toHaveURL(/\/offers\/[0-9a-f-]+\?created=success$/);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText("E2E_LONG_OFFER_END")).toBeVisible();
    await waitForAstroIslands(page);

    // Action: prepare the offer through the backend; OpenRouter is mocked server-side.
    const prepareResponse = page.waitForResponse((response) => {
      const request = response.request();
      return (
        request.method() === "POST" && response.url().includes("/api/offers/") && response.url().includes("/prepare")
      );
    });
    await page.getByRole("button", { name: "Przygotuj odpowiedzi" }).click();
    const response = await prepareResponse;
    expect(response.status()).toBe(201);

    // Assertion: the review page preserves the offer and renders every app bucket.
    await expect(page.getByRole("heading", { name: "Wyniki" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Odpowiedzi gotowe/ })).toBeDisabled();
    await expect(page.getByText("E2E_LONG_OFFER_END")).toBeVisible();

    await expect(page.getByRole("heading", { name: /Pytania z odpowiedzi.*\(1\)/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Pytania bez odpowiedzi.*\(1\)/ })).toBeVisible();
    await expect(page.getByText("E2E answer: parking is included in the garage.")).toBeVisible();
    await expect(page.getByText("E2E doubtful monthly rent")).toBeVisible();
    await expect(page.getByText("E2E unmapped floor")).toBeVisible();
  });
});

function buildLongOfferContent(): string {
  return [
    "E2E_LONG_OFFER_START",
    "Bright flat with a private garage space and enough detail to exercise long pasted content. ".repeat(900),
    "E2E_LONG_OFFER_FACT: private garage space is included.",
    "The monthly rent is listed once as PLN 3,500 and later as PLN 3,800.",
    "E2E_LONG_OFFER_END",
  ].join("\n");
}

async function waitForAstroIslands(page: Page) {
  await page.waitForFunction(() => {
    const islands = Array.from(document.querySelectorAll("astro-island"));
    return islands.length > 0 && islands.every((island) => !island.hasAttribute("ssr"));
  });
}
