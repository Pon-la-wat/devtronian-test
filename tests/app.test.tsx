import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "../src/client/App";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("renders the Inventory heading", async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse([]));
  render(<App />);
  expect(screen.getByRole("heading", { name: "Inventory" })).toBeTruthy();
});

it("[EX-4] shows a loading state before products arrive", () => {
  vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
  render(<App />);
  expect(screen.getByText("Loading products…")).toBeTruthy();
});

it("[EX-4] shows the empty state with no products", async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse([]));
  render(<App />);
  await waitFor(() => expect(screen.getByText("No products yet.")).toBeTruthy());
});

it("[EX-4] a load failure shows a retry action", async () => {
  vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));
  render(<App />);
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
});

it("[EX-1] adding a product shows it in the list", async () => {
  const user = userEvent.setup();
  const mockFetch = vi.mocked(fetch);
  mockFetch.mockResolvedValueOnce(jsonResponse([]));
  render(<App />);
  await waitFor(() => screen.getByText("No products yet."));

  mockFetch.mockResolvedValueOnce(
    jsonResponse(
      { sku: "SKU-A", name: "Paper", quantity: 5, lowStockThreshold: 2, lowStock: false },
      201,
    ),
  );
  await user.type(screen.getByLabelText("SKU"), "SKU-A");
  await user.type(screen.getByLabelText("Name"), "Paper");
  await user.type(screen.getByLabelText("Quantity"), "5");
  await user.type(screen.getByLabelText("Low-stock threshold"), "2");
  await user.click(screen.getByRole("button", { name: "Add product" }));

  await waitFor(() => expect(screen.getByText("SKU-A")).toBeTruthy());
  expect(screen.getByText("OK")).toBeTruthy();
});

it("[EX-1] a validation failure keeps the typed values", async () => {
  const user = userEvent.setup();
  const mockFetch = vi.mocked(fetch);
  mockFetch.mockResolvedValueOnce(jsonResponse([]));
  render(<App />);
  await waitFor(() => screen.getByText("No products yet."));

  mockFetch.mockResolvedValueOnce(
    jsonResponse({ error: "sku SKU-A already exists" }, 400),
  );
  await user.type(screen.getByLabelText("SKU"), "SKU-A");
  await user.type(screen.getByLabelText("Name"), "Paper");
  await user.type(screen.getByLabelText("Quantity"), "5");
  await user.type(screen.getByLabelText("Low-stock threshold"), "2");
  await user.click(screen.getByRole("button", { name: "Add product" }));

  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect((screen.getByLabelText("SKU") as HTMLInputElement).value).toBe(
    "SKU-A",
  );
  expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
    "Paper",
  );
});

it("[EX-4] the add-product flow works by keyboard alone", async () => {
  const user = userEvent.setup();
  const mockFetch = vi.mocked(fetch);
  mockFetch.mockResolvedValueOnce(jsonResponse([]));
  render(<App />);
  await waitFor(() => screen.getByText("No products yet."));

  mockFetch.mockResolvedValueOnce(
    jsonResponse(
      { sku: "SKU-A", name: "Paper", quantity: 5, lowStockThreshold: 2, lowStock: false },
      201,
    ),
  );

  await user.tab();
  expect(document.activeElement).toBe(screen.getByLabelText("SKU"));
  await user.keyboard("SKU-A");
  await user.tab();
  expect(document.activeElement).toBe(screen.getByLabelText("Name"));
  await user.keyboard("Paper");
  await user.tab();
  expect(document.activeElement).toBe(screen.getByLabelText("Quantity"));
  await user.keyboard("5");
  await user.tab();
  expect(document.activeElement).toBe(
    screen.getByLabelText("Low-stock threshold"),
  );
  await user.keyboard("2");
  await user.tab();
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Add product" }),
  );
  await user.keyboard("{Enter}");

  await waitFor(() => expect(screen.getByText("SKU-A")).toBeTruthy());
});

it("[EX-2] adjusting stock updates the row and announces success", async () => {
  const user = userEvent.setup();
  const mockFetch = vi.mocked(fetch);
  mockFetch.mockResolvedValueOnce(
    jsonResponse([
      { sku: "SKU-A", name: "Paper", quantity: 5, lowStockThreshold: 2, lowStock: false },
    ]),
  );
  render(<App />);
  await waitFor(() => screen.getByText("SKU-A"));

  await user.click(screen.getByRole("button", { name: "Adjust stock" }));

  mockFetch.mockResolvedValueOnce(
    jsonResponse(
      {
        adjustment: {
          id: "1",
          sku: "SKU-A",
          direction: "decrease",
          amount: 3,
          beforeQuantity: 5,
          afterQuantity: 2,
          reason: "sold",
          occurredAt: new Date().toISOString(),
        },
        product: { sku: "SKU-A", name: "Paper", quantity: 2, lowStockThreshold: 2, lowStock: true },
      },
      201,
    ),
  );

  await user.selectOptions(screen.getByLabelText("Direction"), "decrease");
  await user.type(screen.getByLabelText("Amount"), "3");
  await user.type(screen.getByLabelText("Reason"), "sold");
  await user.click(screen.getByRole("button", { name: "Save adjustment" }));

  await waitFor(() => expect(screen.getByText("Low stock")).toBeTruthy());
});

it("[EX-3] an adjustment failure keeps the typed values", async () => {
  const user = userEvent.setup();
  const mockFetch = vi.mocked(fetch);
  mockFetch.mockResolvedValueOnce(
    jsonResponse([
      { sku: "SKU-A", name: "Paper", quantity: 3, lowStockThreshold: 2, lowStock: false },
    ]),
  );
  render(<App />);
  await waitFor(() => screen.getByText("SKU-A"));

  await user.click(screen.getByRole("button", { name: "Adjust stock" }));

  mockFetch.mockResolvedValueOnce(
    jsonResponse({ error: "stock cannot go negative" }, 400),
  );

  await user.selectOptions(screen.getByLabelText("Direction"), "decrease");
  await user.type(screen.getByLabelText("Amount"), "4");
  await user.type(screen.getByLabelText("Reason"), "sold");
  await user.click(screen.getByRole("button", { name: "Save adjustment" }));

  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect((screen.getByLabelText("Amount") as HTMLInputElement).value).toBe(
    "4",
  );
  expect((screen.getByLabelText("Reason") as HTMLInputElement).value).toBe(
    "sold",
  );
});
