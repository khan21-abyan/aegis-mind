import { describe, it, expect } from "vitest";
import { parseArgs } from "../src/args.js";

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
