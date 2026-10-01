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
npm run e2e
```

`npm test` runs the Vitest unit and API tests. `npm run e2e` builds and starts
an isolated local server, then runs the keyboard flow in Playwright Chromium.

## Quality check

On a clean checkout with the npm packages and Playwright Chromium available
offline:

```bash
npm ci
npm test
npm run lint
npm run build
npm run e2e
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
- `tests/`: Vitest tests for domain rules, API durability, interface behavior,
  generated-file ignores and README guidance.
- `e2e/`: Playwright keyboard flows and accessibility checks.

## Known limitations

The app supports one user and one warehouse, with no authentication. It does
not support product deletion, import/export, multiple warehouses, transfers,
purchase orders, suppliers, barcodes, prices, tax, accounting or production
deployment.
