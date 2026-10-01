// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

it("[EX-3] tracks no test results and ignores Playwright output directories", async () => {
  const tracked = execFileSync("git", ["ls-files", "--", "test-results/"], {
    encoding: "utf8",
  });
  expect(tracked.split(/\r?\n/).filter((path) => path && existsSync(path))).toEqual([]);

  const ignore = await readFile(".gitignore", "utf8");
  expect(ignore.split(/\r?\n/)).toContain("test-results/");
  expect(ignore.split(/\r?\n/)).toContain("playwright-report/");
});
