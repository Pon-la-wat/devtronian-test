import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "../src/client/App";

const productA = { sku: "A", name: "Paper", quantity: 2, lowStockThreshold: 5, lowStock: true };
const productB = { sku: "B", name: "Pencils", quantity: 10, lowStockThreshold: 5, lowStock: false };
const productAtThreshold = { sku: "C", name: "Pens", quantity: 5, lowStockThreshold: 5, lowStock: true };

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

function stubProducts(products: unknown[]): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(products)));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("[EX-1] starts unchecked and lists all products", async () => {
  stubProducts([productA, productB]);
  render(<App />);

  const checkbox = await screen.findByRole("checkbox", { name: "Show only low stock" });
  expect((checkbox as HTMLInputElement).checked).toBe(false);
  expect(screen.getByRole("cell", { name: "A" })).toBeTruthy();
  expect(screen.getByRole("cell", { name: "B" })).toBeTruthy();
});

it("[EX-2] checking lists only the low product and unchecking lists both", async () => {
  stubProducts([productA, productB]);
  const user = userEvent.setup();
  render(<App />);

  await user.click(await screen.findByRole("checkbox", { name: "Show only low stock" }));
  expect(screen.getByRole("cell", { name: "A" })).toBeTruthy();
  expect(screen.queryByRole("cell", { name: "B" })).toBeNull();

  await user.click(screen.getByRole("checkbox", { name: "Show only low stock" }));
  expect(screen.getByRole("cell", { name: "A" })).toBeTruthy();
  expect(screen.getByRole("cell", { name: "B" })).toBeTruthy();
});

it("[EX-3] a product exactly at its threshold is shown when the filter is on", async () => {
  stubProducts([productAtThreshold, productB]);
  const user = userEvent.setup();
  render(<App />);

  await user.click(await screen.findByRole("checkbox", { name: "Show only low stock" }));
  expect(screen.getByRole("cell", { name: "C" })).toBeTruthy();
  expect(screen.queryByRole("cell", { name: "B" })).toBeNull();
});

it("[EX-4] checking with no low-stock product shows the empty message", async () => {
  stubProducts([productB]);
  const user = userEvent.setup();
  render(<App />);

  expect(screen.queryByText("No low-stock products")).toBeNull();
  await user.click(await screen.findByRole("checkbox", { name: "Show only low stock" }));
  expect(screen.getByText("No low-stock products")).toBeTruthy();
  expect(screen.queryByRole("table")).toBeNull();
});

it("[EX-5] the checkbox is reachable with Tab and toggles with Space", async () => {
  stubProducts([productA, productB]);
  const user = userEvent.setup();
  render(<App />);

  const checkbox = (await screen.findByRole("checkbox", {
    name: "Show only low stock",
  })) as HTMLInputElement;
  for (let i = 0; i < 20 && document.activeElement !== checkbox; i += 1) {
    await user.tab();
  }
  expect(document.activeElement).toBe(checkbox);

  await user.keyboard(" ");
  expect(checkbox.checked).toBe(true);
  expect(screen.queryByRole("cell", { name: "B" })).toBeNull();
});
