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

```bash
npm run build
npm start
```

`npm run dev` starts the Vite development server for the client.

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

- `src/server/`: a Node.js `http` API compiled by TypeScript.
- `src/client/`: a React interface built by Vite.
- `tests/`: Vitest tests (jsdom for the interface, Node for the API).

## Known limitations

This is the approved baseline only. Products, stock adjustments, history,
persistence and the interface states arrive with the confirmed Work Items.
