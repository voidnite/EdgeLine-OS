#!/usr/bin/env node
// scripts/activate-mainnet.mjs
//
// Full TxLINE mainnet activation flow:
//   1. Fetch a guest JWT from mainnet
//   2. Submit the subscribe() transaction on Solana mainnet
//   3. Sign the activation message with your wallet
//   4. POST to /api/token/activate → receive your API token
//   5. Write the token into your .env file automatically
//
// Usage:
//   node scripts/activate-mainnet.mjs --keypair /path/to/your-keypair.json
//
// Your keypair file is the standard Solana JSON array format,
// e.g. the file created by:  solana-keygen new -o ~/my-wallet.json
//
// NEVER commit your keypair file to git.
// The script writes only the resulting API token to .env, not your key.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// ── Parse CLI args ──────────────────────────────────────────────────────────
const { values: args } = parseArgs({
  options: {
    keypair: { type: "string" },
    "service-level": { type: "string", default: "12" },  // 12 = real-time mainnet
    "duration-weeks": { type: "string", default: "4" },
    "dry-run": { type: "boolean", default: false },
  },
  allowPositionals: true,
});

const keypairPath = args.keypair;
const serviceLevelId = Number(args["service-level"]);
const durationWeeks = Number(args["duration-weeks"]);
const dryRun = args["dry-run"];

if (!keypairPath) {
  console.error(`
Usage: node scripts/activate-mainnet.mjs --keypair /path/to/keypair.json

  --keypair          Path to your Solana wallet keypair JSON (required)
  --service-level    12 = real-time World Cup (default), 1 = 60-second delay
  --duration-weeks   Subscription length in weeks (default: 4)
  --dry-run          Simulate without sending a transaction

Your wallet address: mMtLWyZEF6AQnUp2UsBVk4LJfsiynqhbRyNHiqo9AMt
`);
  process.exit(1);
}

// ── Constants (mainnet) ─────────────────────────────────────────────────────
const MAINNET = {
  rpcUrl: "https://api.mainnet-beta.solana.com",
  apiOrigin: "https://txline.txodds.com",
  programId: "9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA",
  txlMint: "Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL",
};

// ── Load keypair ────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");

let keypairBytes;
try {
  keypairBytes = Uint8Array.from(
    JSON.parse(readFileSync(resolve(keypairPath), "utf8"))
  );
} catch (err) {
  console.error(`Could not read keypair file at "${keypairPath}": ${err.message}`);
  process.exit(1);
}

// ── Dynamic imports (require the packages below to be installed) ─────────────
let anchor, web3, splToken, nacl;
try {
  anchor = await import("@coral-xyz/anchor");
  web3 = await import("@solana/web3.js");
  splToken = await import("@solana/spl-token");
  nacl = (await import("tweetnacl")).default;
} catch (err) {
  console.error(`
Missing dependencies. Run:

  npm install @coral-xyz/anchor @solana/web3.js @solana/spl-token tweetnacl

Then re-run this script.
`);
  process.exit(1);
}

const { Connection, PublicKey, Keypair, SystemProgram } = web3;
const {
  getAssociatedTokenAddressSync,
  getAccount,
  createAssociatedTokenAccountInstruction,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} = splToken;

const { Transaction } = web3;

// ── Load IDL ─────────────────────────────────────────────────────────────────
// Download the IDL once and cache it locally.  The script will fetch it if absent.
const idlPath = resolve(__dirname, "../idl/txoracle.json");
let idl;
if (existsSync(idlPath)) {
  idl = JSON.parse(readFileSync(idlPath, "utf8"));
  console.log("IDL loaded from cache.");
} else {
  console.log("Fetching IDL from GitHub…");
  const idlUrl =
    "https://raw.githubusercontent.com/txodds/tx-on-chain/main/idl/txoracle.json";
  const res = await fetch(idlUrl);
  if (!res.ok) throw new Error(`Failed to fetch IDL: ${res.status}`);
  const text = await res.text();
  idl = JSON.parse(text);
  // Cache it
  const { mkdirSync } = await import("node:fs");
  mkdirSync(resolve(__dirname, "../idl"), { recursive: true });
  writeFileSync(idlPath, text);
  console.log(`IDL cached at ${idlPath}`);
}

