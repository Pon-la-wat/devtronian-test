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
      CLEAR_DATA_ON_START: "1",
      DATA_FILE: "data/e2e-inventory.json",
      PORT: "4173",
    },
    port: 4173,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
