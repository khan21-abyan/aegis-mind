#!/usr/bin/env node
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

const USAGE = `Usage: aegis-mind [--port <1-65535>] [--dash <1-65535>] [--upstream <url>]

Env:
  AEGIS_BUDGET      spend cap (default: unlimited)
  AEGIS_FAILOVERS   comma-separated failover models (Pro license required)
  AEGIS_LICENSE     path to license file (default: ./.aegis/license.txt)`;

const isPort = (v: string): boolean => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 65535;
};

class CliError extends Error {}

const parseArgs = (argv: string[]): Args => {
  const out: Args = { port: 4242, dash: 4343, upstream: "https://api.openai.com" };
  for (let i = 0; i < argv.length; i++) {
    const flag = String(argv[i]);
    const next = (): string => {
      const v = argv[i + 1];
      if (v === undefined) throw new CliError(`missing value for ${flag}`);
      i += 1;
      return v;
    };
    if (flag === "--port" || flag === "--dash") {
      const v = next();
      if (!isPort(v)) throw new CliError(`${flag} expects an integer between 1 and 65535, got "${v}"`);
      if (flag === "--port") out.port = Number(v);
      else out.dash = Number(v);
    } else if (flag === "--upstream") {
      out.upstream = next();
    } else {
      console.warn(`aegis-mind: warning: unknown flag ${flag} — ignored`);
    }
  }
  return out;
};

const licensePath = (): string => {
  const env = process.env["AEGIS_LICENSE"];
  if (env !== undefined && env !== "") return env;
  return join(process.cwd(), ".aegis", "license.txt");
};

const detectPro = (): boolean => {
  const p = licensePath();
  if (!existsSync(p)) return false;
  try {
    return parseLicense(readFileSync(p, "utf8"), AEGIS_LICENSE_PUBLIC_KEY)?.scope === "pro";
  } catch {
    return false;
  }
};

const main = (): void => {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`aegis-mind: ${e instanceof Error ? e.message : String(e)}`);
    console.error(USAGE);
    process.exit(1);
  }
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
    "  Ctrl+C to stop. Full usage: --help flags documented in README.",
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
