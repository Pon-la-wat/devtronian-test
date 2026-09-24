import { createServer, type Server } from "node:http";

/** Baseline only: a health check. The Inventory API arrives with the
 * confirmed Work Items. */
export function createInventoryServer(): Server {
  return createServer((request, response) => {
    if (request.method === "GET" && request.url === "/api/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
  });
}
