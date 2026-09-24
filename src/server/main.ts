import { createInventoryServer } from "./index.js";

const port = Number(process.env.PORT ?? "3000");
createInventoryServer().listen(port, "127.0.0.1", () => {
  console.log(`Inventory API on http://127.0.0.1:${port}`);
});
