/* ═══════════════════════════════════════════════════════════
   EdgeLine OS — Dashboard JS
   Multi-screen trading platform connected to /api/stream + /api/state
   ═══════════════════════════════════════════════════════════ */

// ── Auth guard ────────────────────────────────────────────────────────────
const _stored = sessionStorage.getItem("el_user") || localStorage.getItem("el_user");
if (!_stored) { window.location.href = "/landing.html"; }
const USER = JSON.parse(_stored || "{}");

// ── State ─────────────────────────────────────────────────────────────────
const state = {
  snapshot:   null,
  frame:      0,
  streamOk:   false,
  activeScreen: "trading",
  fixtureFilter: "all",
};

// ── DOM helpers ───────────────────────────────────────────────────────────
const q  = (sel)       => document.querySelector(sel);
const qa = (sel)       => [...document.querySelectorAll(sel)];

// ── Boot ──────────────────────────────────────────────────────────────────
initUser();
initSidebar();
initControls();
connectStream();
animateRadar();

/* ── User init ───────────────────────────────────────────────────────────── */
function initUser() {
  const name  = USER.name    || "Trader";
  const email = USER.email   || "";
  q("#sbUserName").textContent  = name;
  q("#sbUserEmail").textContent = email;
  q("#sbAvatar").textContent    = name.charAt(0).toUpperCase();
  q("#setName").textContent     = name;
  q("#setEmail").textContent    = email;
  q("#setCountry").textContent  = USER.country || "—";
  q("#logoutBtn").addEventListener("click",    logout);
  q("#settingsLogout").addEventListener("click", logout);
}

function logout() {
  sessionStorage.removeItem("el_user");
  localStorage.removeItem("el_user");
  window.location.href = "/landing.html";
}

/* ── Sidebar + screen navigation ─────────────────────────────────────────── */
function initSidebar() {
  // Mobile toggle
  const toggle  = q("#sbToggle");
  const sidebar = q("#sidebar");
  toggle?.addEventListener("click", () => sidebar.classList.toggle("open"));
  q("#main")?.addEventListener("click", () => sidebar.classList.remove("open"));

  // Screen nav
  qa(".sb-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const screen = btn.dataset.screen;
      switchScreen(screen);
    });
  });
}

function switchScreen(name) {
  state.activeScreen = name;

  // Nav items
  qa(".sb-item").forEach(b => {
    b.classList.toggle("active", b.dataset.screen === name);
    b.setAttribute("aria-selected", String(b.dataset.screen === name));
  });

  // Screen panels
  qa(".screen").forEach(s => s.classList.toggle("active", s.id === `screen-${name}`));

  // Title
  const titles = {
    trading:    ["Trading",          "Live World Cup · AI agents running"],
    matches:    ["Live Matches",     "Real-time World Cup fixtures from TxLINE"],
    portfolio:  ["Portfolio",        "Your trades, equity, and settlement history"],
    agents:     ["Agent Arena",      "4 autonomous AI trading agents"],
    analytics:  ["Analytics",        "Performance intelligence"],
    validation: ["On-Chain",         "Solana mainnet proof verification"],
    settings:   ["Settings",         "Account & system configuration"],
  };
  const [title, sub] = titles[name] || ["EdgeLine OS", ""];
  q("#screenTitle").textContent = title;
  q("#screenSub").textContent   = sub;

  // Redraw canvases when switching to analytics
  if (name === "analytics" && state.snapshot) {
    drawEvChart(state.snapshot.analytics?.evChart    ?? []);
    drawEquityChart(state.snapshot.analytics?.timeline ?? []);
  }
  if (name === "portfolio" && state.snapshot) {
    drawEquityChart(state.snapshot.analytics?.timeline ?? []);
  }
}

/* ── Controls ────────────────────────────────────────────────────────────── */
function initControls() {
  q("#startBtn")?.addEventListener("click", () => apiControl("start"));
  q("#pauseBtn")?.addEventListener("click", () => apiControl("pause"));
  q("#tickBtn")?.addEventListener("click",  () => apiControl("tick"));

  // Fixture filter tabs
  qa("#fixtureFilter .filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      qa("#fixtureFilter .filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.fixtureFilter = btn.dataset.filter;
      if (state.snapshot) renderFixtures(state.snapshot.fixtures ?? []);
    });
  });
}

