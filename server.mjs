import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { AgentEngine } from "./src/engine.mjs";
import config from "./src/config/config.mjs";
import { sendVerificationCode, sendWelcomeEmail } from "./src/email/mailer.mjs";
import { connectDB, isConnected, User, Settlement, Proof } from "./src/db/mongoose.mjs";
import {
  startPolling,
  alertSignal,
  alertSettlement,
  alertProofVerified,
  alertDailySummary,
} from "./src/telegram/bot.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");

console.log("=================================");
console.log("🚀 EdgeLine OS — Trading Platform");
console.log("=================================");
console.log(`🌐 Network  : ${config.txline.network}`);
console.log(`🔑 API Token: ${config.txline.apiToken ? "Loaded ✅" : "Missing ❌"}`);
console.log(`📡 Mode     : ${config.app.liveMode ? "Live TxLINE" : "Replay"}`);
console.log(`🌍 URL      : http://localhost:${config.app.port}`);
console.log("=================================");

const port = config.app.port;

const engine = new AgentEngine({
  tickMs: config.app.tickMs,
  live: config.app.liveMode,
});

const sseClients = new Set();
// In-memory fallback store — used when MongoDB is not configured
const userStore  = new Map();

// Connect to MongoDB Atlas (non-blocking — falls back to in-memory if not configured)
connectDB().catch(() => {});

engine.on("update", (snapshot) => {
  broadcast("state", snapshot);
});

// Persist new settlements and proofs to MongoDB whenever the engine emits them
let _lastSettleCount = 0;
let _lastProofCount  = 0;
engine.on("update", async (snapshot) => {
  if (!isConnected()) return;

  // Persist new settlements
  if (snapshot.settlements?.length > _lastSettleCount) {
    const newOnes = snapshot.settlements.slice(0, snapshot.settlements.length - _lastSettleCount);
    for (const s of newOnes) {
      try {
        await Settlement.findOneAndUpdate(
          { fixtureId: String(s.fixtureId) },
          { ...s, fixtureId: String(s.fixtureId) },
          { upsert: true, new: true }
        );
      } catch { /* non-critical */ }
    }
    _lastSettleCount = snapshot.settlements.length;
  }

  // Persist new proofs
  if (snapshot.proofs?.length > _lastProofCount) {
    const newOnes = snapshot.proofs.slice(0, snapshot.proofs.length - _lastProofCount);
    for (const p of newOnes) {
      try {
        await Proof.findOneAndUpdate(
          { fixtureId: String(p.fixtureId), solanaSignature: p.solanaSignature },
          { ...p, fixtureId: String(p.fixtureId) },
          { upsert: true, new: true }
        );
      } catch { /* non-critical */ }
    }
    _lastProofCount = snapshot.proofs.length;
  }
});

engine.start();

// ── Telegram bot ─────────────────────────────────────────────────────────
// Wait 5 seconds after startup before sending the connected alert
// so the TxLINE stream is already active when the message fires
setTimeout(() => {
  startPolling(engine).catch(() => {});
}, 5000);

// Alert on new top signal each tick
let _lastSignalId = "";
engine.on("update", (snapshot) => {
  const top = snapshot.signals?.[0];
  if (top && top.id !== _lastSignalId) {
    _lastSignalId = top.id;
    alertSignal(top);
  }
});

// Alert when a match settles
let _lastSettleTgId = "";
engine.on("update", (snapshot) => {
  const latest = snapshot.settlements?.[0];
  if (latest && String(latest.fixtureId) !== _lastSettleTgId) {
    _lastSettleTgId = String(latest.fixtureId);
    alertSettlement(latest);
  }
});

// Alert when Solana proof is verified
let _lastProofTgSig = "";
engine.on("update", (snapshot) => {
  const latest = snapshot.proofs?.[0];
  if (latest && latest.allVerified && latest.solanaSignature !== _lastProofTgSig) {
    _lastProofTgSig = latest.solanaSignature;
    alertProofVerified(latest);
  }
});

