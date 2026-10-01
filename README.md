# Inventory MVP

A single-user, single-warehouse inventory web application: add and list
products, adjust stock with a reason, and see low-stock status. Built by
the Devtronian Platform pilot.

## Setup

Requires Node.js 22.22.2 or later.

```bash
npm ci
```

## Run

Two terminals: the API server, then the UI.

```bash
npm run build
npm start
```

```bash
npm run dev
```

`npm start` serves the API on `http://127.0.0.1:3000` and persists data to
`data/inventory.json` (override with `DATA_FILE` and `PORT`). `npm run dev`
serves the UI on Vite's dev server and proxies `/api` requests to the API
server, so both must be running together for the working application.

## Test

```bash
npm test
```

## Quality check

On a clean checkout:

```bash
npm ci
npm run lint
npm test
npm run build
```

## Architecture

- `src/server/inventory.ts`: the domain — product creation, stock
  adjustment and low-stock rules, independent of HTTP or storage.
- `src/server/store.ts`: an atomic file-backed store. Every mutation runs
  through a single serialized writer queue, and each commit is a temp-file
  write followed by a rename, so products and their adjustment history
  survive a restart intact.
- `src/server/index.ts`: the HTTP API (`/api/products`,
  `/api/products/:sku/adjustments`) wiring the domain to the store.
- `src/client/`: a React interface (list, add-product form, per-row
  adjust-stock form) with empty, loading, validation, success and failure
  states, built by Vite.
- `tests/`: Vitest tests — `inventory.test.ts` for domain rules,
  `api.test.ts` for the HTTP API and restart durability, `app.test.tsx` for
  the interface, `health.test.ts` for the baseline health check.

## Known limitations

Single user, single warehouse, no authentication. No product deletion,
import/export or production deployment. No multiple warehouses, transfers,
purchase orders, suppliers, barcodes, prices, tax or accounting.
