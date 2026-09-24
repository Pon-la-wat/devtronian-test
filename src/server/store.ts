import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { emptyInventoryState, type InventoryState } from "./inventory.js";

/** One writer queue per store serializes mutations; each commit is a
 * temp-file write followed by a rename, so a crash never leaves a
 * half-written file on disk. */
export class InventoryStore {
  private state: InventoryState = emptyInventoryState();
  private queue: Promise<unknown> = Promise.resolve();
  private readonly loaded: Promise<void>;

  constructor(private readonly filePath: string) {
    this.loaded = this.load();
  }

  private async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      this.state = JSON.parse(raw) as InventoryState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      this.state = emptyInventoryState();
    }
  }

  async read<T>(fn: (state: InventoryState) => T): Promise<T> {
    await this.loaded;
    return this.enqueue(() => fn(this.state));
  }

  async mutate<T>(fn: (state: InventoryState) => T): Promise<T> {
    await this.loaded;
    return this.enqueue(async () => {
      const draft = structuredClone(this.state);
      const result = fn(draft);
      await this.persist(draft);
      this.state = draft;
      return result;
    });
  }

  private enqueue<T>(task: () => T | Promise<T>): Promise<T> {
    const result = this.queue.then(task);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async persist(state: InventoryState): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${randomUUID()}.tmp`;
    await writeFile(tempPath, JSON.stringify(state, null, 2), "utf8");
    await rename(tempPath, this.filePath);
  }
}