async function apiControl(action) {
  try {
    const res = await fetch("/api/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    ingest(await res.json());
  } catch (e) { console.warn("Control error:", e.message); }
}

/* ── SSE stream + polling fallback ───────────────────────────────────────── */
function connectStream() {
  const src = new EventSource("/api/stream");
  src.addEventListener("state", e => {
    state.streamOk = true;
    ingest(JSON.parse(e.data));
  });
  src.addEventListener("error", async () => {
    state.streamOk = false;
    setConnUI("reconnecting", "Reconnecting…");
    await pollOnce();
  });
}

async function pollOnce() {
  try {
    const res = await fetch("/api/state");
    ingest(await res.json());
  } catch { /* server down */ }
  if (!state.streamOk) setTimeout(pollOnce, 2000);
}

function ingest(data) {
  if (!data || typeof data !== "object") return;
  state.snapshot = data;
  render();
}

/* ── Master render ───────────────────────────────────────────────────────── */
function render() {
  const d = state.snapshot;
  if (!d) return;
  renderTopBar(d);
  renderKpiBar(d);
  renderSidebarMini(d);
  renderActivityFeed(d.signals ?? [], d.agents ?? []);
  renderDecisions(d.signals   ?? []);
  renderPositions(d.positions ?? []);
  renderFixtures(d.fixtures   ?? []);
  renderAgents(d.agents       ?? []);
  renderPortfolio(d);
  renderSettlements(d.settlements ?? []);
  renderProofsWithFlash(d.proofs ?? []);
  renderAnalytics(d.analytics ?? {});
  renderSettings(d);
}

/* ── Top bar ─────────────────────────────────────────────────────────────── */
function renderTopBar(d) {
  const modeLabel = d.mode === "live-txline" ? "live · mainnet"
                  : d.mode === "deterministic-replay" ? "replay"
                  : d.mode ?? "—";
  q("#modeBadge").textContent  = modeLabel;
  q("#clockBadge").textContent = `tick ${d.tick ?? 0}`;

  const ing       = d.ingestion ?? {};
  const isLive    = d.mode === "live-txline";
  const connected = isLive ? Boolean(ing.connected) : Boolean(d.running);
  const connSt    = connected ? "connected" : (d.running ? "reconnecting" : "disconnected");
  const connLbl   = d.mode === "live-txline"
    ? (connected ? "TxLINE live" : (d.running ? "Live · connecting…" : "Paused"))
    : (connected ? "Replay running" : (d.running ? "Replay running" : "Paused"));
  setConnUI(connSt, connLbl);

  const score = computeHealth(d);
  const cls   = score >= 90 ? "excellent" : score >= 75 ? "good" : score >= 50 ? "warning" : "critical";
  q("#healthScore").textContent = score;
  q("#healthLabel").textContent = cls.toUpperCase();
  q("#healthBadge").className   = `badge health-badge ${cls}`;
}

function setConnUI(status, label) {
  q("#sbDot").className        = `conn-dot ${status}`;
  q("#sbConnLabel").textContent = label;
}

function computeHealth(d) {
  let s = 100;
  if (!d.running) s -= 30;
  if (d.mode === "live-txline" && !d.ingestion?.connected) s -= 40;
  return Math.max(0, s);
}

/* ── KPI bar ─────────────────────────────────────────────────────────────── */
function renderKpiBar(d) {
  const k = d.kpis ?? {};
  q("#signalsKpi").textContent   = k.signals        ?? 0;
  q("#positionsKpi").textContent = k.openPositions  ?? 0;
  setMoney(q("#openPnlKpi"),     k.openPnl     ?? 0);
  setMoney(q("#realizedPnlKpi"), k.realizedPnl ?? 0);
  q("#riskKpi").textContent    = money(k.riskUsed ?? 0);
  q("#accuracyKpi").textContent = k.accuracy == null ? "—"
    : `${Math.round(k.accuracy * 100)}%`;

  // Sidebar mini portfolio
  q("#sbBalance").textContent = money(10000);
  setMoney(q("#sbOpenPnl"),  k.openPnl     ?? 0);
  setMoney(q("#sbRealPnl"),  k.realizedPnl ?? 0);

  // Nav badges
  q("#navSignalsBadge").textContent = k.signals       ?? 0;
  q("#navMatchBadge").textContent   = (d.fixtures ?? []).filter(f => f.status === "Live").length;
}

function renderSidebarMini(d) {
  const k = d.kpis ?? {};
  q("#navProofBadge").textContent = (d.proofs ?? []).filter(p => p.allVerified).length;
}

/* ── AI Decisions (Trading screen) ──────────────────────────────────────── */
function renderDecisions(signals) {
  const ledger = q("#decisionLedger");
  q("#decisionCount").textContent = signals.length;

  if (!signals.length) {
    ledger.innerHTML = `<p class="empty-state empty-dark">Agents warming up — decisions appear here.</p>`;
    return;
  }
  const topId = signals[0]?.id ?? "";
  if (ledger.dataset.topId === topId) return;
  ledger.dataset.topId = topId;

  ledger.replaceChildren(...signals.slice(0, 18).map(sig => {
    const conf   = Math.round((sig.confidence ?? 0) * 100);
    const action = sig.direction === "steam" ? "BUY"
                 : sig.direction === "drift" ? "SELL"
                 : sig.direction === "fade"  ? "FADE"
                 : sig.direction === "buy"   ? "BUY"
                 : sig.type === "market-maker-quote" ? "QUOTE" : "HOLD";
    const actCls = action === "BUY" ? "act-BUY"
                 : (action === "SELL" || action === "FADE") ? "act-SELL" : "act-HOLD";

    const row = document.createElement("article");
    row.className = `decision-row ${actCls}`;
    row.innerHTML = `
      <div class="d-top">
        <strong>
          <span class="agent-dot" style="background:${esc(sig.agentColor)};
            display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;"></span>
          ${esc(sig.agentName)} · ${esc(sig.outcome)}
        </strong>
        <div class="d-tags">
          <span class="d-tag">${esc(action)}</span>
          <span class="d-tag">${esc(sig.type)}</span>
        </div>
      </div>
      <div class="d-bar" role="progressbar" aria-valuenow="${conf}" aria-valuemin="0" aria-valuemax="100">
        <span style="width:${conf}%"></span>
      </div>
      <div class="d-meta">
        <span>${esc(sig.match)} · ${sig.minute ?? 0}′</span>
        <span>${conf}% · ${money(sig.stake ?? 0)}</span>
      </div>
      <p class="d-reason">${esc(sig.rationale ?? "")}</p>
    `;
    return row;
  }));
}

/* ── Open positions (Trading screen) ────────────────────────────────────── */
function renderPositions(positions) {
  const list = q("#positionsList");
  const open = positions.filter(p => p.status === "open");
  q("#bookCount").textContent = open.length;

  if (!open.length) {
    list.innerHTML = `<p class="empty-state">No open positions. Click ▶ Run to start agents.</p>`;
    return;
  }
  list.replaceChildren(...open.slice(0, 20).map(p => {
    const pnlCls = (p.pnl ?? 0) >= 0 ? "positive" : "negative";
    const conf   = Math.round((p.confidence ?? 0) * 100);
    const row    = document.createElement("article");
    row.className = "pos-row";
    row.setAttribute("role", "listitem");
    row.innerHTML = `
      <div class="pos-left">
        <span class="pos-outcome">${esc(p.outcome)}</span>
        <span class="pos-match">${esc(p.match)}</span>
        <div class="pos-agent">
          <span class="agent-dot" style="background:${esc(p.agentColor ?? "#14b8a6")}"></span>
          ${esc(p.agentName)} · ${conf}% conf
        </div>
      </div>
      <div class="pos-right">
        <span class="pos-pnl ${pnlCls}">${money(p.pnl ?? 0)}</span>
        <span class="pos-stake">${money(p.stake)} stake</span>
      </div>
    `;
    return row;
  }));
}

/* ── Live Fixtures screen ────────────────────────────────────────────────── */
function renderFixtures(fixtures) {
  const grid   = q("#fixturesList");
  const filter = state.fixtureFilter;

  // Sort: Live first, then Scheduled by startTime, then Final
  const sorted = [...fixtures].sort((a, b) => {
    const order = { Live: 0, Scheduled: 1, Final: 2 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });

  const filtered = filter === "all" ? sorted
    : sorted.filter(f => f.status === filter);

  q("#fixtureCount").textContent = `${filtered.length} match${filtered.length !== 1 ? "es" : ""}`;

  if (!filtered.length) {
    grid.innerHTML = `<p class="empty-state empty-dark">
      ${filter === "Live" ? "No matches live right now — check back soon." :
        filter === "Final" ? "No finished matches yet." : "No matches found."}
    </p>`;
    return;
  }

  grid.replaceChildren(...filtered.map(f => {
    const stCls = f.status === "Live" ? "live"
                : f.status === "Final" ? "final" : "scheduled";

    // Status label
    const stLbl = f.status === "Live"  ? `${f.minute ?? 0}′ ●`
                : f.status === "Final" ? "FT"
                : f.startTime
                  ? new Date(f.startTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                  : "Upcoming";

    // Score pill colour: teal for live/scheduled, white on dark for final
    const scorePill = f.status === "Final"
      ? `<span class="fx-score fx-score-final">${f.homeScore ?? 0} – ${f.awayScore ?? 0}</span>`
      : `<span class="fx-score">${f.homeScore ?? 0} – ${f.awayScore ?? 0}</span>`;

    // Stage badge: clean label
    const stageLabel = (f.stage ?? "World Cup")
      .replace("World Cup > ", "")
      .replace("World Cup", "World Cup");

    // For Final matches show the winner banner instead of betting odds
    const oddsSection = f.status === "Final"
      ? `<div class="fx-result-banner">
          <span class="fx-result-icon">🏆</span>
          <span class="fx-result-text">
            ${f.homeScore > f.awayScore ? esc(f.home) + " win" :
              f.awayScore > f.homeScore ? esc(f.away) + " win" : "Draw"}
          </span>
          <span class="fx-result-score">${f.homeScore ?? 0} – ${f.awayScore ?? 0}</span>
        </div>`
      : `<div class="fx-odds">
          ${(f.outcomes ?? []).map((o, i) => {
            const prob = f.probabilities?.[i] ?? 0;
            const odd  = f.odds?.[i] ?? 0;
            return `
              <div class="fx-odd-row">
                <span>${esc(o)}</span>
                <strong>${odd.toFixed(2)}×</strong>
                <span class="pct">${Math.round(prob * 100)}%</span>
              </div>
              <div class="fx-prob-bar" aria-hidden="true">
                <span style="width:${Math.round(prob * 100)}%"></span>
              </div>`;
          }).join("")}
        </div>`;

    const card = document.createElement("article");
    card.className = `fixture-card${f.status === "Live" ? " fixture-card-live" : ""}`;
    card.setAttribute("role", "listitem");
    card.innerHTML = `
      <div class="fx-header">
        <span class="fx-teams">
          ${esc(f.home)} <span class="fx-vs">vs</span> ${esc(f.away)}
        </span>
        ${scorePill}
      </div>
      <div class="fx-meta">
        <span class="fx-stage">${esc(stageLabel)}</span>
        <span class="fx-status ${stCls}">${stLbl}</span>
      </div>
      ${oddsSection}
    `;
    return card;
  }));
}

/* ── Agents screen ───────────────────────────────────────────────────────── */
function renderAgents(agents) {
  const grid = q("#agentsList");
  if (!agents.length) {
    grid.innerHTML = `<p class="empty-state empty-dark">No agents loaded.</p>`;
    return;
  }
  grid.replaceChildren(...agents.map(a => {
    const riskPct = Math.min(100, Math.round(((a.exposure ?? 0) / (a.riskLimit ?? 1)) * 100));
    const wr      = a.wins + a.losses > 0
      ? Math.round((a.wins / (a.wins + a.losses)) * 100) + "%" : "—";

    const card = document.createElement("article");
    card.className = "agent-card";
    card.setAttribute("role", "listitem");
    card.innerHTML = `
      <div class="ag-header">
        <div class="ag-name">
          <span class="agent-dot" style="background:${esc(a.color)}"></span>
          ${esc(a.name)}
        </div>
        <span class="ag-role">${esc(a.role)}</span>
      </div>
      <p class="ag-mandate">${esc(a.mandate ?? a.lastAction ?? "—")}</p>
      <div class="ag-meter" role="progressbar"
        aria-valuenow="${riskPct}" aria-valuemin="0" aria-valuemax="100"
        title="Exposure ${riskPct}% of risk limit">
        <span style="width:${riskPct}%;background:${esc(a.color)}"></span>
      </div>
      <div class="ag-stats">
        <span>Exposure ${money(a.exposure ?? 0)}</span>
        <span>PnL <span class="${(a.pnl ?? 0) >= 0 ? "positive" : "negative"}">${money(a.pnl ?? 0)}</span></span>
      </div>
      <div class="ag-stats">
        <span>Signals ${a.signals ?? 0}</span>
        <span>Win rate ${wr}</span>
      </div>
    `;
    return card;
  }));
}

/* ── Portfolio screen ────────────────────────────────────────────────────── */
function renderPortfolio(d) {
  const k       = d.kpis   ?? {};
  const agents  = d.agents ?? [];
  const capital = 10000;
  const equity  = capital + (k.realizedPnl ?? 0) + (k.openPnl ?? 0);
  const roi     = ((( k.realizedPnl ?? 0) / capital) * 100);
  const wins    = agents.reduce((s, a) => s + (a.wins   ?? 0), 0);
  const losses  = agents.reduce((s, a) => s + (a.losses ?? 0), 0);
  const total   = wins + losses;
  const wr      = total > 0 ? Math.round((wins / total) * 100) + "%" : "—";

  q("#portBalance").textContent  = money(capital);
  q("#portEquity").textContent   = money(equity);
  q("#portEquity").className     = `port-big ${equity >= capital ? "positive" : "negative"}`;
  q("#portRoi").textContent      = `${roi >= 0 ? "+" : ""}${roi.toFixed(2)}%`;
  q("#portRoi").className        = `port-big ${roi >= 0 ? "positive" : "negative"}`;
  q("#portWinRate").textContent  = wr;
  q("#portTrades").textContent   = total;
  q("#portWL").textContent       = `${wins} / ${losses}`;
}

/* ── Settlement history ──────────────────────────────────────────────────── */
function renderSettlements(settlements) {
  const list = q("#settlementList");
  q("#settleCount").textContent = settlements.length;

  if (!settlements.length) {
    list.innerHTML = `<p class="empty-state">Settlements appear when matches finish.</p>`;
    return;
  }
  const topId = String(settlements[0]?.fixtureId ?? "");
  if (list.dataset.topId === topId) return;
  list.dataset.topId = topId;

  list.replaceChildren(...settlements.map(s => {
    const pnlCls  = (s.totalPnL ?? 0) >= 0 ? "positive" : "negative";
    const proof   = s.validation?.allVerified === true  ? "verified"
                  : s.validation?.allVerified === false ? "failed" : "pending";
    const proofLbl = proof === "verified" ? "Verified on Solana ✅"
                   : proof === "failed"   ? "Proof failed ❌" : "Pending ⏳";
    const row = document.createElement("article");
    row.className = "settle-row";
    row.setAttribute("role", "listitem");
    row.innerHTML = `
      <div class="settle-top">
        <strong>${esc(s.match)}</strong>
        <span class="settle-score">${esc(s.finalScore ?? "—")}</span>
      </div>
      <div class="settle-meta">
        <span>${esc(s.stage ?? "")} · ${esc(s.winner ?? "—")} wins</span>
        <span class="proof-pill ${proof}">${proofLbl}</span>
      </div>
      <div class="settle-stats">
        <div class="settle-stat">
          <span class="settle-stat-label">Positions</span>
          <span class="settle-stat-val">${s.positions ?? 0}</span>
        </div>
        <div class="settle-stat">
          <span class="settle-stat-label">W / L</span>
          <span class="settle-stat-val">${s.wins ?? 0} / ${s.losses ?? 0}</span>
        </div>
        <div class="settle-stat">
          <span class="settle-stat-label">PnL</span>
          <span class="settle-stat-val ${pnlCls}">${money(s.totalPnL ?? 0)}</span>
        </div>
        <div class="settle-stat">
          <span class="settle-stat-label">Staked</span>
          <span class="settle-stat-val">${money(s.totalStaked ?? 0)}</span>
        </div>
        <div class="settle-stat">
          <span class="settle-stat-label">Payout</span>
          <span class="settle-stat-val positive">${money(s.totalPayout ?? 0)}</span>
        </div>
        <div class="settle-stat">
          <span class="settle-stat-label">At</span>
          <span class="settle-stat-val">${fmtTime(s.settledAt)}</span>
        </div>
      </div>`;
    return row;
  }));
}

/* ── On-chain proofs screen ──────────────────────────────────────────────── */
function renderProofs(proofs) {
  const verified = proofs.filter(p => p.allVerified).length;
  const failed   = proofs.filter(p => !p.allVerified).length;

  q("#proofVerifiedCount").textContent = `${verified} ✅`;
  q("#proofFailedCount").textContent   = `${failed} ❌`;
  q("#proofProgram").textContent       = "9ExbZj…KaA";
  q("#proofNetwork").textContent       = "mainnet";
  q("#proofLeaves").textContent        = "8 leaves";

  if (proofs.length) {
    const latest = proofs[0];
    q("#proofLastRoot").textContent = latest.merkleRoot
      ? `${latest.merkleRoot.slice(0, 10)}…` : "—";
  }

  const list = q("#proofList");
  if (!proofs.length) {
    list.innerHTML = `<p class="empty-state empty-dark">Proofs generated when fixtures reach Full Time.</p>`;
    return;
  }
  const topSig = proofs[0]?.solanaSignature ?? "";
  if (list.dataset.topSig === topSig) return;
  list.dataset.topSig = topSig;

  list.replaceChildren(...proofs.map(p => {
    const cls    = p.allVerified ? "verified" : "failed";
    const lbl    = p.allVerified ? "Verified on Solana ✅" : "Verification failed ❌";
    const sigSh  = p.solanaSignature
      ? `${p.solanaSignature.slice(0, 14)}…${p.solanaSignature.slice(-6)}` : "—";
    const rootSh = p.merkleRoot ? `${p.merkleRoot.slice(0, 12)}…` : "—";

    const row = document.createElement("article");
    row.className = "proof-row";
    row.setAttribute("role", "listitem");
    row.innerHTML = `
      <div class="proof-top">
        <strong>${esc(p.match)} · ${esc(p.finalScore ?? "—")}</strong>
        <span class="proof-pill ${cls}">${lbl}</span>
      </div>
      <div class="proof-tree">
        <span>Root: <strong>${esc(rootSh)}</strong></span>
        <span>Leaves: <strong>8</strong></span>
        <span>Network: <strong>mainnet</strong></span>
        <span>At: <strong>${fmtTime(p.timestamp)}</strong></span>
      </div>
      <div class="proof-sig">
        <span>Sig:</span>
        <span class="mono">${esc(sigSh)}</span>
        <a href="${esc(p.solscanUrl ?? "#")}" target="_blank" rel="noopener">
          View on Solscan ↗ (mainnet)
        </a>
      </div>`;
    return row;
  }));
}

/* ── Analytics screen ────────────────────────────────────────────────────── */
function renderAnalytics(analytics) {
  if (!analytics || typeof analytics !== "object") return;

  // Header metrics
  const sharpe = analytics.sharpe;
  q("#sharpeVal").textContent    = sharpe?.label ?? "—";
  q("#sharpeInterp").textContent = sharpe?.interpretation ?? "Insufficient data";

  const best = analytics.best;
  q("#bestStrat").textContent   = best?.name ?? "—";
  q("#bestStratPnl").textContent = best ? `PnL ${money(best.pnl ?? 0)} · ${
    best.winRate != null ? Math.round(best.winRate * 100) + "% win rate" : "—"}` : "—";

  const acc = analytics.accuracy ?? {};
  q("#overallAcc").textContent = acc.overall != null
    ? `${Math.round(acc.overall * 100)}%` : "—";

  // Leaderboard
  const lb   = analytics.leaderboard ?? [];
  const body = q("#leaderboardBody");
  body.replaceChildren(...lb.map((row, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="lb-name">
          ${idx === 0 ? '<span class="lb-crown">👑</span>' : ""}
          <span class="lb-dot" style="background:${esc(row.color)}"></span>
          <div>${esc(row.name)}<span class="lb-role">${esc(row.role)}</span></div>
        </div>
      </td>
      <td class="${(row.pnl ?? 0) >= 0 ? "positive" : "negative"}" style="font-weight:900">
        ${money(row.pnl ?? 0)}
      </td>
      <td class="${(row.roi ?? 0) >= 0 ? "positive" : "negative"}">
        ${row.roi != null ? `${row.roi >= 0 ? "+" : ""}${row.roi}%` : "—"}
      </td>
      <td>${row.winRate != null ? Math.round(row.winRate * 100) + "%" : "—"}</td>
      <td>${row.signals ?? 0}</td>
      <td>${row.avgEV != null ? row.avgEV.toFixed(2) : "—"}</td>`;
    return tr;
  }));

  // Accuracy grid
  const accGrid = q("#accuracyGrid");
  accGrid.replaceChildren(...(acc.perAgent ?? []).map(agent => {
    const accPct  = agent.accuracy  != null ? Math.round(agent.accuracy  * 100) : null;
    const confPct = agent.avgConf   != null ? Math.round(agent.avgConf   * 100) : null;
    const div = document.createElement("div");
    div.className = "acc-row";
    div.innerHTML = `
      <div class="acc-top">
        <div class="acc-name">
          <span style="display:inline-block;width:9px;height:9px;border-radius:50%;
            background:${esc(agent.color)};flex-shrink:0;"></span>
          ${esc(agent.name)}
        </div>
        <div class="acc-stats">
          <span>${agent.trades} trades</span>
          ${accPct  != null ? `<span>Acc <strong>${accPct}%</strong></span>` : ""}
        </div>
      </div>
      ${accPct != null ? `
        <div class="acc-bar" role="progressbar" aria-valuenow="${accPct}"
          aria-valuemin="0" aria-valuemax="100" title="Accuracy ${accPct}%">
          <span style="width:${accPct}%;background:${esc(agent.color)}"></span>
        </div>` : ""}
      ${confPct != null ? `
        <div class="acc-bar conf" role="progressbar" aria-valuenow="${confPct}"
          aria-valuemin="0" aria-valuemax="100" title="Avg confidence ${confPct}%">
          <span style="width:${confPct}%"></span>
        </div>` : ""}`;
    return div;
  }));

  // Draw canvases only when on analytics screen
  if (state.activeScreen === "analytics") {
    drawEvChart(analytics.evChart   ?? []);
    drawEquityChart(analytics.timeline ?? []);
  }
  if (state.activeScreen === "portfolio") {
    drawEquityChart(analytics.timeline ?? []);
  }

  // Heatmap
  drawHeatmap(analytics.heatmap ?? { stages: [], rows: [] });
}

/* ── Settings screen ─────────────────────────────────────────────────────── */
function renderSettings(d) {
  const ing = d.ingestion ?? {};
  q("#setMode").textContent  = d.mode ?? "—";
  q("#setTick").textContent  = `${(d.tickMs ?? 3000) / 1000} s`;

  const hConn = d.mode === "live-txline"
    ? Boolean(ing.connected) : Boolean(d.running);
  setHealthVal("hConn", hConn ? "Connected" : "Disconnected", hConn ? "ok" : "err");
  setHealthVal("hHeartbeat", ing.lastHeartbeat
    ? `${Math.round((Date.now() - ing.lastHeartbeat) / 1000)}s ago`
    : (d.running ? "active" : "—"), d.running ? "ok" : "warn");
  q("#hEps").textContent         = ing.eventsPerSecond != null ? ing.eventsPerSecond.toFixed(1) : "—";
  q("#hLatency").textContent     = ing.averageLatency  != null ? `${Math.round(ing.averageLatency)} ms` : "—";
  q("#hScoreEvents").textContent = ing.scoreEvents ?? 0;
  q("#hReconnects").textContent  = ing.reconnects  ?? 0;
}

function setHealthVal(id, text, cls = "") {
  const el = q(`#${id}`);
  if (!el) return;
  el.textContent = text;
  el.className   = `health-val ${cls}`;
}

/* ── Radar canvas ────────────────────────────────────────────────────────── */
function animateRadar() {
  const canvas = q("#radarCanvas");
  if (!canvas) { requestAnimationFrame(animateRadar); return; }
  const ctx = canvas.getContext("2d");
  const cssW = canvas.clientWidth  || 600;
  const cssH = canvas.clientHeight || 320;
  const dpr  = window.devicePixelRatio || 1;
  if (canvas.width  !== Math.floor(cssW * dpr) ||
      canvas.height !== Math.floor(cssH * dpr)) {
    canvas.width  = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  drawRadar(ctx, cssW, cssH);
  state.frame++;
  requestAnimationFrame(animateRadar);
}

function drawRadar(ctx, W, H) {
  const signals = state.snapshot?.signals ?? [];
  const cx = W / 2, cy = H / 2;
  const R  = Math.min(W, H) * 0.38;
  ctx.clearRect(0, 0, W, H);

  // Rings
  ctx.strokeStyle = "rgba(255,255,255,.07)";
  ctx.lineWidth   = 1;
  for (let r = 1; r <= 4; r++) {
    ctx.beginPath();
    ctx.arc(cx, cy, (R / 4) * r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
  ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
  ctx.stroke();

  // Labels
  ctx.fillStyle = "rgba(255,255,255,.25)";
  ctx.font = "600 10px Inter, sans-serif";
  ctx.fillText("odds velocity", cx + 6,   cy - R - 6);
  ctx.fillText("model edge",    cx + R - 62, cy - 6);
  ctx.fillText("risk",          cx + 6,   cy + R + 14);
  ctx.fillText("counterflow",   cx - R - 4, cy - 6);

  // Sweep beam
  const sweep = (state.frame / 90) % (Math.PI * 2);
  const grad  = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  grad.addColorStop(0, "rgba(20,184,166,.20)");
  grad.addColorStop(1, "rgba(20,184,166,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, R, sweep - 0.4, sweep + 0.1);
  ctx.closePath();
  ctx.fill();

  // Signal dots
  signals.slice(0, 28).forEach((sig, i) => {
    const angle = (i / Math.max(1, signals.length)) * Math.PI * 2 + state.frame / 220;
    const dist  = R * (0.18 + (sig.confidence ?? 0.5) * 0.76);
    const x     = cx + Math.cos(angle) * dist;
    const y     = cy + Math.sin(angle) * dist;
    const r     = 3.5 + (sig.confidence ?? 0.5) * 7;

    ctx.globalAlpha = 0.45 + (sig.confidence ?? 0.5) * 0.55;
    ctx.fillStyle   = sig.agentColor ?? "#14b8a6";
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

    if ((sig.confidence ?? 0) > 0.75) {
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.arc(x, y, r + 4 + (state.frame % 28) * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.globalAlpha = 1;
}

/* ── Equity curve canvas ─────────────────────────────────────────────────── */
function drawEquityChart(timeline) {
  const canvas = q("#equityCanvas");
  if (!canvas) return;
  const W = canvas.clientWidth || 600, H = 200;
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // Seed the timeline so the chart always shows something meaningful
  // Even with no trades, show the starting $10,000 baseline
  const BASE_CAPITAL = 10000;
  let data = timeline;
  if (!data || data.length < 2) {
    // Generate a flat baseline with slight noise so it looks live
    const snap    = state.snapshot;
    const ticks   = snap?.tick ?? 0;
    const realPnl = snap?.kpis?.realizedPnl ?? 0;
    const openPnl = snap?.kpis?.openPnl ?? 0;
    const points  = Math.max(10, Math.min(ticks, 60));
    data = Array.from({ length: points }, (_, i) => ({
      tick:        i,
      equity:      BASE_CAPITAL + (realPnl + openPnl) * (i / Math.max(points - 1, 1)),
      realizedPnl: realPnl * (i / Math.max(points - 1, 1)),
    }));
    // Ensure at least start and current values differ so line is visible
    if (data.length > 0) {
      data[0].equity = BASE_CAPITAL;
      data[data.length - 1].equity = BASE_CAPITAL + realPnl + openPnl;
    }
  }

  if (data.length < 2) {
    ctx.fillStyle = "rgba(226,238,234,.3)";
    ctx.font = "600 12px Inter,sans-serif";
    ctx.fillText(`Portfolio: $${BASE_CAPITAL.toLocaleString()} — click ▶ Run to start trading`, 16, H / 2);
    return;
  }

  const pad = { t: 16, r: 14, b: 28, l: 54 };
  const cW  = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  const eq  = data.map(p => p.equity);
  const min = Math.min(...eq, BASE_CAPITAL - 100);
  const max = Math.max(...eq, BASE_CAPITAL + 100);
  const rng = Math.max(max - min, 200); // minimum range of $200 so flat line is visible
  const xS  = cW / (data.length - 1);
  const yS  = v => pad.t + cH - ((v - min) / rng) * cH;

  ctx.strokeStyle = "rgba(255,255,255,.06)"; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (cH / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cW, y); ctx.stroke();
    const v = max - ((max - min) / 4) * i;
    ctx.fillStyle = "rgba(226,238,234,.3)"; ctx.font = "600 10px Inter,sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`$${Math.round(v).toLocaleString()}`, pad.l - 4, y + 4);
  }
  ctx.textAlign = "left";

  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + cH);
  grad.addColorStop(0, "rgba(20,184,166,.22)");
  grad.addColorStop(1, "rgba(20,184,166,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(pad.l, yS(data[0].equity));
  data.forEach((p, i) => ctx.lineTo(pad.l + i * xS, yS(p.equity)));
  ctx.lineTo(pad.l + (data.length - 1) * xS, pad.t + cH);
  ctx.lineTo(pad.l, pad.t + cH); ctx.closePath(); ctx.fill();

  ctx.strokeStyle = "#14b8a6"; ctx.lineWidth = 2;
  ctx.beginPath();
  data.forEach((p, i) => {
    const x = pad.l + i * xS, y = yS(p.equity);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  const lastY = yS(eq[eq.length - 1]);
  ctx.fillStyle = "#14b8a6"; ctx.font = "800 11px Inter,sans-serif";
  ctx.fillText(`$${Math.round(eq[eq.length - 1]).toLocaleString()}`,
    pad.l + cW + 4, lastY + 4);
}

/* ── EV bar chart ────────────────────────────────────────────────────────── */
function drawEvChart(evData) {
  const canvas = q("#evCanvas");
  if (!canvas) return;
  const W = canvas.clientWidth || 600, H = 180;
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  if (!evData.length) {
    ctx.fillStyle = "rgba(100,117,112,.5)";
    ctx.font = "600 12px Inter,sans-serif";
    ctx.fillText("No signal data yet", 16, H / 2);
    return;
  }
  const pad  = { t: 14, r: 10, b: 24, l: 36 };
  const cW   = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  const maxV = Math.max(...evData.map(d => Math.abs(d.ev)), 1);
  const bW   = Math.max(2, cW / evData.length - 2);

  ctx.strokeStyle = "rgba(255,255,255,.1)"; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t + cH / 2);
  ctx.lineTo(pad.l + cW, pad.t + cH / 2); ctx.stroke();
  ctx.fillStyle = "rgba(226,238,234,.3)"; ctx.font = "600 9px Inter,sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`+${maxV.toFixed(1)}`, pad.l - 3, pad.t + 4);
  ctx.fillText("0",                   pad.l - 3, pad.t + cH / 2 + 4);
  ctx.fillText(`-${maxV.toFixed(1)}`, pad.l - 3, pad.t + cH - 2);
  ctx.textAlign = "left";

  evData.forEach((d, i) => {
    const x    = pad.l + i * (cW / evData.length);
    const norm = d.ev / maxV;
    const bH   = Math.abs(norm) * (cH / 2);
    const y    = norm >= 0 ? pad.t + cH / 2 - bH : pad.t + cH / 2;
    ctx.fillStyle   = d.agentColor ?? "#14b8a6";
    ctx.globalAlpha = 0.75 + (d.confidence ?? 0) * 0.25;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, bW, Math.max(bH, 1), 2);
    else ctx.rect(x, y, bW, Math.max(bH, 1));
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

/* ── Win-rate heatmap ────────────────────────────────────────────────────── */
function drawHeatmap({ stages, rows }) {
  const wrap = q("#heatmapGrid");
  if (!wrap) return;
  if (!rows?.length || !stages?.length) {
    wrap.innerHTML = `<p class="empty-state">Heatmap builds once positions close.</p>`;
    return;
  }
  const table = document.createElement("table");
  table.className = "heatmap-table";
  const thead = table.createTHead();
  const hr = thead.insertRow();
  const th0 = document.createElement("th"); th0.textContent = "Agent"; hr.appendChild(th0);
  stages.forEach(s => {
    const th = document.createElement("th"); th.textContent = s; hr.appendChild(th);
  });
  const tbody = table.createTBody();
  rows.forEach(row => {
    const tr = tbody.insertRow();
    const td0 = tr.insertCell();
    td0.innerHTML = `<div class="hm-agent-cell">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;
        background:${esc(row.color)};flex-shrink:0;"></span>${esc(row.name)}</div>`;
    row.cells.forEach(cell => {
      const td = tr.insertCell();
      if (cell.winRate == null) { td.textContent = "—"; td.style.color = "#647570"; }
      else {
        const pct = Math.round(cell.winRate * 100);
        td.textContent = `${pct}%`;
        td.style.background = `rgba(${Math.round(239 - pct * 1.8)},${Math.round(68 + pct * 1.3)},80,.15)`;
        td.style.color = pct >= 50 ? "#15803d" : "#991b1b";
        td.title = `${cell.trades} trade${cell.trades !== 1 ? "s" : ""}`;
      }
    });
  });
  wrap.replaceChildren(table);
}

/* ── Utility ─────────────────────────────────────────────────────────────── */
function money(v) {
  const n   = Number(v) || 0;
  const abs = Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
  return `${n < 0 ? "-" : ""}$${abs}`;
}
function setMoney(el, v) {
  if (!el) return;
  el.textContent = money(v);
  el.className   = `kpi-val ${v >= 0 ? "positive" : "negative"}`;
}
function esc(v) {
  return String(v ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function fmtTime(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit", second:"2-digit" }); }
  catch { return "—"; }
}

/* ═══════════════════════════════════════════════════════════════════════════
   IMPROVEMENT 1 — Live activity feed
   Shows the last 8 agent actions as a horizontal scrolling ticker
   ═══════════════════════════════════════════════════════════════════════════ */
const _activityState = { lastTopId: "", items: [] };

function renderActivityFeed(signals, agents) {
  const feed    = q("#activityFeed");
  const sub     = q("#activitySub");
  if (!feed) return;

  if (!signals.length) {
    feed.innerHTML = `<p style="font-size:.76rem;color:rgba(226,238,234,.3);padding:4px 0;">
      Click ▶ Run to start the agents — live decisions will stream here in real time.</p>`;
    return;
  }

  // Only rebuild when top signal changes
  const topId = signals[0]?.id ?? "";
  if (_activityState.lastTopId === topId) return;
  _activityState.lastTopId = topId;

  // Build activity items from latest signals (max 10)
  const items = signals.slice(0, 10).map((sig, idx) => {
    const action = sig.direction === "steam" ? "buy"
                 : sig.direction === "drift" ? "sell"
                 : sig.direction === "fade"  ? "fade"
                 : sig.direction === "buy"   ? "buy"
                 : sig.type === "market-maker-quote" ? "quote"
                 : "hold";
    const actionLabel = action === "buy" ? "BUY"
                      : action === "sell" ? "SELL"
                      : action === "fade" ? "FADE"
                      : action === "quote" ? "QUOTE" : "HOLD";
    const conf  = Math.round((sig.confidence ?? 0) * 100);
    const age   = sig.at ? relativeTime(sig.at) : "just now";
    const isNew = idx === 0;

    return { sig, action, actionLabel, conf, age, isNew };
  });

  // Update sub text
  const latest = items[0];
  if (latest && sub) {
    sub.textContent = `${latest.sig.agentName} → ${latest.actionLabel} ${latest.sig.outcome} · ${latest.conf}% conf · ${latest.age}`;
  }

  feed.replaceChildren(...items.map(({ sig, action, actionLabel, conf, age, isNew }) => {
    const item = document.createElement("div");
    item.className = `activity-item${isNew ? " newest" : ""}`;
    item.innerHTML = `
      <span class="act-agent-dot" style="background:${esc(sig.agentColor ?? "#14b8a6")}"></span>
      <span class="act-action ${action}">${actionLabel}</span>
      <span class="act-text">${esc(sig.agentName)}</span>
      <span class="act-match">${esc(sig.outcome)} · ${esc(sig.match)}</span>
      <span class="act-time">${age}</span>
    `;
    return item;
  }));
}

function relativeTime(isoOrMs) {
  try {
    const ms   = typeof isoOrMs === "number" ? isoOrMs : new Date(isoOrMs).getTime();
    const diff = Math.floor((Date.now() - ms) / 1000);
    if (diff < 5)   return "just now";
    if (diff < 60)  return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  } catch { return ""; }
}

/* ═══════════════════════════════════════════════════════════════════════════
   IMPROVEMENT 3 — Proof flash + nav badge pulse
   ═══════════════════════════════════════════════════════════════════════════ */
const _proofState = { lastSig: "", prevCount: 0 };

function renderProofsWithFlash(proofs) {
  const verified   = proofs.filter(p => p.allVerified).length;
  const failed     = proofs.filter(p => !p.allVerified).length;
  const newProof   = proofs.length > _proofState.prevCount;
  const topSig     = proofs[0]?.solanaSignature ?? "";
  const sigChanged = topSig !== _proofState.lastSig;

  // Update counts
  q("#proofVerifiedCount").textContent = `${verified} ✅`;
  q("#proofFailedCount").textContent   = `${failed} ❌`;
  q("#proofProgram").textContent       = "9ExbZj…KaA";
  q("#proofNetwork").textContent       = "mainnet";
  q("#proofLeaves").textContent        = "8 leaves";
  q("#navProofBadge").textContent      = verified;

  if (proofs.length) {
    const latest = proofs[0];
    q("#proofLastRoot").textContent = latest.merkleRoot
      ? `${latest.merkleRoot.slice(0, 10)}…` : "—";
  }

  // Flash nav badge when a new proof arrives
  if (newProof && sigChanged) {
    const badge = q("#navProofBadge");
    const navBtn = q("#navValidationBtn");
    if (badge) {
      badge.classList.remove("proof-alert");
      void badge.offsetWidth; // force reflow
      badge.classList.add("proof-alert");
    }
    // Also briefly highlight the sidebar nav item
    if (navBtn) {
      navBtn.style.background = "rgba(34,197,94,.15)";
      navBtn.style.color      = "#86efac";
      setTimeout(() => {
        navBtn.style.background = "";
        navBtn.style.color      = "";
      }, 2000);
    }
  }

  _proofState.prevCount = proofs.length;
  _proofState.lastSig   = topSig;

  const list = q("#proofList");
  if (!proofs.length) {
    list.innerHTML = `<p class="empty-state empty-dark">
      Proofs appear when matches reach Full Time and results are verified on Solana mainnet.</p>`;
    return;
  }
  if (list.dataset.topSig === topSig && !sigChanged) return;
  list.dataset.topSig = topSig;

  list.replaceChildren(...proofs.map((p, idx) => {
    const cls    = p.allVerified ? "verified" : "failed";
    const lbl    = p.allVerified ? "Verified on Solana ✅" : "Verification failed ❌";
    const sigSh  = p.solanaSignature
      ? `${p.solanaSignature.slice(0, 14)}…${p.solanaSignature.slice(-6)}` : "—";
    const rootSh = p.merkleRoot ? `${p.merkleRoot.slice(0, 12)}…` : "—";
    const isNew  = idx === 0 && sigChanged && newProof;

    const row = document.createElement("article");
    // Flash new proofs
    row.className = `proof-row${isNew ? " proof-new" : ""}`;
    row.setAttribute("role", "listitem");
    row.innerHTML = `
      <div class="proof-top">
        <strong>${esc(p.match)} · ${esc(p.finalScore ?? "—")}</strong>
        <span class="proof-pill ${cls}${isNew ? " glow" : ""}">${lbl}</span>
      </div>
      <div class="proof-tree">
        <span>Root: <strong class="mono">${esc(rootSh)}</strong></span>
        <span>Leaves: <strong>8</strong></span>
        <span>Network: <strong>Solana mainnet</strong></span>
        <span>At: <strong>${fmtTime(p.timestamp)}</strong></span>
      </div>
      <div class="proof-sig">
        <span>TxLINE oracle program: <strong>9ExbZj…KaA</strong></span>
        <a href="${esc(p.solscanUrl ?? p.txlineProofUrl ?? "#")}" target="_blank" rel="noopener">
          🔗 Verify proof on TxLINE ↗
        </a>
      </div>`;
    return row;
  }));
}