// ── Build Anchor provider ─────────────────────────────────────────────────────
const wallet = Keypair.fromSecretKey(keypairBytes);
const connection = new Connection(MAINNET.rpcUrl, "confirmed");

const anchorWallet = {
  publicKey: wallet.publicKey,
  signTransaction: async (tx) => { tx.sign(wallet); return tx; },
  signAllTransactions: async (txs) => { txs.forEach(tx => tx.sign(wallet)); return txs; },
};

const provider = new anchor.AnchorProvider(connection, anchorWallet, {
  commitment: "confirmed",
});
anchor.setProvider(provider);

const programId = new PublicKey(MAINNET.programId);
const program = new anchor.Program(idl, provider);

console.log("\n─────────────────────────────────────────────");
console.log("EdgeLine OS — TxLINE Mainnet Activation");
console.log("─────────────────────────────────────────────");
console.log(`Wallet:        ${wallet.publicKey.toBase58()}`);
console.log(`Service level: ${serviceLevelId} (${serviceLevelId === 12 ? "real-time" : "60-second delay"})`);
console.log(`Duration:      ${durationWeeks} week${durationWeeks !== 1 ? "s" : ""}`);
console.log(`Dry run:       ${dryRun}`);

// ── Check SOL balance ─────────────────────────────────────────────────────────
const lamports = await connection.getBalance(wallet.publicKey);
const sol = lamports / 1e9;
console.log(`SOL balance:   ${sol.toFixed(4)} SOL`);
if (sol < 0.01) {
  console.error("\n⚠️  Low SOL balance. You need at least ~0.01 SOL for transaction fees.");
  process.exit(1);
}

// ── Step 1: Guest JWT ─────────────────────────────────────────────────────────
console.log("\n[1/4] Fetching guest JWT from mainnet…");
const authRes = await fetch(`${MAINNET.apiOrigin}/auth/guest/start`, {
  method: "POST",
  headers: { Accept: "application/json" },
});
if (!authRes.ok) {
  throw new Error(`Guest JWT request failed: ${authRes.status} ${await authRes.text()}`);
}
const authData = await authRes.json();
const jwt = authData.token;
if (!jwt) throw new Error("No token in guest JWT response");
console.log(`   JWT acquired (${jwt.slice(0, 24)}…)`);

// ── Step 2: On-chain subscribe ────────────────────────────────────────────────
console.log(`\n[2/4] Submitting subscribe(${serviceLevelId}, ${durationWeeks}) on-chain…`);

const txlMint = new PublicKey(MAINNET.txlMint);

const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("token_treasury_v2")],
  programId
);
const tokenTreasuryVault = getAssociatedTokenAddressSync(
  txlMint,
  tokenTreasuryPda,
  true,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
);
const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("pricing_matrix")],
  programId
);
const userTokenAccount = getAssociatedTokenAddressSync(
  txlMint,
  wallet.publicKey,
  false,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
);

