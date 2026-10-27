import { describe, it, expect } from "vitest";
import { generateKeyPairSync, sign, createVerify } from "node:crypto";
import { parseLicense, sealLicense } from "../src/license.js";
import { AEGIS_LICENSE_PUBLIC_KEY } from "../src/keys.js";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const PUB = publicKey.export({ type: "spki", format: "pem" }).toString();

const payload = {
  scope: "pro",
  issued: "2026-10-27T00:00:00.000Z",
  email: "dev@example.com",
} as const;

describe("parseLicense", () => {
  it("accepts a valid pro license with expected public key", () => {
    const txt = sealLicense(payload, privateKey);
    const lic = parseLicense(txt, PUB);
    expect(lic).not.toBeNull();
    expect(lic?.scope).toBe("pro");
    expect(lic?.email).toBe("dev@example.com");
    expect(lic?.issued).toBe("2026-10-27T00:00:00.000Z");
  });

  it("returns null for a tampered payload", () => {
    const txt = sealLicense(payload, privateKey);
    const lines = txt.split("\n");
    const forged = Buffer.from(JSON.stringify({ ...payload, scope: "core" })).toString("base64");
    const tampered = `${forged}\n${lines[1]}`;
    expect(lines[0]).not.toBe(forged);
    expect(parseLicense(tampered, PUB)).toBeNull();
  });

  it("returns null when signature is garbage", () => {
    const b64 = Buffer.from(JSON.stringify(payload)).toString("base64");
    expect(parseLicense(`${b64}\nnot-a-signature`, PUB)).toBeNull();
  });

  it("returns null when verifying with the wrong public key", () => {
    const other = generateKeyPairSync("ed25519");
    const otherPub = other.publicKey.export({ type: "spki", format: "pem" }).toString();
    const txt = sealLicense(payload, privateKey);
    expect(parseLicense(txt, otherPub)).toBeNull();
  });

  it("returns null when the payload is not valid license JSON", () => {
    const bad = { hello: 1 };
    const b64 = Buffer.from(JSON.stringify(bad)).toString("base64");
    const sig = sign(null, Buffer.from(JSON.stringify(bad)), privateKey).toString("base64");
    expect(parseLicense(`${b64}\n${sig}`, PUB)).toBeNull();
  });

  it("accepts a free-tier scope", () => {
    const txt = sealLicense({ scope: "core", issued: payload.issued, email: payload.email }, privateKey);
    const lic = parseLicense(txt, PUB);
    expect(lic?.scope).toBe("core");
  });

  it("returns null without expectedPublicKey when signed by a different key (default-key verify path)", () => {
    const other = generateKeyPairSync("ed25519");
    const forged = sealLicense(payload, other.privateKey);
    expect(parseLicense(forged)).toBeNull();
    expect(parseLicense(`${forged.split("\n")[0]}\nnot-a-signature`)).toBeNull();
  });
});
