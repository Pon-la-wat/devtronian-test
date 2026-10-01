import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const skuB = { sku: "SKU-B", name: "Pencils", quantity: 7, lowStockThreshold: 2, lowStock: false };

async function checkAxe(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter(({ impact }) => impact === "serious" || impact === "critical")).toEqual([]);
}

async function addSkuBByKeyboard(page: Page): Promise<void> {
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("SKU")).toBeFocused();
  await page.keyboard.type("SKU-B");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Name")).toBeFocused();
  await page.keyboard.type("Pencils");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Quantity")).toBeFocused();
  await page.keyboard.type("7");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Low-stock threshold")).toBeFocused();
  await page.keyboard.type("2");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Add product" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Added SKU-B.")).toBeVisible();
}

test("[EX-1] keyboard add during the first GET survives its delayed response", async ({ page }) => {
  let releaseGet!: () => void;
  const gate = new Promise<void>((resolve) => { releaseGet = resolve; });
  await page.route("**/api/products", async (route) => {
    if (route.request().method() === "GET") {
      await gate;
      await route.fulfill({ json: [] });
    } else {
      await route.fulfill({ status: 201, json: skuB });
    }
  });

  await page.goto("/");
  await expect(page.getByText("Loading products…")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add product" })).toBeVisible();
  await checkAxe(page);
  await addSkuBByKeyboard(page);
  await expect(page.getByText("Loading products…")).toBeVisible();
  await checkAxe(page);
  releaseGet();
  await expect(page.getByText("Loading products…")).toBeHidden();
  const row = page.getByRole("row", { name: /SKU-B/ });
  await expect(row).toBeVisible();
  await expect(row.getByRole("cell", { name: "7" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "SKU-B" })).toHaveCount(1);
  await expect(row.getByRole("button", { name: "Adjust stock" })).toBeVisible();
  await checkAxe(page);
});

test("[EX-2] keyboard add after a normal load is listed once", async ({ page }) => {
  await page.route("**/api/products", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: [] });
    } else {
      await route.fulfill({ status: 201, json: skuB });
    }
  });

  await page.goto("/");
  await expect(page.getByText("No products yet.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add product" })).toBeVisible();
  await checkAxe(page);
  await addSkuBByKeyboard(page);
  const row = page.getByRole("row", { name: /SKU-B/ });
  await expect(row).toBeVisible();
  await expect(row.getByRole("cell", { name: "7" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "SKU-B" })).toHaveCount(1);
  await expect(row.getByRole("button", { name: "Adjust stock" })).toBeVisible();
  await checkAxe(page);
});
