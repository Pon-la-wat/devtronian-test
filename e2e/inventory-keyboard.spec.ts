import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectNoSeriousAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const seriousViolations = results.violations.filter((violation) =>
    violation.impact === "serious" || violation.impact === "critical",
  );
  expect(seriousViolations).toEqual([]);
}

async function tabTo(page: Page, locator: Locator): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await locator.evaluate((element) => element === document.activeElement)) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error("Expected focus to reach target by keyboard tabbing");
}

test("[EX-4] the inventory UI exposes required states and the main flow works by keyboard", async ({
  page,
}) => {
  let releaseInitialProducts!: () => void;
  const initialProductsReleased = new Promise<void>((resolve) => {
    releaseInitialProducts = resolve;
  });
  let interceptedInitialList = false;

  await page.route("**/api/products", async (route) => {
    const request = route.request();
    if (!interceptedInitialList && request.method() === "GET") {
      interceptedInitialList = true;
      await initialProductsReleased;
      await route.fulfill({
        contentType: "application/json",
        body: "[]",
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/");
  await expect(page.getByText("Loading products…")).toBeVisible();
  await expectNoSeriousAxeViolations(page);

  releaseInitialProducts();
  await expect(page.getByText("No products yet.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add product" })).toBeVisible();
  await expectNoSeriousAxeViolations(page);

  await tabTo(page, page.getByLabel("SKU"));
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Add product" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("alert")).toContainText("sku is required");
  await expect(page.getByRole("button", { name: "Add product" })).toBeVisible();
  await expectNoSeriousAxeViolations(page);

  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByLabel("SKU")).toBeFocused();
  await page.keyboard.type("SKU-A");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Paper");
  await page.keyboard.press("Tab");
  await page.keyboard.type("5");
  await page.keyboard.press("Tab");
  await page.keyboard.type("2");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Add product" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByText("Added SKU-A.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "SKU-A" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "OK" })).toBeVisible();
  await expectNoSeriousAxeViolations(page);

  await tabTo(page, page.getByRole("button", { name: "Adjust stock" }));
  await page.keyboard.press("Enter");
  await tabTo(page, page.getByLabel("Direction"));
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Tab");
  await page.keyboard.type("9");
  await page.keyboard.press("Tab");
  await page.keyboard.type("sold");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Save adjustment" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("alert")).toContainText("stock cannot go negative");
  await expect(page.getByRole("button", { name: "Save adjustment" })).toBeVisible();
  await expectNoSeriousAxeViolations(page);

  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByLabel("Amount")).toBeFocused();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.type("3");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Save adjustment" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByText("SKU-A is now 2.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "2" }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "Low stock" })).toBeVisible();
  await expectNoSeriousAxeViolations(page);
});

test("[EX-4] a load failure has a retry next action", async ({ page }) => {
  let failedOnce = false;
  await page.route("**/api/products", async (route) => {
    if (!failedOnce && route.request().method() === "GET") {
      failedOnce = true;
      await route.abort();
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: "[]",
    });
  });

  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Could not load products. Try again.");
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expectNoSeriousAxeViolations(page);

  await tabTo(page, page.getByRole("button", { name: "Retry" }));
  await page.keyboard.press("Enter");
  await expect(page.getByText("No products yet.")).toBeVisible();
  await expectNoSeriousAxeViolations(page);
});
