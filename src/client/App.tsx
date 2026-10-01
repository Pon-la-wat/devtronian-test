import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Adjustment } from "../server/inventory.js";
import type { ProductView } from "../server/index.js";

interface AdjustmentResult {
  adjustment: Adjustment;
  product: ProductView;
}

async function parseJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

function AddProductForm({
  onCreated,
}: {
  onCreated: (product: ProductView) => void;
}) {
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sku,
          name,
          quantity: quantity.trim() === "" ? null : Number(quantity),
          lowStockThreshold: lowStockThreshold.trim() === "" ? null : Number(lowStockThreshold),
        }),
      });
      const body = await parseJson(response);
      if (!response.ok) {
        setStatus("error");
        setError((body.error as string) ?? "Could not add the product.");
        return;
      }
      setStatus("idle");
      setSku("");
      setName("");
      setQuantity("");
      setLowStockThreshold("");
      onCreated(body as unknown as ProductView);
    } catch {
      setStatus("error");
      setError("Could not reach the server. Try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Add product">
      <h2>Add product</h2>
      <label htmlFor="sku">SKU</label>
      <input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} />

      <label htmlFor="name">Name</label>
      <input
        id="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <label htmlFor="quantity">Quantity</label>
      <input
        id="quantity"
        type="number"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
      />

      <label htmlFor="lowStockThreshold">Low-stock threshold</label>
      <input
        id="lowStockThreshold"
        type="number"
        value={lowStockThreshold}
        onChange={(e) => setLowStockThreshold(e.target.value)}
      />

      <button type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Adding…" : "Add product"}
      </button>
      {status === "error" && error ? <p role="alert">{error}</p> : null}
    </form>
  );
}

function AdjustStockForm({
  sku,
  onAdjusted,
  onCancel,
}: {
  sku: string;
  onAdjusted: (result: AdjustmentResult) => void;
  onCancel: () => void;
}) {
  const [direction, setDirection] = useState<"increase" | "decrease">(
    "increase",
  );
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      const response = await fetch(
        `/api/products/${encodeURIComponent(sku)}/adjustments`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ direction, amount: Number(amount), reason }),
        },
      );
      const body = await parseJson(response);
      if (!response.ok) {
        setStatus("error");
        setError((body.error as string) ?? "Could not adjust stock.");
        return;
      }
      onAdjusted(body as unknown as AdjustmentResult);
    } catch {
      setStatus("error");
      setError("Could not reach the server. Try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label={`Adjust stock for ${sku}`}>
      <label htmlFor={`direction-${sku}`}>Direction</label>
      <select
        id={`direction-${sku}`}
        value={direction}
        onChange={(e) =>
          setDirection(e.target.value as "increase" | "decrease")
        }
      >
        <option value="increase">Increase</option>
        <option value="decrease">Decrease</option>
      </select>

      <label htmlFor={`amount-${sku}`}>Amount</label>
      <input
        id={`amount-${sku}`}
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <label htmlFor={`reason-${sku}`}>Reason</label>
      <input
        id={`reason-${sku}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />

      <button type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Saving…" : "Save adjustment"}
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
      {status === "error" && error ? <p role="alert">{error}</p> : null}
    </form>
  );
}

function ProductRow({
  product,
  onAdjusted,
}: {
  product: ProductView;
  onAdjusted: (result: AdjustmentResult) => void;
}) {
  const [adjusting, setAdjusting] = useState(false);

  return (
    <>
      <tr>
        <td>{product.sku}</td>
        <td>{product.name}</td>
        <td>{product.quantity}</td>
        <td>{product.lowStockThreshold}</td>
        <td>{product.lowStock ? "Low stock" : "OK"}</td>
        <td>
          {adjusting ? null : (
            <button type="button" onClick={() => setAdjusting(true)}>
              Adjust stock
            </button>
          )}
        </td>
      </tr>
      {adjusting ? (
        <tr>
          <td colSpan={6}>
            <AdjustStockForm
              sku={product.sku}
              onAdjusted={(result) => {
                setAdjusting(false);
                onAdjusted(result);
              }}
              onCancel={() => setAdjusting(false)}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function App() {
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  const [products, setProducts] = useState<ProductView[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoadState("loading");
    setLoadError(null);
    try {
      const response = await fetch("/api/products");
      if (!response.ok) throw new Error("failed to load products");
      const body = (await response.json()) as ProductView[];
      setProducts((previous) => {
        const merged = new Map(body.map((product) => [product.sku, product]));
        for (const product of previous) {
          if (!merged.has(product.sku)) merged.set(product.sku, product);
        }
        return [...merged.values()];
      });
      setLoadState("loaded");
    } catch {
      setLoadState("error");
      setLoadError("Could not load products. Try again.");
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  return (
    <main>
      <h1>Inventory</h1>
      <div aria-live="polite">{announcement}</div>

      <AddProductForm
        onCreated={(product) => {
          setProducts((previous) => [
            ...previous.filter((item) => item.sku !== product.sku),
            product,
          ]);
          setAnnouncement(`Added ${product.sku}.`);
        }}
      />

      {loadState === "loading" ? <p>Loading products…</p> : null}

      {loadState === "error" ? (
        <div role="alert">
          <p>{loadError}</p>
          <button type="button" onClick={() => void loadProducts()}>
            Retry
          </button>
        </div>
      ) : null}

      {loadState === "loaded" && products.length === 0 ? (
        <p>No products yet.</p>
      ) : null}

      {loadState === "loaded" && products.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Name</th>
              <th>Quantity</th>
              <th>Threshold</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <ProductRow
                key={product.sku}
                product={product}
                onAdjusted={(result) => {
                  setProducts((previous) =>
                    previous.map((item) =>
                      item.sku === result.product.sku ? result.product : item,
                    ),
                  );
                  setAnnouncement(
                    `${result.product.sku} is now ${result.product.quantity}.`,
                  );
                }}
              />
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
