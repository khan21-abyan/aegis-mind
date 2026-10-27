#!/usr/bin/env node
// Offline Pro-license minting tool for Aegis Mind.
// Usage:
//   node tools/mint-license.mjs --private C:/path/private.pem --email buyer@x.com --plan pro [--out .aegis/license.txt]
//   --print  prints the license text instead of writing a file
import { sign as cryptoSign } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  return fallback;
};
const FLAG = (name) => args.includes(`--${name}`);
const fail = (msg) => { console.error("mint-license:", msg); process.exit(1); };

if (!FLAG("help") && !FLAG("h")) {
  const privPath = arg("private");
  if (!privPath) fail("missing required --private <path-to-pem>");
  const email = arg("email", "buyer@example.com");
  const plan = arg("plan", "pro");
  if (!["pro", "core"].includes(plan)) fail(`unknown plan "${plan}" (core|pro)`);
  const out = arg("out");
  const priv = readFileSync(privPath, "utf8");

  const payloadB64 = Buffer.from(
    JSON.stringify({ scope: plan, email, issued: new Date().toISOString() })
  ).toString("base64");
  const signature = cryptoSign(null, Buffer.from(payloadB64), priv).toString("base64");
  const text = `${payloadB64}\n${signature}\n`;

  if (FLAG("print") || !out) { process.stdout.write(text); process.exit(0); }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text);
  console.log(`license written: ${out} (scope=${plan}, email=${email})`);
}
