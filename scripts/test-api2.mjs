import { writeFileSync } from "node:fs";

const API_TOKEN = "txoracle_api_b9d63eb431c44f869e43533fa78dd9b7";
const BASE      = "https://txline.txodds.com";

const results = [];

async function probe(label, url, extraHeaders = {}) {
  try {
    const res  = await fetch(url, {
      headers: { Accept: "application/json", ...extraHeaders }
    });
    const body = await res.text();
    results.push({ label, url, status: res.status, body: body.slice(0, 800) });
  } catch (e) {
    results.push({ label, url, error: e.message });
  }
}

const authRes = await fetch(`${BASE}/auth/guest/start`, {
  method: "POST", headers: { Accept: "application/json" }
});
const { token: jwt } = await authRes.json();

const h = { "Authorization": `Bearer ${jwt}`, "X-Api-Token": API_TOKEN };

await probe("scores/snapshot",          `${BASE}/api/scores/snapshot`,           h);
await probe("scores/stream HEAD",       `${BASE}/api/scores/stream`,             h);
await probe("fixtures no auth",         `${BASE}/api/fixtures`);
await probe("fixtures with auth",       `${BASE}/api/fixtures`,                  h);
await probe("fixtures/snapshot",        `${BASE}/api/fixtures/snapshot`,         h);
await probe("fixtures/live",            `${BASE}/api/fixtures/live`,             h);
await probe("scores/history",           `${BASE}/api/scores/history`,            h);
await probe("odds/snapshot",            `${BASE}/api/odds/snapshot`,             h);

writeFileSync("scripts/api-results.json", JSON.stringify(results, null, 2));
console.log("Done — results in scripts/api-results.json");
