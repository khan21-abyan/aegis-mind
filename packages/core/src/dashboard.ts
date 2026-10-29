import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Event } from "./types.js";
import type { CheckpointLog } from "./checkpoint.js";

const MAX_HISTORY = 50;
const PING_INTERVAL_MS = 25_000;

interface Client {
  res: ServerResponse;
  blocked: boolean;
}

const htmlPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "index.html",
);

export interface DashboardOptions {
  log: CheckpointLog;
  port?: number;
}

function send(client: Client, frame: string): void {
  // Backpressure guard: if the socket buffer is full (write returns false),
  // drop frames for this slow client instead of queueing unbounded memory —
  // a live telemetry feed is allowed to lose frames. Downstream traffic
  // resumes after "drain".
  if (client.blocked) return;
  if (client.res.write(frame) === false) {
    client.blocked = true;
    client.res.once("drain", () => {
      client.blocked = false;
    });
  }
}

export function createDashboard({ log, port = 4343 }: DashboardOptions): Server {
  let html: string;
  try {
    html = readFileSync(htmlPath, "utf8");
  } catch {
    html = "<!doctype html><html><head><title>AEGIS MIND</title></head><body><h1>AEGIS MIND</h1></body></html>";
  }

  // Eager: events appended before (or between) client connections are never
  // lost. Removed once the server closes to avoid listener accumulation
  // across repeated create/close cycles on the same long-lived log.em.
  const history: Event[] = [];
  const onHistory = (ev: Event) => {
    history.push(ev);
    if (history.length > MAX_HISTORY) history.shift();
  };
  log.em.on("event", onHistory);

  const clients = new Set<Client>();
  const ping = setInterval(() => {
    for (const client of [...clients]) send(client, ": ping\n\n");
  }, PING_INTERVAL_MS);
  ping.unref();

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url === "/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      const client: Client = { res, blocked: false };
      clients.add(client);
      send(client, ": aegis\n\n");
      for (const ev of [...history]) send(client, `data: ${JSON.stringify(ev)}\n\n`);
      const onEvent = (ev: Event) => {
        send(client, `data: ${JSON.stringify(ev)}\n\n`);
      };
      log.em.on("event", onEvent);
      req.on("close", () => {
        log.em.removeListener("event", onEvent);
        clients.delete(client);
      });
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });

  server.on("close", () => {
    clearInterval(ping);
    log.em.removeListener("event", onHistory);
  });

  // Loopback-only bind: the dashboard streams run telemetry to localhost,
  // so it must never be reachable from the LAN (default was all interfaces).
  server.listen(port, "127.0.0.1");
  return server;
}
