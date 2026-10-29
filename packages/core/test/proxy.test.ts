import { describe, it, expect, afterAll, afterEach } from "vitest";
import { createProxy } from "../src/proxy.js";
import { Kernel } from "../src/kernel.js";
import { Heal } from "../src/healing.js";
import { CheckpointLog } from "../src/checkpoint.js";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import { once } from "node:events";

const stub = http
  .createServer((_, res) => {
    res.setHeader("content-type", "application/json");
    res.end('{"ok":true}');
  })
  .listen(0);
const stubPort = (stub.address() as import("node:net").AddressInfo).port;

const dir = mkdtempSync(join(tmpdir(), "aegis-proxy-"));
const log = CheckpointLog.open(dir);

afterAll(() => {
  stub.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("proxy", () => {
  const proxies: http.Server[] = [];
  const launchProxy = (kernel: Kernel, upstream?: string): string => {
    const p = createProxy({
      upstream: upstream ?? `http://127.0.0.1:${stubPort}`,
      kernel,
      heal: new Heal({ failovers: [] }),
      log,
      beacon: [],
    });
    p.listen(0);
    proxies.push(p);
    return `http://127.0.0.1:${(p.address() as import("node:net").AddressInfo).port}/v1/chat/completions`;
  };

  afterEach(async () => {
    for (const p of proxies.splice(0)) await new Promise<void>((r) => p.close(() => r()));
  });

  const post = (url: string, body: Record<string, unknown>) =>
    fetch(url, { method: "POST", body: JSON.stringify(body) });

  it("surfaces an https upstream failure as 502 model_error instead of crashing (https transport selected)", async () => {
    const url = launchProxy(new Kernel({ budgetCap: 0.002 }), "https://127.0.0.1:9");
    const out = await post(url, { messages: [{ role: "user", content: "hi" }] });
    expect(out.status).toBe(502);
    const body = (await out.json()) as { error: { code: string } };
    expect(body.error.code).toBe("model_error");
    const next = await post(url, { messages: [{ role: "user", content: "retry" }] });
    expect(next.status).toBe(429);
    expect((await next.json()).error.code).toBe("budget_exhausted");
  });

  it("halts blocked turns with 429 budget_exhausted error shape", async () => {
    const url = launchProxy(new Kernel({ budgetCap: 0 }));
    const out = await post(url, { messages: [{ role: "user", content: "hi" }] });
    expect(out.status).toBe(429);
    const body = (await out.json()) as { error: { code: string; message: string } };
    expect(body).toEqual({
      error: { code: "budget_exhausted", message: expect.any(String) },
    });
  });

  it("passes allowed traffic through to the upstream verbatim", async () => {
    const url = launchProxy(new Kernel({ budgetCap: 100 }));
    const out = await post(url, { messages: [{ role: "user", content: "hi" }] });
    expect(out.status).toBe(200);
    expect(await out.text()).toBe('{"ok":true}');
    const lines = readFileSync(join(dir, ".aegis", "events.jsonl"), "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { type: string });
    expect(lines.some((e) => e.type === "call_fwd")).toBe(true);
    expect(lines.some((e) => e.type === "call_returned")).toBe(true);
  });

  it("halts a non-budget shutdown with 429 + code halted", async () => {
    const url = launchProxy(new Kernel({ budgetCap: 100, maxTurns: 1 }));
    await post(url, { messages: [{ role: "user", content: "hi" }] });
    const out = await post(url, { messages: [{ role: "user", content: "again" }] });
    expect(out.status).toBe(429);
    const body = (await out.json()) as { error: { code: string; message: string } };
    expect(body).toEqual({
      error: { code: "halted", message: expect.any(String) },
    });
  });

  it("blocks an identical-payload loop after loopWindow turns with 409 loop_detected", async () => {
    const url = launchProxy(new Kernel({ budgetCap: 100, loopWindow: 3 }));
    const body = { messages: [{ role: "user", content: "same" }] };
    for (let i = 0; i < 3; i++) {
      const ok = await post(url, body);
      expect(ok.status).toBe(200);
    }
    const out = await post(url, body);
    expect(out.status).toBe(409);
    const res = (await out.json()) as { error: { code: string; message: string } };
    expect(res).toEqual({
      error: { code: "loop_detected", message: expect.any(String) },
    });
  });

  it("does not treat long requests with the same 2 KiB prefix as identical", async () => {
    const url = launchProxy(new Kernel({ budgetCap: 100, loopWindow: 2 }));
    const prefix = "x".repeat(2048);
    const first = await fetch(url, { method: "POST", body: `${prefix}A` });
    const second = await fetch(url, { method: "POST", body: `${prefix}B` });
    const third = await fetch(url, { method: "POST", body: "a different request" });
    expect([first.status, second.status, third.status]).toEqual([200, 200, 200]);
  });

  it("reserves budget before forwarding concurrent requests", async () => {
    const slow = http.createServer((_req, res) => {
      setTimeout(() => res.end('{"ok":true}'), 60);
    });
    slow.listen(0, "127.0.0.1");
    await once(slow, "listening");
    const slowPort = (slow.address() as import("node:net").AddressInfo).port;
    const url = launchProxy(new Kernel({ budgetCap: 0.001 }), `http://127.0.0.1:${slowPort}`);
    try {
      const results = await Promise.all([post(url, { prompt: "first" }), post(url, { prompt: "second" })]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 429]);
    } finally {
      slow.closeAllConnections();
      slow.close();
      await once(slow, "close");
    }
  });

  it("rejects a request body above the configured limit without forwarding", async () => {
    const p = createProxy({
      upstream: `http://127.0.0.1:${stubPort}`,
      kernel: new Kernel({ budgetCap: 100 }),
      heal: new Heal({ failovers: [] }),
      log,
      beacon: [],
      maxRequestBytes: 16,
    });
    p.listen(0, "127.0.0.1");
    await once(p, "listening");
    proxies.push(p);
    const address = p.address() as import("node:net").AddressInfo;
    const result = await fetch(`http://127.0.0.1:${address.port}/v1/chat/completions`, {
      method: "POST",
      body: "x".repeat(17),
    });
    expect(result.status).toBe(413);
  });

  it("does not append a JSON error object after an upstream streaming response has begun", async () => {
    const broken = http.createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write("data: partial\n\n");
      setTimeout(() => res.socket?.destroy(), 15);
    });
    broken.listen(0, "127.0.0.1");
    await once(broken, "listening");
    const brokenPort = (broken.address() as import("node:net").AddressInfo).port;
    const url = launchProxy(new Kernel({ budgetCap: 100 }), `http://127.0.0.1:${brokenPort}`);
    try {
      const response = await new Promise<string>((resolve, reject) => {
        http.get(url, (res) => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk: string) => (body += chunk));
          res.on("end", () => resolve(body));
          res.on("error", (error) => reject(error));
        }).on("error", reject);
      });
      expect(response).toContain("data: partial");
      expect(response).not.toContain("upstream failed");
      expect(response).not.toContain('"error"');
    } catch (error) {
      // An interrupted upstream stream may legitimately terminate with a socket error;
      // it must not be converted into a JSON fragment appended to the stream.
      expect(String(error)).not.toContain("model_error");
    } finally {
      broken.closeAllConnections();
      broken.close();
      await once(broken, "close");
    }
  });

  it("strips hop-by-hop headers and headers nominated by Connection", async () => {
    const hop = http.createServer((req, res) => {
      res.writeHead(200, {
        "content-type": "application/json",
        connection: "keep-alive, x-upstream-private",
        "x-upstream-private": "secret-response-header",
      });
      res.end(JSON.stringify({ forwardedPrivateHeader: req.headers["x-client-private"] ?? null }));
    });
    hop.listen(0, "127.0.0.1");
    await once(hop, "listening");
    const hopPort = (hop.address() as import("node:net").AddressInfo).port;
    const url = launchProxy(new Kernel({ budgetCap: 100 }), `http://127.0.0.1:${hopPort}`);
    try {
      const result = await new Promise<{ headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
        const request = http.request(url, {
          method: "POST",
          headers: { connection: "keep-alive, x-client-private", "x-client-private": "secret-request-header" },
        }, (response) => {
          let body = "";
          response.setEncoding("utf8");
          response.on("data", (chunk: string) => (body += chunk));
          response.on("end", () => resolve({ headers: response.headers, body }));
          response.on("error", reject);
        });
        request.on("error", reject);
        request.end("{}") ;
      });
      expect(JSON.parse(result.body)).toEqual({ forwardedPrivateHeader: null });
      expect(result.headers["x-upstream-private"]).toBeUndefined();
      // Node may add its own downstream Connection header, but upstream-nominated
      // headers must not leak through it.
      expect(result.headers.connection).not.toContain("x-upstream-private");
    } finally {
      hop.closeAllConnections();
      hop.close();
      await once(hop, "close");
    }
  });

  it("retries one upstream 503 on the same model and returns the recovery response", async () => {
    let attempts = 0;
    const retryUpstream = http.createServer((_req, res) => {
      attempts += 1;
      if (attempts === 1) {
        res.writeHead(503, { "content-type": "application/json" });
        res.end('{"error":"temporary"}');
      } else {
        res.writeHead(200, { "content-type": "application/json" });
        res.end('{"ok":true}');
      }
    });
    retryUpstream.listen(0, "127.0.0.1");
    await once(retryUpstream, "listening");
    const upstreamPort = (retryUpstream.address() as import("node:net").AddressInfo).port;
    const url = launchProxy(new Kernel({ budgetCap: 1 }), `http://127.0.0.1:${upstreamPort}`);
    try {
      const response = await post(url, { model: "primary", prompt: "retry me" });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
      expect(attempts).toBe(2);
    } finally {
      retryUpstream.closeAllConnections();
      retryUpstream.close();
      await once(retryUpstream, "close");
    }
  });

  it("honors an upstream Retry-After header for 429 responses", async () => {
    let attempts = 0;
    const rateLimited = http.createServer((_req, res) => {
      attempts += 1;
      if (attempts === 1) {
        res.writeHead(429, { "content-type": "application/json", "retry-after": "0" });
        res.end('{"error":"rate limited"}');
      } else {
        res.writeHead(200, { "content-type": "application/json" });
        res.end('{"ok":true}');
      }
    });
    rateLimited.listen(0, "127.0.0.1");
    await once(rateLimited, "listening");
    const upstreamPort = (rateLimited.address() as import("node:net").AddressInfo).port;
    const url = launchProxy(new Kernel({ budgetCap: 1 }), `http://127.0.0.1:${upstreamPort}`);
    try {
      const started = Date.now();
      const response = await post(url, { model: "primary" });
      expect(response.status).toBe(200);
      expect(attempts).toBe(2);
      expect(Date.now() - started).toBeLessThan(1000);
    } finally {
      rateLimited.closeAllConnections();
      rateLimited.close();
      await once(rateLimited, "close");
    }
  });

  it("tries configured failover models in order after the primary retry fails", async () => {
    const models: string[] = [];
    const failoverUpstream = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { model: string };
        models.push(body.model);
        if (body.model !== "backup-2") {
          res.writeHead(503, { "content-type": "application/json" });
          res.end('{"error":"temporary"}');
        } else {
          res.writeHead(200, { "content-type": "application/json" });
          res.end('{"model":"backup-2"}');
        }
      });
    });
    failoverUpstream.listen(0, "127.0.0.1");
    await once(failoverUpstream, "listening");
    const upstreamPort = (failoverUpstream.address() as import("node:net").AddressInfo).port;
    const p = createProxy({
      upstream: `http://127.0.0.1:${upstreamPort}`,
      kernel: new Kernel({ budgetCap: 1 }),
      heal: new Heal({ failovers: ["backup-1", "backup-2"] }),
      log,
      beacon: [],
    });
    p.listen(0, "127.0.0.1");
    await once(p, "listening");
    proxies.push(p);
    const address = p.address() as import("node:net").AddressInfo;
    try {
      const response = await post(`http://127.0.0.1:${address.port}/v1/chat/completions`, { model: "primary", prompt: "switch" });
      expect(response.status).toBe(200);
      expect(models).toEqual(["primary", "primary", "backup-1", "backup-2"]);
      expect(await response.json()).toEqual({ model: "backup-2" });
    } finally {
      failoverUpstream.closeAllConnections();
      failoverUpstream.close();
      await once(failoverUpstream, "close");
    }
  });

  it("does not retry ordinary client errors", async () => {
    let attempts = 0;
    const clientErrorUpstream = http.createServer((_req, res) => {
      attempts += 1;
      res.writeHead(400, { "content-type": "application/json" });
      res.end('{"error":"bad request"}');
    });
    clientErrorUpstream.listen(0, "127.0.0.1");
    await once(clientErrorUpstream, "listening");
    const upstreamPort = (clientErrorUpstream.address() as import("node:net").AddressInfo).port;
    const p = createProxy({
      upstream: `http://127.0.0.1:${upstreamPort}`,
      kernel: new Kernel({ budgetCap: 1 }),
      heal: new Heal({ failovers: ["backup"] }),
      log,
      beacon: [],
    });
    p.listen(0, "127.0.0.1");
    await once(p, "listening");
    proxies.push(p);
    try {
      const address = p.address() as import("node:net").AddressInfo;
      const response = await post(`http://127.0.0.1:${address.port}/v1/chat/completions`, { model: "primary" });
      expect(response.status).toBe(400);
      expect(attempts).toBe(1);
    } finally {
      clientErrorUpstream.closeAllConnections();
      clientErrorUpstream.close();
      await once(clientErrorUpstream, "close");
    }
  });

  it("uses the reserved budget for each retry and stops before overspending", async () => {
    let attempts = 0;
    const costly = http.createServer((_req, res) => {
      attempts += 1;
      res.writeHead(503, { "content-type": "application/json" });
      res.end('{"error":"temporary"}');
    });
    costly.listen(0, "127.0.0.1");
    await once(costly, "listening");
    const upstreamPort = (costly.address() as import("node:net").AddressInfo).port;
    const p = createProxy({
      upstream: `http://127.0.0.1:${upstreamPort}`,
      kernel: new Kernel({ budgetCap: 0.001 }),
      heal: new Heal({ failovers: ["backup"] }),
      log,
      beacon: [],
    });
    p.listen(0, "127.0.0.1");
    await once(p, "listening");
    proxies.push(p);
    try {
      const address = p.address() as import("node:net").AddressInfo;
      const response = await post(`http://127.0.0.1:${address.port}/v1/chat/completions`, { model: "primary" });
      expect(response.status).toBe(429);
      expect((await response.json()).error.code).toBe("budget_exhausted");
      expect(attempts).toBe(1);
    } finally {
      costly.closeAllConnections();
      costly.close();
      await once(costly, "close");
    }
  });
});