// Daily summary at midnight UTC
const _now = new Date();
const _msToMidnight = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate() + 1).getTime() - _now.getTime();
setTimeout(() => {
  const s = engine.snapshot();
  alertDailySummary(s.kpis ?? {}, s.agents ?? []);
  setInterval(() => {
    const s2 = engine.snapshot();
    alertDailySummary(s2.kpis ?? {}, s2.agents ?? []);
  }, 24 * 60 * 60 * 1000);
}, _msToMidnight);

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/health") {
      return json(res, {
        ok: true,
        name: "EdgeLine OS",
        mode: engine.mode,
        tickMs: engine.tickMs,
      });
    }

    if (req.method === "GET" && url.pathname === "/api/state") {
      return json(res, engine.snapshot());
    }

    if (req.method === "GET" && url.pathname === "/api/signals") {
      return json(res, {
        signals: engine.signals,
        positions: engine.positions,
      });
    }

    if (req.method === "GET" && url.pathname === "/api/settlements") {
      return json(res, {
        totalSettled: engine.settlements.length,
        settlements: engine.settlements,
      });
    }

    if (req.method === "GET" && url.pathname === "/api/proofs") {
      return json(res, {
        proofs: engine.proofReceipts,
      });
    }

    if (req.method === "GET" && url.pathname === "/api/analytics") {
      const snap = engine.snapshot();
      return json(res, snap.analytics ?? {});
    }

    if (req.method === "POST" && url.pathname === "/api/control") {
      const body = await readJson(req);
      if (body.action === "start") engine.start();
      if (body.action === "pause") engine.pause();
      if (body.action === "reset") engine.reset();
      if (body.action === "tick") engine.tick();
      return json(res, engine.snapshot());
    }

    if (req.method === "GET" && url.pathname === "/api/stream") {
      return openSse(req, res);
    }

    // ── Auth endpoints ──────────────────────────────────────────────────
    // Simple in-memory user store — sufficient for a hackathon demo.
    // In production replace with a real database + bcrypt.
    if (req.method === "POST" && url.pathname === "/api/auth/register") {
      const body = await readJson(req);
      const { name, email, password, phone, country } = body;

      if (!email || !password || !name) {
        return json(res, { error: "Name, email and password are required" }, 400);
      }
      if (!email.toLowerCase().endsWith("@gmail.com")) {
        return json(res, { error: "Must be a Gmail address" }, 400);
      }
      if (password.length < 6) {
        return json(res, { error: "Password must be at least 6 characters" }, 400);
      }

      const emailLower = email.toLowerCase();

      if (isConnected()) {
        // ── MongoDB path ────────────────────────────────────────────────
        try {
          const existing = await User.findOne({ email: emailLower });
          if (existing) {
            return json(res, { error: "An account with this email already exists" }, 409);
          }
          const doc = await User.create({ name, email: emailLower, password, phone: phone ?? "", country: country ?? "" });
          const user = { name: doc.name, email: doc.email, phone: doc.phone, country: doc.country };
          sendWelcomeEmail(email, name).catch(() => {});
          return json(res, { user }, 201);
        } catch (err) {
          if (err.code === 11000) {
            return json(res, { error: "An account with this email already exists" }, 409);
          }
          throw err;
        }
      } else {
        // ── In-memory fallback ──────────────────────────────────────────
        if (userStore.has(emailLower)) {
          return json(res, { error: "An account with this email already exists" }, 409);
        }
        const user = { name, email: emailLower, phone: phone ?? "", country: country ?? "" };
        userStore.set(emailLower, { ...user, password });
        sendWelcomeEmail(email, name).catch(() => {});
        return json(res, { user }, 201);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      const body = await readJson(req);
      const { email, password } = body;

      if (!email || !password) {
        return json(res, { error: "Email and password are required" }, 400);
      }

      const emailLower = email.toLowerCase();

      if (isConnected()) {
        // ── MongoDB path ────────────────────────────────────────────────
        const doc = await User.findOne({ email: emailLower });
        if (!doc) {
          return json(res, { error: "Incorrect email or password" }, 401);
        }
        const valid = await doc.verifyPassword(password);
        if (!valid) {
          return json(res, { error: "Incorrect email or password" }, 401);
        }
        const user = { name: doc.name, email: doc.email, phone: doc.phone, country: doc.country };
        return json(res, { user });
      } else {
        // ── In-memory fallback ──────────────────────────────────────────
        const record = userStore.get(emailLower);
        if (!record || record.password !== password) {
          return json(res, { error: "Incorrect email or password" }, 401);
        }
        const { password: _pw, ...user } = record;
        return json(res, { user });
      }
    }

    if (req.method === "POST" && url.pathname === "/api/auth/forgot") {
      // In a real system this would send an email.
      // For the demo we just confirm the request was received.
      return json(res, { ok: true, message: "If that email exists a reset link has been sent." });
    }

    if (req.method === "POST" && url.pathname === "/api/auth/send-code") {
      const body = await readJson(req);
      const { target, code } = body;
      if (!target || !code) return json(res, { error: "target and code required" }, 400);

      const result = await sendVerificationCode(target, code);
      if (result.ok) {
        return json(res, { ok: true, delivered: "email" });
      } else {
        // Return code so client can show it as fallback
        console.warn(`[Auth] Email failed (${result.reason}) — returning code for client display`);
        return json(res, { ok: false, reason: result.reason, code });
      }
    }

    return serveStatic(url.pathname, res);
  } catch (error) {
    return json(res, { error: error.message || "Unexpected error" }, 500);
  }
});

server.listen(port, () => {
  console.log(`EdgeLine OS running at http://localhost:${port}`);
});

function openSse(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const client = res;
  sseClients.add(client);
  writeSse(client, "state", engine.snapshot());
  req.on("close", () => sseClients.delete(client));
}

function broadcast(event, data) {
  for (const client of sseClients) {
    writeSse(client, event, data);
  }
}

function writeSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function serveStatic(pathname, res) {
  // / → landing.html, /dashboard → dashboard.html
  let safePath = pathname;
  if (pathname === "/" || pathname === "") safePath = "/landing.html";
  else if (pathname === "/dashboard")      safePath = "/dashboard.html";

  const normalized = normalize(safePath).replace(/^(\.\.[/\\])+/, "");
  const filePath   = join(publicDir, normalized);
  if (!filePath.startsWith(publicDir)) {
    return json(res, { error: "Invalid path" }, 400);
  }

  try {
    const file = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type":  mimeType(extname(filePath)),
      "Cache-Control": extname(filePath) === ".html" ? "no-store" : extname(filePath) === ".js" ? "no-store" : "public, max-age=3600",
    });
    res.end(file);
  } catch {
    // Fallback to landing for unknown paths
    try {
      const fallback = await readFile(join(publicDir, "landing.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(fallback);
    } catch {
      json(res, { error: "Not found" }, 404);
    }
  }
}

function mimeType(ext) {
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
  }[ext] || "application/octet-stream";
}

function json(res, data, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data, null, 2));
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  if (!body) return {};
  return JSON.parse(body);
}
