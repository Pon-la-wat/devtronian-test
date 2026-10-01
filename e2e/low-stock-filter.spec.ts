import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const productA = { sku: "A", name: "Paper", quantity: 2, lowStockThreshold: 5, lowStock: true };
const productB = { sku: "B", name: "Pencils", quantity: 10, lowStockThreshold: 5, lowStock: false };
const productAtThreshold = { sku: "C", name: "Pens", quantity: 5, lowStockThreshold: 5, lowStock: true };

async function checkAxe(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter(({ impact }) => impact === "serious" || impact === "critical"),
  ).toEqual([]);
}

async function tabTo(page: Page, locator: Locator): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await locator.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Expected focus to reach target by keyboard tabbing");
}

async function stubProducts(page: Page, products: unknown[]): Promise<void> {
  await page.route("**/api/products", (route) => route.fulfill({ json: products }));
}

test("[EX-1] the checkbox starts unchecked and all products are listed", async ({ page }) => {
  await stubProducts(page, [productA, productB]);
  await page.goto("/");

  const checkbox = page.getByRole("checkbox", { name: "Show only low stock" });
  await expect(checkbox).not.toBeChecked();
  await expect(page.getByRole("cell", { name: "A", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "B", exact: true })).toBeVisible();
  await checkAxe(page);
});

test("[EX-2] toggling by keyboard lists only the low product, then both again", async ({ page }) => {
  await stubProducts(page, [productA, productB]);
  await page.goto("/");

  const checkbox = page.getByRole("checkbox", { name: "Show only low stock" });
  await tabTo(page, checkbox);
  await page.keyboard.press("Space");
  await expect(checkbox).toBeChecked();
  await expect(page.getByRole("cell", { name: "A", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "B", exact: true })).toHaveCount(0);
  await checkAxe(page);

  await page.keyboard.press("Space");
  await expect(checkbox).not.toBeChecked();
  await expect(page.getByRole("cell", { name: "B", exact: true })).toBeVisible();
  await checkAxe(page);
});

test("[EX-3] a product exactly at its threshold is shown when the filter is on", async ({ page }) => {
  await stubProducts(page, [productAtThreshold, productB]);
  await page.goto("/");

  await tabTo(page, page.getByRole("checkbox", { name: "Show only low stock" }));
  await page.keyboard.press("Space");
  await expect(page.getByRole("cell", { name: "C", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "B", exact: true })).toHaveCount(0);
  await checkAxe(page);
});

test("[EX-4] with no low-stock product the filter shows the empty message", async ({ page }) => {
  await stubProducts(page, [productB]);
  await page.goto("/");

  await expect(page.getByText("No low-stock products")).toHaveCount(0);
  await tabTo(page, page.getByRole("checkbox", { name: "Show only low stock" }));
  await page.keyboard.press("Space");
  await expect(page.getByText("No low-stock products")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Show only low stock" })).toBeFocused();
  await checkAxe(page);
});

test("[EX-5] Tab reaches the checkbox and Space toggles it", async ({ page }) => {
  await stubProducts(page, [productA, productB]);
  await page.goto("/");
  await expect(page.getByRole("cell", { name: "A", exact: true })).toBeVisible();

  const checkbox = page.getByRole("checkbox", { name: "Show only low stock" });
  await tabTo(page, checkbox);
  await expect(checkbox).toBeFocused();
  await page.keyboard.press("Space");
  await expect(checkbox).toBeChecked();
  await checkAxe(page);
});
