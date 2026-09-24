// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

it("[EX-5] ignores generated Playwright results and reports", async () => {
  const ignore = await readFile(".gitignore", "utf8");
  expect(ignore.split(/\r?\n/)).toContain("test-results/");
  expect(ignore.split(/\r?\n/)).toContain("playwright-report/");
});