let txSig;
if (dryRun) {
  txSig = "DRY_RUN_SIMULATION_TX_SIGNATURE_NOT_REAL";
  console.log("   [dry-run] Skipping on-chain transaction.");
} else {

  // ── Create TxL token account if it doesn't exist ─────────────────────────
  // subscribe() requires user_token_account to be already initialised.
  // It's a Token-2022 ATA — create it in a preflight tx if missing.
  let ataExists = false;
  try {
    await splToken.getAccount(
      connection, userTokenAccount, "confirmed", TOKEN_2022_PROGRAM_ID
    );
    ataExists = true;
    console.log("   TxL token account already exists ✅");
  } catch {
    ataExists = false;
  }

  if (!ataExists) {
    console.log("   TxL token account not found — creating it now…");
    const createAtaIx = splToken.createAssociatedTokenAccountInstruction(
      wallet.publicKey,           // payer
      userTokenAccount,           // ATA address to create
      wallet.publicKey,           // owner
      txlMint,                    // mint
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    const createAtaTx = new web3.Transaction({
      feePayer: wallet.publicKey,
      blockhash,
      lastValidBlockHeight,
    }).add(createAtaIx);
    createAtaTx.sign(wallet);
    const ataTxSig = await connection.sendRawTransaction(
      createAtaTx.serialize(),
      { skipPreflight: false },
    );
    await connection.confirmTransaction(
      { signature: ataTxSig, blockhash, lastValidBlockHeight },
      "confirmed",
    );
    console.log(`   Token account created ✅  tx: ${ataTxSig}`);
  }

  // ── Subscribe ─────────────────────────────────────────────────────────────
  txSig = await program.methods
    .subscribe(serviceLevelId, durationWeeks)
    .accounts({
      user: wallet.publicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint: txlMint,
      userTokenAccount,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log(`   Subscription confirmed ✅`);
  console.log(`   Tx: ${txSig}`);
  console.log(`   Explorer: https://solscan.io/tx/${txSig}`);
}

// ── Step 3: Sign the activation message ──────────────────────────────────────
// Message format (empty leagues = standard free bundle): ${txSig}::${jwt}
console.log("\n[3/4] Signing activation message…");
const selectedLeagues = [];
const messageString = `${txSig}:${selectedLeagues.join(",")}:${jwt}`;
const messageBytes = new TextEncoder().encode(messageString);
const signatureBytes = nacl.sign.detached(messageBytes, wallet.secretKey);
const walletSignature = Buffer.from(signatureBytes).toString("base64");
console.log(`   Message:   ${messageString.slice(0, 60)}…`);
console.log(`   Signature: ${walletSignature.slice(0, 32)}…`);

// ── Step 4: Activate ──────────────────────────────────────────────────────────
console.log("\n[4/4] Activating API token…");
const activateUrl = `${MAINNET.apiOrigin}/api/token/activate`;

const activateRes = await fetch(activateUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Bearer ${jwt}`,
  },
  body: JSON.stringify({
    txSig,
    walletSignature,
    leagues: selectedLeagues,
  }),
});

if (!activateRes.ok) {
  const body = await activateRes.text();
  throw new Error(`Activation failed (${activateRes.status}): ${body}`);
}

// The activation endpoint may return a plain string token or a JSON object.
const rawBody = await activateRes.text();
let apiToken;
try {
  const parsed = JSON.parse(rawBody);
  apiToken = parsed.token ?? parsed.apiToken ?? (typeof parsed === "string" ? parsed : null);
} catch {
  // Plain string response — use as-is
  apiToken = rawBody.trim();
}

if (!apiToken || typeof apiToken !== "string") {
  console.error("Unexpected activation response body:", rawBody);
  throw new Error("Could not extract API token from response.");
}

console.log(`   API token received: ${apiToken.slice(0, 20)}…`);

// ── Write token to .env ────────────────────────────────────────────────────────
console.log(`\nWriting TXLINE_API_TOKEN to ${envPath}…`);

let envContent = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

if (envContent.includes("TXLINE_API_TOKEN=")) {
  // Replace existing placeholder or old value
  envContent = envContent.replace(
    /^TXLINE_API_TOKEN=.*$/m,
    `TXLINE_API_TOKEN=${apiToken}`
  );
} else {
  envContent += `\nTXLINE_API_TOKEN=${apiToken}\n`;
}

if (!dryRun) {
  writeFileSync(envPath, envContent);
  console.log("   .env updated ✅");
} else {
  console.log("   [dry-run] Would write token to .env (skipped).");
}

// ── Done ───────────────────────────────────────────────────────────────────────
console.log(`
─────────────────────────────────────────────
✅  ACTIVATION COMPLETE
─────────────────────────────────────────────
API Token : ${apiToken.slice(0, 28)}…
Tx Sig    : ${txSig}
Network   : mainnet
Service   : ${serviceLevelId === 12 ? "Real-time World Cup & Int Friendlies" : "60-second delay World Cup & Int Friendlies"}

Your .env has been updated. Start the server now:

  node server.mjs

The live TxLINE stream will connect automatically.
─────────────────────────────────────────────
`);
