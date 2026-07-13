// src/telegram/bot.mjs
//
// EdgeLine OS Telegram Bot
// Sends real-time trading alerts to a Telegram chat.
// Uses the Telegram Bot API over HTTPS — works on every network.
//
// Setup:
//   1. Open Telegram → @BotFather → /newbot → paste token into .env as TELEGRAM_BOT_TOKEN
//   2. Start a chat with your bot, then run: node scripts/get-telegram-chatid.mjs
//   3. Paste your chat ID into .env as TELEGRAM_CHAT_ID
//   4. Restart the server — alerts flow automatically

const BASE = "https://api.telegram.org";

// ── Core send ─────────────────────────────────────────────────────────────

async function send(chatId, text, parseMode = "HTML") {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return; // not configured

  try {
    const res = await fetch(`${BASE}/bot${token}/sendMessage`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id:    chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn(`[Telegram] Send failed: ${err?.description ?? res.status}`);
    }
  } catch (err) {
    console.warn(`[Telegram] Network error: ${err.message}`);
  }
}

// Broadcast to the configured chat ID
function broadcast(text) {
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!chatId) return;
  send(chatId, text);
}

// ── Public alert functions ────────────────────────────────────────────────

/** New high-confidence AI signal */
export function alertSignal(signal) {
  if ((signal.confidence ?? 0) < 0.65) return; // only strong signals
  if (signal.type === "market-maker-quote") return; // skip quotes

  const conf    = Math.round((signal.confidence ?? 0) * 100);
  const action  = signal.direction === "steam" ? "🟢 BUY"
                : signal.direction === "drift" ? "🔴 SELL"
                : signal.direction === "fade"  ? "🟠 FADE"
                : signal.direction === "buy"   ? "🟢 BUY"
                : "⚪ SIGNAL";
  const edge    = ((signal.edge ?? 0) * 100).toFixed(1);
  const stake   = signal.stake ?? 0;

  broadcast(
    `<b>⚡ EdgeLine OS — ${action}</b>\n` +
    `\n` +
    `🤖 <b>${signal.agentName}</b>\n` +
    `⚽ ${signal.match} · ${signal.minute ?? 0}′\n` +
    `🎯 Outcome: <b>${signal.outcome}</b>\n` +
    `📊 Confidence: <b>${conf}%</b>\n` +
    `💹 Edge: ${edge} pts · Stake: $${stake}\n` +
    `\n` +
    `<i>${signal.rationale ?? ""}</i>`
  );
}

/** Position opened */
export function alertPositionOpened(position) {
  broadcast(
    `<b>📂 Position Opened</b>\n` +
    `\n` +
    `⚽ ${position.match}\n` +
    `🎯 <b>${position.outcome}</b> @ ${(position.stake ?? 0)} stake\n` +
    `🤖 Agent: ${position.agentName}\n` +
    `📊 Confidence: ${Math.round((position.confidence ?? 0) * 100)}%`
  );
}

/** Position settled after match ends */
export function alertSettlement(summary) {
  const pnl    = summary.totalPnL ?? 0;
  const emoji  = pnl >= 0 ? "✅" : "❌";
  const proof  = summary.validation?.allVerified ? "🔐 Verified on Solana ✅" : "⏳ Proof pending";

  broadcast(
    `<b>${emoji} Match Settled — ${summary.match}</b>\n` +
    `\n` +
    `📋 Final score: <b>${summary.finalScore}</b>\n` +
    `🏆 Winner: <b>${summary.winner}</b>\n` +
    `\n` +
    `📊 Positions: ${summary.positions}  |  W/L: ${summary.wins}/${summary.losses}\n` +
    `💰 Net PnL: <b>${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}</b>\n` +
    `💵 Staked: $${(summary.totalStaked ?? 0).toFixed(2)}  |  Payout: $${(summary.totalPayout ?? 0).toFixed(2)}\n` +
    `\n` +
    `${proof}`
  );
}

