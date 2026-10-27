import { sign, verify, createPublicKey } from "node:crypto";

import type { KeyObject } from "node:crypto";
import { AEGIS_LICENSE_PUBLIC_KEY } from "./keys.js";

export interface License {
  scope: "core" | "pro";
  issued: string;
  email: string;
}

const isLicenseShape = (v: unknown): v is License =>
  typeof v === "object" &&
  v !== null &&
  ((v as Record<string, unknown>).scope === "core" || (v as Record<string, unknown>).scope === "pro") &&
  typeof (v as Record<string, unknown>).issued === "string" &&
  typeof (v as Record<string, unknown>).email === "string";

/** Seal a license payload: returns the two-line license file (payload b64 /\n signature b64). */
export function sealLicense(payload: License, privateKeyPem: string | KeyObject): string {
  const json = JSON.stringify(payload);
  const payloadB64 = Buffer.from(json, "utf8").toString("base64");
  const sig = sign(null, Buffer.from(payloadB64, "utf8"), privateKeyPem as string | KeyObject).toString("base64");
  return `${payloadB64}\n${sig}`;
}

/** Offline Ed25519 licensing: two base64 lines (payload, signature). Tampering or verify failure returns null. */
export function parseLicense(txt: string, expectedPublicKey?: string): License | null {
  const lines = txt.trim().split(/\r?\n/);
  const payloadB64 = lines[0];
  const sigB64 = lines[1];
  if (!payloadB64 || !sigB64 || lines.length !== 2) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8"));
  } catch {
    return null;
  }
  if (!isLicenseShape(payload)) return null;
  let ok: boolean;
  try {
    ok = verify(
      null,
      Buffer.from(payloadB64, "utf8"),
      createPublicKey(expectedPublicKey ?? AEGIS_LICENSE_PUBLIC_KEY),
      Buffer.from(sigB64, "base64"),
    );
  } catch {
    return null;
  }
  return ok ? payload : null;
}
