#!/usr/bin/env node
import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CheckpointLog, createDashboard, createProxy, Heal, Kernel } from "../../core/src/index.js";
import type { Event } from "../../core/src/index.js";
import { AEGIS_LICENSE_PUBLIC_KEY } from "./keys.js";
import { parseLicense } from "./license.js";

interface Args {
  port: number;
  dash: number;
  upstream: string;
}

const parseArgs = (argv: string[]): Args => {
  const out: Args = { port: 4242, dash: 4343, upstream: "https://api.openai.com" };
  for (let i = 0; i < argv.length; i++) {
    const next = (): string => {
      const v = argv[i + 1];
      if (v === undefined) throw new Error(`missing value for ${String(argv[i])}`);
      i += 1;
      return v;
    };
    if (argv[i] === "--port") out.port = Number(next());
    else if (argv[i] === "--dash") out.dash = Number(next());
    else if (argv[i] === "--upstream") out.upstream = next();
  }
  return out;
};

const detectPro = (): boolean => {
  const p = join(process.cwd(), ".aegis", "license.txt");
  if (!existsSync(p)) return false;
  try {
    return parseLicense(readFileSync(p, "utf8"), AEGIS_LICENSE_PUBLIC_KEY)?.scope === "pro";
  } catch {
    return false;
  }
};

const main = (): void => {
  const args = parseArgs(process.argv.slice(2));
  const pro = detectPro();

  const budgetEnv = process.env["AEGIS_BUDGET"];
  const budgetCap = budgetEnv !== undefined && budgetEnv !== "" && Number.isFinite(Number(budgetEnv)) ? Number(budgetEnv) : Infinity;
  const failovers =
    pro && process.env["AEGIS_FAILOVERS"] !== undefined && process.env["AEGIS_FAILOVERS"] !== ""
      ? process.env["AEGIS_FAILOVERS"].split(",").map((s) => s.trim()).filter((s) => s.length > 0)
      : [];

  const log = CheckpointLog.open();
  const kernel = new Kernel({ budgetCap, loopWindow: 8 });
  const heal = new Heal({ failovers });

  const banner = [
    "",
    "  █████╗ ███████╗ ██████╗ ██╗███████╗    ███╗   ███╗██╗███╗   ██╗██████╗ ",
    " ██╔══██╗██╔════╝██╔════╝ ██║██╔════╝    ████╗ ████║██║████╗  ██║██╔══██╗",
    " ███████║█████╗  ██║  ███╗██║███████╗    ██╔████╔██║██║██╔██╗ ██║██║  ██║",
    " ██╔══██║██╔══╝  ██║   ██║██║╚════██║    ██║╚██╔╝██║██║██║╚██╗██║██║  ██║",
    " ██║  ██║███████╗╚██████╔╝██║███████║    ██║ ╚═╝ ██║██║██║ ╚████║██████╔╝",
    " ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝╚══════╝    ╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═════╝ ",
    "",
    `  proxy  http://localhost:${args.port}  →  ${args.upstream}`,
    `  dash   http://localhost:${args.dash}`,
    `  mode   ${pro ? "PRO (failovers enabled)" : "free (core governance only)"}`,
    "",
  ].join("\n");
  console.log(banner);

  const start: Event = {
    type: "run_started",
    ts: Date.now(),
    run: "cli",
    detail: { mode: pro ? "pro" : "free", upstream: args.upstream },
  };
  log.append(start);

  const proxy = createProxy({ upstream: args.upstream, kernel, heal, log, beacon: [] });
  const dash = createDashboard({ log, port: args.dash });
  proxy.listen(args.port);

  console.log("AEGIS MIND online. Ctrl+C to stop.");
  let closing = false;
  const shutdown = (): void => {
    if (closing) return;
    closing = true;
    console.log("\nShutting down…");
    dash.close();
    proxy.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

main();
