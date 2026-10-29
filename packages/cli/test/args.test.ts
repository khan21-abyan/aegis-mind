import { describe, it, expect } from "vitest";
import { isHelpRequest, parseArgs, upstreamForTelemetry } from "../src/args.js";

describe("parseArgs --upstream protocol guard", () => {
  it("accepts http: and https: upstream URLs", () => {
    expect(parseArgs(["--upstream", "http://127.0.0.1:9999"]).upstream).toBe("http://127.0.0.1:9999");
    expect(parseArgs(["--upstream", "https://api.openai.com"]).upstream).toBe("https://api.openai.com");
  });

  it("rejects non-http(s) protocols with a friendly error (main exits 1 on throw)", () => {
    expect(() => parseArgs(["--upstream", "ftp://example.com"])).toThrow(
      /--upstream expects an http: or https: URL, got "ftp:\/\/example\.com"/,
    );
    expect(() => parseArgs(["--upstream", "file:///etc/passwd"])).toThrow(
      /--upstream expects an http: or https: URL/,
    );
  });

  it("rejects a malformed URL with the same friendly error", () => {
    expect(() => parseArgs(["--upstream", "not-a-url"])).toThrow(
      /--upstream expects an http: or https: URL, got "not-a-url"/,
    );
  });
});

describe("upstream URL telemetry redaction", () => {
  it("removes URL credentials, path, query and fragment before logging", () => {
    expect(upstreamForTelemetry("https://alice:secret@example.com/v1?api_key=hidden#frag")).toBe(
      "https://example.com",
    );
  });
});

describe("help flag", () => {
  it("recognizes --help and -h without treating them as unknown flags", () => {
    expect(isHelpRequest(["--help"])).toBe(true);
    expect(isHelpRequest(["-h"])).toBe(true);
    expect(isHelpRequest(["--port", "4242"])).toBe(false);
  });
});
