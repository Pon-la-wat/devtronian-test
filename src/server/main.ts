import { createInventoryServer } from "./index.js";

const port = Number(process.env.PORT ?? "3000");
const dataFilePath = process.env.DATA_FILE ?? "data/inventory.json";
export const server = createInventoryServer(dataFilePath).listen(port, "127.0.0.1", () => {
  console.log(`Inventory app on http://127.0.0.1:${port}`);
});
