// scripts/get-telegram-chatid.mjs
// Run after creating your bot and sending it any message.
// Usage: node scripts/get-telegram-chatid.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath   = resolve(__dirname, "../.env");
const envContent = readFileSync(envPath, "utf8");
const token = envContent.match(/TELEGRAM_BOT_TOKEN=(.+)/)?.[1]?.trim();

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN not set in .env");
  process.exit(1);
}

console.log("Fetching recent messages from your bot…\n");

const res  = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
const data = await res.json();

if (!data.ok || !data.result?.length) {
  console.log("No messages found.\n");
  console.log("Steps:");
  console.log("  1. Open Telegram");
  console.log("  2. Search for your bot (the username you gave it)");
  console.log("  3. Send it any message (e.g. /start)");
  console.log("  4. Run this script again");
  process.exit(0);
}

const chatId = data.result[0].message?.chat?.id;
const name   = data.result[0].message?.chat?.first_name ?? "";

if (!chatId) {
  console.log("Could not extract chat ID. Send your bot a message first.");
  process.exit(0);
}

console.log(`✅ Found chat ID: ${chatId} (${name})\n`);

// Save to .env
let updated = envContent;
const line  = `TELEGRAM_CHAT_ID=${chatId}`;
if (updated.includes("TELEGRAM_CHAT_ID=")) {
  updated = updated.replace(/TELEGRAM_CHAT_ID=.*/m, line);
} else {
  updated += `\n${line}\n`;
}
writeFileSync(envPath, updated);
console.log("✅ TELEGRAM_CHAT_ID saved to .env");
console.log("\nRestart the server: node server.mjs");
