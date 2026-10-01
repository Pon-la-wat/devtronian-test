// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

it("[EX-4] documents e2e in Test and Quality and keeps known limitations current", async () => {
  const readme = await readFile("README.md", "utf8");
  const section = (heading: string) => {
    const text = readme.split(/^## /m).find((part) => part.startsWith(`${heading}\n`));
    expect(text, `missing ${heading} section`).toBeDefined();
    return text!;
  };

  expect(section("Test")).toContain("npm run e2e");
  expect(section("Quality check")).toContain("npm run e2e");
  const limitations = section("Known limitations");
  expect(limitations).not.toMatch(/\bL[12]\b/);
  expect(limitations).toContain("one user and one warehouse");
});
