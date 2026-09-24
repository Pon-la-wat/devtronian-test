import { describe, expect, it } from "vitest";
import {
  ValidationError,
  adjustStock,
  createProduct,
  emptyInventoryState,
  isLowStock,
  type InventoryState,
} from "../src/server/inventory.js";

function seededState(): InventoryState {
  const state = emptyInventoryState();
  createProduct(state, {
    sku: "SKU-A",
    name: "Paper",
    quantity: 5,
    lowStockThreshold: 2,
  });
  return state;
}

describe("createProduct", () => {
  it("[EX-1] creates a product with quantity and low-stock status", () => {
    const state = emptyInventoryState();
    const product = createProduct(state, {
      sku: "SKU-A",
      name: "Paper",
      quantity: 5,
      lowStockThreshold: 2,
    });
    expect(product).toEqual({
      sku: "SKU-A",
      name: "Paper",
      quantity: 5,
      lowStockThreshold: 2,
    });
    expect(isLowStock(product)).toBe(false);
    expect(state.products).toHaveLength(1);
  });

  it("[EX-1] refuses a duplicate SKU without changing stored data", () => {
    const state = seededState();
    expect(() =>
      createProduct(state, {
        sku: "SKU-A",
        name: "Other",
        quantity: 1,
        lowStockThreshold: 0,
      }),
    ).toThrow(ValidationError);
    expect(state.products).toHaveLength(1);
    expect(state.products[0].name).toBe("Paper");
  });

  it.each([
    ["a blank SKU", { sku: "", name: "Paper", quantity: 5, lowStockThreshold: 2 }],
    ["a blank name", { sku: "SKU-B", name: "", quantity: 5, lowStockThreshold: 2 }],
    [
      "a negative quantity",
      { sku: "SKU-B", name: "Paper", quantity: -1, lowStockThreshold: 2 },
    ],
    [
      "a fractional quantity",
      { sku: "SKU-B", name: "Paper", quantity: 1.5, lowStockThreshold: 2 },
    ],
    [
      "a negative threshold",
      { sku: "SKU-B", name: "Paper", quantity: 5, lowStockThreshold: -1 },
    ],
    [
      "a fractional threshold",
      { sku: "SKU-B", name: "Paper", quantity: 5, lowStockThreshold: 1.5 },
    ],
  ])("[EX-1] refuses %s without changing stored data", (_label, input) => {
    const state = emptyInventoryState();
    expect(() => createProduct(state, input)).toThrow(ValidationError);
    expect(state.products).toHaveLength(0);
  });
});

describe("adjustStock", () => {
  it("[EX-2] a decrease records history and updates quantity", () => {
    const state = seededState();
    const adjustment = adjustStock(state, {
      sku: "SKU-A",
      direction: "decrease",
      amount: 3,
      reason: "sold",
    });
    expect(adjustment).toMatchObject({
      sku: "SKU-A",
      direction: "decrease",
      amount: 3,
      beforeQuantity: 5,
      afterQuantity: 2,
      reason: "sold",
    });
    expect(typeof adjustment.occurredAt).toBe("string");
    expect(state.products[0].quantity).toBe(2);
    expect(isLowStock(state.products[0])).toBe(true);
    expect(state.adjustments).toHaveLength(1);
  });

  it("[EX-2] an increase after a decrease clears low-stock status", () => {
    const state = seededState();
    adjustStock(state, {
      sku: "SKU-A",
      direction: "decrease",
      amount: 3,
      reason: "sold",
    });
    adjustStock(state, {
      sku: "SKU-A",
      direction: "increase",
      amount: 1,
      reason: "restock",
    });
    expect(state.products[0].quantity).toBe(3);
    expect(isLowStock(state.products[0])).toBe(false);
    expect(state.adjustments).toHaveLength(2);
  });

  it("[EX-3] refuses a decrease that would go negative and changes nothing", () => {
    const state = seededState();
    adjustStock(state, {
      sku: "SKU-A",
      direction: "decrease",
      amount: 3,
      reason: "sold",
    });
    expect(() =>
      adjustStock(state, {
        sku: "SKU-A",
        direction: "decrease",
        amount: 4,
        reason: "sold",
      }),
    ).toThrow(ValidationError);
    expect(state.products[0].quantity).toBe(2);
    expect(state.adjustments).toHaveLength(1);
  });

  it.each([
    [
      "a zero amount",
      { sku: "SKU-A", direction: "increase", amount: 0, reason: "restock" },
    ],
    [
      "a fractional amount",
      { sku: "SKU-A", direction: "increase", amount: 1.5, reason: "restock" },
    ],
    [
      "a blank reason",
      { sku: "SKU-A", direction: "increase", amount: 1, reason: "" },
    ],
  ])("[EX-3] refuses %s and changes nothing", (_label, input) => {
    const state = seededState();
    expect(() => adjustStock(state, input)).toThrow(ValidationError);
    expect(state.products[0].quantity).toBe(5);
    expect(state.adjustments).toHaveLength(0);
  });

  it("[EX-3] treats quantity zero with threshold zero as low stock", () => {
    const state = emptyInventoryState();
    createProduct(state, {
      sku: "SKU-Z",
      name: "Zero",
      quantity: 0,
      lowStockThreshold: 0,
    });
    expect(isLowStock(state.products[0])).toBe(true);
  });
});
