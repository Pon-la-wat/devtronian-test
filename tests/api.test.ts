// @vitest-environment node
import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createInventoryServer } from "../src/server/index.js";

let dir: string;
let dataFilePath: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "inventory-api-"));
  dataFilePath = join(dir, "inventory.json");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function withServer<T>(
  fn: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const server = createInventoryServer(dataFilePath);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address() as AddressInfo;
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function postJson(baseUrl: string, path: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

it("[EX-1] creates a product and lists it", async () => {
  await withServer(async (baseUrl) => {
    const createResponse = await postJson(baseUrl, "/api/products", {
      sku: "SKU-A",
      name: "Paper",
      quantity: 5,
      lowStockThreshold: 2,
    });
    expect(createResponse.status).toBe(201);

    const listResponse = await fetch(`${baseUrl}/api/products`);
    const products = await listResponse.json();
    expect(products).toEqual([
      { sku: "SKU-A", name: "Paper", quantity: 5, lowStockThreshold: 2, lowStock: false },
    ]);
  });
});

it("[EX-1] refuses a duplicate SKU without changing stored data", async () => {
  await withServer(async (baseUrl) => {
    await postJson(baseUrl, "/api/products", {
      sku: "SKU-A",
      name: "Paper",
      quantity: 5,
      lowStockThreshold: 2,
    });
    const duplicateResponse = await postJson(baseUrl, "/api/products", {
      sku: "SKU-A",
      name: "Other",
      quantity: 1,
      lowStockThreshold: 0,
    });
    expect(duplicateResponse.status).toBe(400);

    const listResponse = await fetch(`${baseUrl}/api/products`);
    const products = await listResponse.json();
    expect(products).toHaveLength(1);
    expect(products[0].name).toBe("Paper");
  });
});

it("[EX-1] refuses blank and fractional input without changing stored data", async () => {
  await withServer(async (baseUrl) => {
    const blankSku = await postJson(baseUrl, "/api/products", {
      sku: "",
      name: "Paper",
      quantity: 5,
      lowStockThreshold: 2,
    });
    expect(blankSku.status).toBe(400);

    const fractionalQuantity = await postJson(baseUrl, "/api/products", {
      sku: "SKU-B",
      name: "Paper",
      quantity: 1.5,
      lowStockThreshold: 2,
    });
    expect(fractionalQuantity.status).toBe(400);

    const listResponse = await fetch(`${baseUrl}/api/products`);
    expect(await listResponse.json()).toEqual([]);
  });
});

it("[EX-2] a decrease records history with direction, amount, reason and time", async () => {
  await withServer(async (baseUrl) => {
    await postJson(baseUrl, "/api/products", {
      sku: "SKU-A",
      name: "Paper",
      quantity: 5,
      lowStockThreshold: 2,
    });

    const decreaseResponse = await postJson(
      baseUrl,
      "/api/products/SKU-A/adjustments",
      { direction: "decrease", amount: 3, reason: "sold" },
    );
    expect(decreaseResponse.status).toBe(201);
    const decreaseBody = await decreaseResponse.json();
    expect(decreaseBody.product).toEqual({
      sku: "SKU-A",
      name: "Paper",
      quantity: 2,
      lowStockThreshold: 2,
      lowStock: true,
    });
    expect(decreaseBody.adjustment).toMatchObject({
      sku: "SKU-A",
      direction: "decrease",
      amount: 3,
      beforeQuantity: 5,
      afterQuantity: 2,
      reason: "sold",
    });
    expect(typeof decreaseBody.adjustment.occurredAt).toBe("string");

    const increaseResponse = await postJson(
      baseUrl,
      "/api/products/SKU-A/adjustments",
      { direction: "increase", amount: 1, reason: "restock" },
    );
    const increaseBody = await increaseResponse.json();
    expect(increaseBody.product.quantity).toBe(3);
    expect(increaseBody.product.lowStock).toBe(false);

    const historyResponse = await fetch(
      `${baseUrl}/api/products/SKU-A/adjustments`,
    );
    const history = await historyResponse.json();
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({
      direction: "decrease",
      beforeQuantity: 5,
      afterQuantity: 2,
    });
    expect(history[1]).toMatchObject({
      direction: "increase",
      beforeQuantity: 2,
      afterQuantity: 3,
    });
  });
});

it("[EX-3] refuses a decrease past zero and an invalid adjustment without changing data", async () => {
  await withServer(async (baseUrl) => {
    await postJson(baseUrl, "/api/products", {
      sku: "SKU-A",
      name: "Paper",
      quantity: 3,
      lowStockThreshold: 2,
    });

    const overDecrease = await postJson(
      baseUrl,
      "/api/products/SKU-A/adjustments",
      { direction: "decrease", amount: 4, reason: "sold" },
    );
    expect(overDecrease.status).toBe(400);

    const blankReason = await postJson(
      baseUrl,
      "/api/products/SKU-A/adjustments",
      { direction: "decrease", amount: 1, reason: "" },
    );
    expect(blankReason.status).toBe(400);

    const listResponse = await fetch(`${baseUrl}/api/products`);
    const products = await listResponse.json();
    expect(products[0].quantity).toBe(3);

    const historyResponse = await fetch(
      `${baseUrl}/api/products/SKU-A/adjustments`,
    );
    expect(await historyResponse.json()).toEqual([]);
  });
});

it("[EX-3] treats quantity zero with threshold zero as low stock", async () => {
  await withServer(async (baseUrl) => {
    await postJson(baseUrl, "/api/products", {
      sku: "SKU-Z",
      name: "Zero",
      quantity: 0,
      lowStockThreshold: 0,
    });
    const listResponse = await fetch(`${baseUrl}/api/products`);
    const products = await listResponse.json();
    expect(products[0].lowStock).toBe(true);
  });
});

it("[EX-4] products and their exact history survive a restart", async () => {
  await withServer(async (baseUrl) => {
    await postJson(baseUrl, "/api/products", {
      sku: "SKU-A",
      name: "Paper",
      quantity: 5,
      lowStockThreshold: 2,
    });
    await postJson(baseUrl, "/api/products/SKU-A/adjustments", {
      direction: "decrease",
      amount: 3,
      reason: "sold",
    });
  });

  await withServer(async (baseUrl) => {
    const listResponse = await fetch(`${baseUrl}/api/products`);
    const products = await listResponse.json();
    expect(products).toEqual([
      { sku: "SKU-A", name: "Paper", quantity: 2, lowStockThreshold: 2, lowStock: true },
    ]);

    const historyResponse = await fetch(
      `${baseUrl}/api/products/SKU-A/adjustments`,
    );
    const history = await historyResponse.json();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      sku: "SKU-A",
      direction: "decrease",
      amount: 3,
      beforeQuantity: 5,
      afterQuantity: 2,
      reason: "sold",
    });
  });
});