/** On-chain Merkle proof verified */
export function alertProofVerified(proof) {
  const sigShort = proof.solanaSignature
    ? `${proof.solanaSignature.slice(0, 12)}…` : "—";

  broadcast(
    `<b>🔐 On-Chain Proof Verified</b>\n` +
    `\n` +
    `⚽ ${proof.match} · <b>${proof.finalScore}</b>\n` +
    `✅ Result verified on Solana mainnet\n` +
    `\n` +
    `Merkle root: <code>${(proof.merkleRoot ?? "—").slice(0, 16)}…</code>\n` +
    `Signature: <code>${sigShort}</code>\n` +
    `🔗 <a href="${proof.solscanUrl ?? "#"}">View on Solscan</a>`
  );
}

/** TxLINE stream connected */
export function alertConnected() {
  const appUrl = process.env.APP_URL ?? "https://edgeline-os.onrender.com";
  broadcast(
    `<b>🟢 EdgeLine OS Connected</b>\n` +
    `\n` +
    `Live TxLINE stream active on Solana mainnet.\n` +
    `4 AI agents are now trading World Cup fixtures.\n` +
    `\n` +
    `🌐 Open dashboard: <a href="${appUrl}">${appUrl}</a>\n` +
    `\n` +
    `<i>Signals and settlement alerts will appear here.</i>`
  );
}

/** Daily summary */
export function alertDailySummary(kpis, agents) {
  const totalWins   = agents.reduce((s, a) => s + (a.wins   ?? 0), 0);
  const totalLosses = agents.reduce((s, a) => s + (a.losses ?? 0), 0);
  const winRate     = totalWins + totalLosses > 0
    ? Math.round((totalWins / (totalWins + totalLosses)) * 100)
    : 0;

  broadcast(
    `<b>📊 EdgeLine OS — Daily Summary</b>\n` +
    `\n` +
    `📈 Signals generated: <b>${kpis.signals ?? 0}</b>\n` +
    `💰 Realized PnL: <b>${kpis.realizedPnl >= 0 ? "+" : ""}$${(kpis.realizedPnl ?? 0).toFixed(2)}</b>\n` +
    `🎯 Win rate: <b>${winRate}%</b>  (${totalWins}W / ${totalLosses}L)\n` +
    `⚡ Risk deployed: $${(kpis.riskUsed ?? 0).toFixed(2)}\n` +
    `\n` +
    `<i>Powered by TxLINE Oracle · Solana Mainnet</i>`
  );
}

// ── Polling: handle user commands from Telegram ───────────────────────────
// Runs every 3 seconds to check for new messages

let _lastUpdateId = 0;

