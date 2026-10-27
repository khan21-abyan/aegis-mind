import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Event } from "./types.js";
import type { CheckpointLog } from "./checkpoint.js";

const MAX_HISTORY = 50;

const htmlPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "dashboard",
  "public",
  "index.html",
);

export interface DashboardOptions {
  log: CheckpointLog;
  port?: number;
}

export function createDashboard({ log, port = 4343 }: DashboardOptions): Server {
  let html: string;
  try {
    html = readFileSync(htmlPath, "utf8");
  } catch {
    html = "<!doctype html><html><head><title>AEGIS MIND</title></head><body><h1>AEGIS MIND</h1></body></html>";
  }

  // Eager: events appended before (or between) client connections are never lost.
  const history: Event[] = [];
  log.em.on("event", (ev: Event) => {
    history.push(ev);
    if (history.length > MAX_HISTORY) history.shift();
  });

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url === "/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(": aegis\n\n");
      for (const ev of [...history]) res.write(`data: ${JSON.stringify(ev)}\n\n`);
      const onEvent = (ev: Event) => {
        try {
          res.write(`data: ${JSON.stringify(ev)}\n\n`);
        } catch {
          // client gone mid-write; close handler cleans up
        }
      };
      log.em.on("event", onEvent);
      req.on("close", () => {
        log.em.removeListener("event", onEvent);
      });
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });

  server.listen(port);
  return server;
}
