#!/usr/bin/env node
// scripts/import-phantom-key.mjs
//
// Converts a Phantom-exported base58 private key into a standard
// Solana CLI keypair JSON file ([byte, byte, ...] format).
//
// Usage (pass key as argument — no paste timing issues):
//   node scripts/import-phantom-key.mjs YOUR_BASE58_KEY_HERE
//
// Example:
//   node scripts/import-phantom-key.mjs 4UTgsDm9NniZ7hdMW...
//
// The key is never logged or sent anywhere.
// Only the resulting keypair JSON file is written to disk.

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── Get key from argument ────────────────────────────────────────────────────
const rawKey = process.argv[2]?.trim();

if (!rawKey) {
  console.error(`
Usage:
  node scripts/import-phantom-key.mjs YOUR_BASE58_PRIVATE_KEY

Example:
  node scripts/import-phantom-key.mjs 4UTgsDm9NniZ7hdMWtPz...

Get your key from: Phantom → Settings → Manage Accounts → Export Private Key
`);
  process.exit(1);
}

// ── Base58 decoder ───────────────────────────────────────────────────────────
const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function decodeBase58(str) {
  const bytes = [0];
  for (const char of str) {
    const value = BASE58_ALPHABET.indexOf(char);
    if (value < 0) throw new Error(`Invalid base58 character: "${char}"`);
    let carry = value;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const char of str) {
    if (char !== "1") break;
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

function encodeBase58(bytes) {
  let result = "";
  let num = BigInt("0x" + Buffer.from(bytes).toString("hex"));
  const base = BigInt(58);
  while (num > 0n) {
    result = BASE58_ALPHABET[Number(num % base)] + result;
    num /= base;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    result = "1" + result;
  }
  return result;
}

// ── Decode ───────────────────────────────────────────────────────────────────
let secretKey;
try {
  secretKey = decodeBase58(rawKey);
} catch (err) {
  console.error(`Could not decode key: ${err.message}`);
  process.exit(1);
}

if (secretKey.length !== 64) {
  console.error(
    `Expected a 64-byte private key, got ${secretKey.length} bytes.\n` +
    `Make sure you exported the PRIVATE KEY from Phantom, not the wallet address.`
  );
  process.exit(1);
}

// ── Verify wallet address ────────────────────────────────────────────────────
const publicKeyBytes = secretKey.slice(32);
const derivedAddress = encodeBase58(publicKeyBytes);
const expectedAddress = "mMtLWyZEF6AQnUp2UsBVk4LJfsiynqhbRyNHiqo9AMt";

console.log("\n─────────────────────────────────────────────");
console.log("  Phantom → Solana keypair converter");
console.log("─────────────────────────────────────────────");
console.log(`Derived address : ${derivedAddress}`);
console.log(`Expected address: ${expectedAddress}`);

if (derivedAddress !== expectedAddress) {
  console.error(
    "\n❌  Address mismatch!\n" +
    "    The key you entered does not match wallet mMtLW...\n" +
    "    Make sure you exported from the correct Phantom account."
  );
  process.exit(1);
}

console.log("✅  Address match confirmed.\n");

// ── Save keypair JSON ────────────────────────────────────────────────────────
const outDir = resolve(process.env.USERPROFILE ?? process.env.HOME ?? ".", ".config", "solana");
const outPath = resolve(outDir, "edgeline-mainnet.json");

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, JSON.stringify(Array.from(secretKey)), { mode: 0o600 });

// Clear the key from memory
secretKey.fill(0);

console.log(`Keypair saved to: ${outPath}`);
console.log(`
─────────────────────────────────────────────
Now run:

  node scripts/activate-mainnet.mjs --keypair "${outPath}"

─────────────────────────────────────────────
`);
