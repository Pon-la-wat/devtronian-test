import { rm } from "node:fs/promises";
import { createInventoryServer } from "./index.js";

const port = Number(process.env.PORT ?? "3000");
const dataFilePath = process.env.DATA_FILE ?? "data/inventory.json";
if (process.env.CLEAR_DATA_ON_START === "1") {
  await rm(dataFilePath, { force: true });
}
createInventoryServer(dataFilePath).listen(port, "127.0.0.1", () => {
  console.log(`Inventory app on http://127.0.0.1:${port}`);
});
