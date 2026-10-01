import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npm run build && node dist/server/main.js",
    env: {
      DATA_FILE: join(tmpdir(), `inventory-e2e-${randomUUID()}.json`),
      PORT: "4173",
    },
    port: 4173,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