export async function startPolling(engineRef) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    console.log("[Telegram] No bot token — polling disabled");
    return;
  }

  console.log("[Telegram] Bot polling started ✅");
  alertConnected();

  setInterval(async () => {
    try {
      const res = await fetch(
        `${BASE}/bot${token}/getUpdates?offset=${_lastUpdateId + 1}&timeout=0`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ok || !data.result?.length) return;

      for (const update of data.result) {
        _lastUpdateId = update.update_id;
        const msg  = update.message;
        if (!msg) continue;

        const chatId = msg.chat.id;
        const text   = (msg.text ?? "").trim().toLowerCase();

        if (text === "/start" || text === "/help") {
          const appUrl = process.env.APP_URL ?? "https://edgeline-os.onrender.com";
          await send(chatId,
            `<b>👋 Welcome to EdgeLine OS Bot</b>\n\n` +
            `I send you live trading alerts from the AI agents.\n\n` +
            `🌐 Open the dashboard: <a href="${appUrl}">${appUrl}</a>\n\n` +
            `<b>Commands:</b>\n` +
            `/status — System status\n` +
            `/portfolio — Current portfolio\n` +
            `/matches — Live fixtures\n` +
            `/agents — Agent performance\n` +
            `/signals — Latest signals`
          );
        } else if (text === "/status") {
          const appUrl = process.env.APP_URL ?? "https://edgeline-os.onrender.com";
          const snap = engineRef?.snapshot?.();
          if (!snap) { await send(chatId, "Engine not ready yet."); continue; }
          const ing = snap.ingestion ?? {};
          const connected = snap.mode === "live-txline"
            ? Boolean(ing.connected) : Boolean(snap.running);
          await send(chatId,
            `<b>📡 EdgeLine OS Status</b>\n\n` +
            `Mode: <b>${snap.mode}</b>\n` +
            `Stream: ${connected ? "🟢 Connected" : "🔴 Disconnected"}\n` +
            `Tick: ${snap.tick}\n` +
            `Running: ${snap.running ? "▶ Yes" : "⏸ No"}\n\n` +
            `🌐 Dashboard: <a href="${appUrl}">${appUrl}</a>`
          );
        } else if (text === "/portfolio") {
          const snap = engineRef?.snapshot?.();
          if (!snap) { await send(chatId, "Engine not ready yet."); continue; }
          const k = snap.kpis ?? {};
          const capital = 10000;
          const equity  = capital + (k.realizedPnl ?? 0) + (k.openPnl ?? 0);
          await send(chatId,
            `<b>💼 Portfolio</b>\n\n` +
            `Balance: <b>$${capital.toLocaleString()}</b>\n` +
            `Equity: <b>$${equity.toFixed(2)}</b>\n` +
            `Open PnL: ${(k.openPnl ?? 0) >= 0 ? "+" : ""}$${(k.openPnl ?? 0).toFixed(2)}\n` +
            `Realized PnL: ${(k.realizedPnl ?? 0) >= 0 ? "+" : ""}$${(k.realizedPnl ?? 0).toFixed(2)}\n` +
            `Open positions: ${k.openPositions ?? 0}\n` +
            `Accuracy: ${k.accuracy != null ? Math.round(k.accuracy * 100) + "%" : "—"}`
          );
        } else if (text === "/matches") {
          const snap = engineRef?.snapshot?.();
          if (!snap) { await send(chatId, "Engine not ready yet."); continue; }
          const fixtures = (snap.fixtures ?? []).filter(f => f.status !== "Final");
          if (!fixtures.length) { await send(chatId, "No live or upcoming fixtures."); continue; }
          const lines = fixtures.map(f =>
            `⚽ <b>${f.home} vs ${f.away}</b>\n` +
            `   ${f.stage} · ${f.status === "Live" ? `${f.minute}′ 🔴` : "⏰ Upcoming"}\n` +
            `   Score: ${f.homeScore ?? 0} – ${f.awayScore ?? 0}`
          ).join("\n\n");
          await send(chatId, `<b>⚽ Fixtures</b>\n\n${lines}`);
        } else if (text === "/agents") {
          const snap = engineRef?.snapshot?.();
          if (!snap) { await send(chatId, "Engine not ready yet."); continue; }
          const lines = (snap.agents ?? []).map(a => {
            const wr = a.wins + a.losses > 0
              ? Math.round((a.wins / (a.wins + a.losses)) * 100) + "%" : "—";
            return `🤖 <b>${a.name}</b> (${a.role})\n   Signals: ${a.signals} · W/L: ${a.wins}/${a.losses} · Win rate: ${wr}\n   PnL: ${a.pnl >= 0 ? "+" : ""}$${(a.pnl ?? 0).toFixed(2)}`;
          }).join("\n\n");
          await send(chatId, `<b>🤖 Agent Arena</b>\n\n${lines}`);
        } else if (text === "/signals") {
          const snap = engineRef?.snapshot?.();
          if (!snap) { await send(chatId, "Engine not ready yet."); continue; }
          const sigs = (snap.signals ?? []).slice(0, 5);
          if (!sigs.length) { await send(chatId, "No signals yet. Click ▶ Run on the dashboard."); continue; }
          const lines = sigs.map(s =>
            `• <b>${s.agentName}</b> → ${s.direction?.toUpperCase()} <b>${s.outcome}</b>\n` +
            `  ${s.match} · ${Math.round((s.confidence ?? 0) * 100)}% conf`
          ).join("\n");
          await send(chatId, `<b>⚡ Latest Signals</b>\n\n${lines}`);
        }
      }
    } catch { /* polling errors are non-critical */ }
  }, 3000);
}
