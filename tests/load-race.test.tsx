import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "../src/client/App";

const skuA = { sku: "SKU-A", name: "Paper", quantity: 3, lowStockThreshold: 1, lowStock: false };
const skuB = { sku: "SKU-B", name: "Pencils", quantity: 7, lowStockThreshold: 2, lowStock: false };

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function addSkuB(): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("SKU"), skuB.sku);
  await user.type(screen.getByLabelText("Name"), skuB.name);
  await user.type(screen.getByLabelText("Quantity"), String(skuB.quantity));
  await user.type(screen.getByLabelText("Low-stock threshold"), String(skuB.lowStockThreshold));
  await user.click(screen.getByRole("button", { name: "Add product" }));
  await waitFor(() => expect(screen.getByText("Added SKU-B.")).toBeTruthy());
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("[EX-1] keeps SKU-B and its quantity after the delayed first GET arrives", async () => {
  let releaseGet!: (value: Response) => void;
  const firstGet = new Promise<Response>((resolve) => { releaseGet = resolve; });
  const fetchMock = vi.fn()
    .mockReturnValueOnce(firstGet)
    .mockResolvedValueOnce(response(skuB, 201));
  vi.stubGlobal("fetch", fetchMock);

  render(<App />);
  expect(screen.getByText("Loading products…")).toBeTruthy();
  await addSkuB();
  releaseGet(response([skuA]));

  const row = await screen.findByRole("row", { name: /SKU-B/ });
  expect(within(row).getByRole("cell", { name: "7" })).toBeTruthy();
  expect(screen.getAllByRole("cell", { name: "SKU-B" })).toHaveLength(1);
  expect(screen.getByRole("cell", { name: "SKU-A" })).toBeTruthy();
});

it("[EX-2] loads normally and lists a product added afterward exactly once", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(response([skuA]))
    .mockResolvedValueOnce(response(skuB, 201)));

  render(<App />);
  expect(await screen.findByRole("cell", { name: "SKU-A" })).toBeTruthy();
  await addSkuB();
  const row = await screen.findByRole("row", { name: /SKU-B/ });
  expect(within(row).getByRole("cell", { name: "7" })).toBeTruthy();
  expect(screen.getAllByRole("cell", { name: "SKU-B" })).toHaveLength(1);
});
