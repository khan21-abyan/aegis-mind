#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CheckpointLog, createDashboard, createProxy, Heal, Kernel } from "@aegis-mind/core";
import type { Event } from "@aegis-mind/core";
import { AEGIS_LICENSE_PUBLIC_KEY } from "./keys.js";
import { parseLicense } from "./license.js";
import { CliError, parseArgs, USAGE } from "./args.js";
import type { Args } from "./args.js";

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
