export interface Args {
  port: number;
  dash: number;
  upstream: string;
}

export const USAGE = `Usage: aegis-mind [--port <1-65535>] [--dash <1-65535>] [--upstream <url>]

Env:
  AEGIS_BUDGET      spend cap (default: unlimited)
  AEGIS_FAILOVERS   comma-separated failover models (Pro license required)
  AEGIS_LICENSE     path to license file (default: ./.aegis/license.txt)`;

const isPort = (v: string): boolean => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 65535;
};

export class CliError extends Error {}

export const parseArgs = (argv: string[]): Args => {
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
      const v = next();
      let url: URL;
      try {
        url = new URL(v);
      } catch {
        throw new CliError(`--upstream expects an http: or https: URL, got "${v}"`);
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new CliError(`--upstream expects an http: or https: URL, got "${v}"`);
      }
      out.upstream = v;
    } else {
      console.warn(`aegis-mind: warning: unknown flag ${flag} — ignored`);
    }
  }
  return out;
};
