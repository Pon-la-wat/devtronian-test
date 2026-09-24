import { randomUUID } from "node:crypto";

export interface Product {
  sku: string;
  name: string;
  quantity: number;
  lowStockThreshold: number;
}

export interface Adjustment {
  id: string;
  sku: string;
  direction: "increase" | "decrease";
  amount: number;
  beforeQuantity: number;
  afterQuantity: number;
  reason: string;
  occurredAt: string;
}

export interface InventoryState {
  products: Product[];
  adjustments: Adjustment[];
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function emptyInventoryState(): InventoryState {
  return { products: [], adjustments: [] };
}

export function isLowStock(product: Product): boolean {
  return product.quantity <= product.lowStockThreshold;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function asPositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

export interface CreateProductInput {
  sku: unknown;
  name: unknown;
  quantity: unknown;
  lowStockThreshold: unknown;
}

export function createProduct(
  state: InventoryState,
  input: CreateProductInput,
): Product {
  const sku = asTrimmedString(input.sku);
  if (!sku) throw new ValidationError("sku is required");
  const name = asTrimmedString(input.name);
  if (!name) throw new ValidationError("name is required");
  const quantity = asNonNegativeInteger(input.quantity);
  if (quantity === null) {
    throw new ValidationError("quantity must be an integer >= 0");
  }
  const lowStockThreshold = asNonNegativeInteger(input.lowStockThreshold);
  if (lowStockThreshold === null) {
    throw new ValidationError("lowStockThreshold must be an integer >= 0");
  }
  if (state.products.some((product) => product.sku === sku)) {
    throw new ValidationError(`sku ${sku} already exists`);
  }

  const product: Product = { sku, name, quantity, lowStockThreshold };
  state.products.push(product);
  return product;
}

export interface AdjustStockInput {
  sku: string;
  direction: unknown;
  amount: unknown;
  reason: unknown;
}

export function adjustStock(
  state: InventoryState,
  input: AdjustStockInput,
  now: () => Date = () => new Date(),
): Adjustment {
  const product = state.products.find((item) => item.sku === input.sku);
  if (!product) throw new ValidationError(`product ${input.sku} not found`);
  if (input.direction !== "increase" && input.direction !== "decrease") {
    throw new ValidationError("direction must be increase or decrease");
  }
  const amount = asPositiveInteger(input.amount);
  if (amount === null) {
    throw new ValidationError("amount must be a positive integer");
  }
  const reason = asTrimmedString(input.reason);
  if (!reason) throw new ValidationError("reason is required");

  const beforeQuantity = product.quantity;
  const afterQuantity =
    input.direction === "increase"
      ? beforeQuantity + amount
      : beforeQuantity - amount;
  if (afterQuantity < 0) {
    throw new ValidationError("stock cannot go negative");
  }
  if (!Number.isSafeInteger(afterQuantity)) {
    throw new ValidationError("stock must remain a safe integer");
  }

  product.quantity = afterQuantity;
  const adjustment: Adjustment = {
    id: randomUUID(),
    sku: product.sku,
    direction: input.direction,
    amount,
    beforeQuantity,
    afterQuantity,
    reason,
    occurredAt: now().toISOString(),
  };
  state.adjustments.push(adjustment);
  return adjustment;
}
