// Quick diagnostic — tests every TxLINE endpoint and prints raw responses
// Run: node scripts/test-api.mjs

const API_TOKEN = "txoracle_api_b9d63eb431c44f869e43533fa78dd9b7";
const BASE      = "https://txline.txodds.com";

async function tryEndpoint(label, url, headers) {
  try {
    const res  = await fetch(url, { headers: { ...headers, Accept: "application/json" } });
    const body = await res.text();
    console.log(`\n[${label}]`);
    console.log(`  URL:    ${url}`);
    console.log(`  Status: ${res.status}`);
    console.log(`  Body:   ${body.slice(0, 500) || "(empty)"}`);
  } catch (e) {
    console.log(`\n[${label}] ERROR: ${e.message}`);
  }
}

async function run() {
  // 1. Guest JWT
  console.log("[0] Getting guest JWT...");
  const authRes  = await fetch(`${BASE}/auth/guest/start`, {
    method: "POST", headers: { Accept: "application/json" }
  });
  const { token: jwt } = await authRes.json();
  console.log("    JWT:", jwt ? "OK (" + jwt.slice(0,30) + "...)" : "FAILED");

  // Correct headers per docs: guest JWT as Bearer + activated token as X-Api-Token
  const h = {
    "Authorization": `Bearer ${jwt}`,
    "X-Api-Token":   API_TOKEN,
  };

  // All endpoint paths to probe
  const endpoints = [
    "/api/scores/snapshot",
    "/api/scores/stream",
    "/api/fixtures",
    "/api/fixtures/snapshot",
    "/api/fixtures/live",
    "/api/odds/snapshot",
    "/api/scores/history",
  ];

  for (const path of endpoints) {
    await tryEndpoint(`GET ${path}`, `${BASE}${path}`, h);
  }
}

run().catch(console.error);
