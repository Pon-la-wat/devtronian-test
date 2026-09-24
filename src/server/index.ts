import { readFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { extname, join, normalize, sep } from "node:path";
import {
  adjustStock,
  createProduct,
  isLowStock,
  ValidationError,
  type Product,
} from "./inventory.js";
import { InventoryStore } from "./store.js";

export interface ProductView extends Product {
  lowStock: boolean;
}

function toView(product: Product): ProductView {
  return { ...product, lowStock: isLowStock(product) };
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ValidationError("request body must be valid JSON");
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function resolveStaticPath(staticRoot: string, pathname: string): string | null {
  const decoded = decodeURIComponent(pathname);
  const relativePath = decoded === "/" ? "index.html" : decoded.slice(1);
  const normalized = normalize(relativePath);
  if (normalized.startsWith(`..${sep}`) || normalized === "..") return null;
  return join(staticRoot, normalized);
}

async function serveStatic(
  request: IncomingMessage,
  response: ServerResponse,
  staticRoot: string,
  pathname: string,
): Promise<void> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    sendJson(response, 404, { error: "not_found" });
    return;
  }

  const resolvedPath = resolveStaticPath(staticRoot, pathname);
  if (!resolvedPath) {
    sendJson(response, 404, { error: "not_found" });
    return;
  }

  const filePath = extname(resolvedPath)
    ? resolvedPath
    : join(staticRoot, "index.html");

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "content-type": contentTypes[extname(filePath)] ??
        "application/octet-stream",
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch {
    sendJson(response, 404, { error: "not_found" });
  }
}

const ADJUSTMENTS_PATH = /^\/api\/products\/([^/]+)\/adjustments$/;

async function handle(
  request: IncomingMessage,
  response: ServerResponse,
  store: InventoryStore,
  staticRoot: string,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");
  const { pathname } = url;
  const method = request.method ?? "GET";

  if (method === "GET" && pathname === "/api/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (method === "GET" && pathname === "/api/products") {
    const products = await store.read((state) => state.products.map(toView));
    sendJson(response, 200, products);
    return;
  }

  if (method === "POST" && pathname === "/api/products") {
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const product = await store.mutate((state) =>
      createProduct(state, {
        sku: body.sku,
        name: body.name,
        quantity: body.quantity,
        lowStockThreshold: body.lowStockThreshold,
      }),
    );
    sendJson(response, 201, toView(product));
    return;
  }

  const adjustmentsMatch = pathname.match(ADJUSTMENTS_PATH);
  if (adjustmentsMatch) {
    const sku = decodeURIComponent(adjustmentsMatch[1]);

    if (method === "GET") {
      const history = await store.read((state) =>
        state.adjustments.filter((adjustment) => adjustment.sku === sku),
      );
      sendJson(response, 200, history);
      return;
    }

    if (method === "POST") {
      const body = (await readJsonBody(request)) as Record<string, unknown>;
      const result = await store.mutate((state) => {
        const adjustment = adjustStock(state, {
          sku,
          direction: body.direction,
          amount: body.amount,
          reason: body.reason,
        });
        const product = state.products.find((item) => item.sku === sku);
        if (!product) throw new ValidationError(`product ${sku} not found`);
        return { adjustment, product: toView(product) };
      });
      sendJson(response, 201, result);
      return;
    }
  }

  if (!pathname.startsWith("/api/")) {
    await serveStatic(request, response, staticRoot, pathname);
    return;
  }

  sendJson(response, 404, { error: "not_found" });
}

export function createInventoryServer(
  dataFilePath = "data/inventory.json",
  staticRoot = "dist/client",
): Server {
  const store = new InventoryStore(dataFilePath);

  return createServer((request, response) => {
    void handle(request, response, store, staticRoot).catch((error: unknown) => {
      if (error instanceof ValidationError) {
        sendJson(response, 400, { error: error.message });
        return;
      }
      sendJson(response, 500, { error: "internal_error" });
    });
  });
}
