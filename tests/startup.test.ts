// @vitest-environment node
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

it("[EX-4] startup preserves inventory data even when the old clear flag is set", async () => {
  const dir = await mkdtemp(join(tmpdir(), "inventory-startup-"));
  const dataFilePath = join(dir, "inventory.json");
  const savedData = '{"products":[{"sku":"SKU-A","name":"Paper","quantity":5,"lowStockThreshold":2}],"adjustments":[]}';
  const previousDataFile = process.env.DATA_FILE;
  const previousPort = process.env.PORT;
  const previousClearFlag = process.env.CLEAR_DATA_ON_START;

  try {
    await writeFile(dataFilePath, savedData);
    process.env.DATA_FILE = dataFilePath;
    process.env.PORT = "0";
    process.env.CLEAR_DATA_ON_START = "1";

    const { server } = await import("../src/server/main.js");
    try {
      if (!server.listening) await once(server, "listening");
      expect(await readFile(dataFilePath, "utf8")).toBe(savedData);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  } finally {
    if (previousDataFile === undefined) delete process.env.DATA_FILE;
    else process.env.DATA_FILE = previousDataFile;
    if (previousPort === undefined) delete process.env.PORT;
    else process.env.PORT = previousPort;
    if (previousClearFlag === undefined) delete process.env.CLEAR_DATA_ON_START;
    else process.env.CLEAR_DATA_ON_START = previousClearFlag;
    await rm(dir, { recursive: true, force: true });
  }
});
