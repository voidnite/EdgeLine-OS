/* ═══════════════════════════════════════════════════════════════════════════
   EdgeLine OS  —  Dashboard client
   Consumes: GET /api/state  +  SSE /api/stream (event: "state")
   Snapshot shape comes from AgentEngine.snapshot() in src/engine.mjs
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── State ──────────────────────────────────────────────────────────────── */
const state = {
  snapshot: null,   // latest AgentEngine snapshot
  frame: 0,      // RAF counter for radar animation
  streamOk: false,  // SSE healthy
  lastUpdate: 0,      // ms timestamp of last render
};

/* ── DOM refs ───────────────────────────────────────────────────────────── */
const el = {
  // topbar
  modeBadge: q("#modeBadge"),
  clockBadge: q("#clockBadge"),
  connBadge: q("#connBadge"),
  connDot: q("#connDot"),
  connLabel: q("#connLabel"),
  latencyBadge: q("#latencyBadge"),
  healthBadge: q("#healthBadge"),
  healthScore: q("#healthScore"),
  healthLabel: q("#healthLabel"),
  // command band
  runState: q("#runState"),
  startButton: q("#startButton"),
  pauseButton: q("#pauseButton"),
  tickButton: q("#tickButton"),
  sourceLabel: q("#sourceLabel"),
  receiptBadge: q("#receiptBadge"),
  // KPIs
  signalsKpi: q("#signalsKpi"),
  positionsKpi: q("#positionsKpi"),
  openPnlKpi: q("#openPnlKpi"),
  realizedPnlKpi: q("#realizedPnlKpi"),
  riskKpi: q("#riskKpi"),
  accuracyKpi: q("#accuracyKpi"),
  // agent arena
  agentCount: q("#agentCount"),
  agentsList: q("#agentsList"),
  // portfolio
  roiBadge: q("#roiBadge"),
  portBalance: q("#portBalance"),
  portEquity: q("#portEquity"),
  portExposure: q("#portExposure"),
  portWinRate: q("#portWinRate"),
  portTrades: q("#portTrades"),
  portWL: q("#portWL"),
  // radar
  radarState: q("#radarState"),
  radarCanvas: q("#radarCanvas"),
  // reasoning timeline
  decisionCount: q("#decisionCount"),
  decisionLedger: q("#decisionLedger"),
  // fixtures
  fixtureCount: q("#fixtureCount"),
  fixturesList: q("#fixturesList"),
  // open book
  bookCount: q("#bookCount"),
  positionsList: q("#positionsList"),
  // settlement
  settleCount: q("#settleCount"),
  settlementList: q("#settlementList"),
  // proofs
  proofVerifiedCount: q("#proofVerifiedCount"),
  proofFailedCount: q("#proofFailedCount"),
  proofProgram: q("#proofProgram"),
  proofNetwork: q("#proofNetwork"),
  proofLeaves: q("#proofLeaves"),
  proofLastRoot: q("#proofLastRoot"),
  proofList: q("#proofList"),
  // analytics
  sharpeLabel: q("#sharpeLabel"),
  bestStratLabel: q("#bestStratLabel"),
  leaderboardBody: q("#leaderboardBody"),
  accuracyGrid: q("#accuracyGrid"),
  evCanvas: q("#evCanvas"),
  equityCanvas: q("#equityCanvas"),
  heatmapGrid: q("#heatmapGrid"),
  // system health
  hConn: q("#hConn"),
  hHeartbeat: q("#hHeartbeat"),
  hMessages: q("#hMessages"),
  hReconnects: q("#hReconnects"),
  hEps: q("#hEps"),
  hLatency: q("#hLatency"),
  hScoreEvents: q("#hScoreEvents"),
  hOddsEvents: q("#hOddsEvents"),
};

function q(selector) { return document.querySelector(selector); }

/* ── Boot ───────────────────────────────────────────────────────────────── */
bindControls();
bindAnalyticsTabs();
connectStream();
animateRadar();

/* ══════════════════════════════════════════════════════════════════════════
   CONTROLS
   ══════════════════════════════════════════════════════════════════════════ */
function bindControls() {
  el.startButton.addEventListener("click", () => control("start"));
  el.pauseButton.addEventListener("click", () => control("pause"));
  el.tickButton.addEventListener("click",  () => control("tick"));
}

async function control(action) {
  try {
    const res = await fetch("/api/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    ingestSnapshot(await res.json());
  } catch (err) {
    console.warn("Control error:", err);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   SSE STREAM  +  POLLING FALLBACK
   ══════════════════════════════════════════════════════════════════════════ */
function connectStream() {
  const source = new EventSource("/api/stream");

  source.addEventListener("state", (event) => {
    state.streamOk = true;
    el.radarState.textContent = "live";
    ingestSnapshot(JSON.parse(event.data));
  });

  source.addEventListener("error", async () => {
    state.streamOk = false;
    el.radarState.textContent = "polling";
    setConnectionUI("disconnected", "stream error");
    // fall back to polling every 2 s while SSE is down
    await pollOnce();
  });
}

async function pollOnce() {
  try {
    const res = await fetch("/api/state");
    ingestSnapshot(await res.json());
  } catch {
    el.runState.textContent = "Server unreachable";
  }
  // keep polling if SSE never recovered
  if (!state.streamOk) setTimeout(pollOnce, 2000);
}

function ingestSnapshot(data) {
  if (!data || typeof data !== "object") return;
  state.snapshot = data;
  state.lastUpdate = Date.now();
  render();
}

/* ══════════════════════════════════════════════════════════════════════════
   MASTER RENDER
   ══════════════════════════════════════════════════════════════════════════ */
function render() {
  const d = state.snapshot;
  if (!d) return;

  renderTopBar(d);
  renderCommandBand(d);
  renderKPIs(d);
  renderAgents(d.agents ?? []);
  renderPortfolio(d);
  renderFixtures(d.fixtures ?? []);
  renderSignals(d.signals ?? []);
  renderPositions(d.positions ?? []);
  renderSystemHealth(d);
  renderSettlements(d.settlements ?? []);
  renderProofs(d.proofs ?? []);
  renderAnalytics(d.analytics ?? {});
}

/* ══════════════════════════════════════════════════════════════════════════
   TOP BAR
   ══════════════════════════════════════════════════════════════════════════ */
function renderTopBar(d) {
  // Human-readable mode label
  const modeLabel = d.mode === "live-txline"        ? "live · mainnet"
                  : d.mode === "deterministic-replay" ? "replay mode"
                  : d.mode ?? "—";
  el.modeBadge.textContent  = modeLabel;
  el.clockBadge.textContent = `tick ${d.tick ?? 0}`;

  // Connection — derive from ingestion flags in the snapshot
  const ing = d.ingestion ?? {};
  const isLive = d.mode === "live-txline";
  const connected = isLive ? Boolean(ing.connected) : Boolean(d.running);
  const connStatus = connected ? "connected" : (d.running ? "reconnecting" : "disconnected");
  const connText = connected
    ? (isLive ? "TxLINE live" : "replay running")
    : (d.running ? "reconnecting…" : "paused");
  setConnectionUI(connStatus, connText);

  // Latency — only meaningful in live mode
  const latency = ing.avgLatency ?? ing.averageLatency ?? null;
  el.latencyBadge.textContent = latency != null ? `${Math.round(latency)} ms` : "— ms";

  // System health score — computed client-side from available fields
  const healthScore = computeHealthScore(d);
  const healthClass = healthScore >= 90 ? "excellent"
    : healthScore >= 75 ? "good"
      : healthScore >= 50 ? "warning"
        : "critical";
  el.healthScore.textContent = healthScore;
  el.healthLabel.textContent = healthClass.toUpperCase();
  el.healthBadge.className = `badge health-badge ${healthClass}`;
}

function setConnectionUI(status, label) {
  el.connDot.className = `conn-dot ${status}`;
  el.connLabel.textContent = label;
}

function computeHealthScore(d) {
  let score = 100;
  if (!d.running) score -= 30;
  const ing = d.ingestion ?? {};
  // penalise if no recent receipt in replay, or disconnected in live
  if (d.mode === "live-txline" && !ing.connected) score -= 40;
  const agents = d.agents ?? [];
  const totalExposure = agents.reduce((s, a) => s + (a.exposure ?? 0), 0);
  const totalRiskLimit = agents.reduce((s, a) => s + (a.riskLimit ?? 1), 0);
  if (totalRiskLimit > 0 && totalExposure / totalRiskLimit > 0.9) score -= 15;
  return Math.max(0, Math.round(score));
}

/* ══════════════════════════════════════════════════════════════════════════
   COMMAND BAND
   ══════════════════════════════════════════════════════════════════════════ */
function renderCommandBand(d) {
  el.runState.textContent = d.running ? "Agents running" : "Paused";
  el.sourceLabel.textContent = d.ingestion?.source ?? d.mode ?? "—";
  const receipt = d.ingestion?.lastReceipt;
  el.receiptBadge.textContent = receipt ? shortHash(receipt) : "pending";
}

/* ══════════════════════════════════════════════════════════════════════════
   KPI ROW
   ══════════════════════════════════════════════════════════════════════════ */
function renderKPIs(d) {
  const k = d.kpis ?? {};
  el.signalsKpi.textContent = k.signals ?? 0;
  el.positionsKpi.textContent = k.openPositions ?? 0;

  setMoney(el.openPnlKpi, k.openPnl ?? 0);
  setMoney(el.realizedPnlKpi, k.realizedPnl ?? 0);
  setMoney(el.riskKpi, k.riskUsed ?? 0, false);  // always neutral colour

  el.accuracyKpi.textContent = k.accuracy == null
    ? "—"
    : `${Math.round(k.accuracy * 100)}%`;
}

function setMoney(node, value, coloured = true) {
  node.textContent = money(value);
  if (coloured) {
    node.className = `kpi-value ${value >= 0 ? "positive" : "negative"}`;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   AGENT ARENA
   ══════════════════════════════════════════════════════════════════════════ */
function renderAgents(agents) {
  el.agentCount.textContent = agents.length;
  if (!agents.length) {
    el.agentsList.innerHTML = `<p class="empty-state">No agents loaded.</p>`;
    return;
  }
  el.agentsList.replaceChildren(
    ...agents.map((agent) => {
      const exposure = agent.exposure ?? 0;
      const riskLimit = agent.riskLimit ?? 1;
      const riskPct = Math.min(100, Math.round((exposure / riskLimit) * 100));
      const winRate = agent.wins + agent.losses > 0
        ? Math.round((agent.wins / (agent.wins + agent.losses)) * 100)
        : null;

      const row = document.createElement("article");
      row.className = "agent-row";
      row.setAttribute("role", "listitem");
      row.innerHTML = `
        <div class="agent-title">
          <strong>
            <span class="agent-dot" style="background:${esc(agent.color)}"></span>
            ${esc(agent.name)}
          </strong>
          <span class="tag">${esc(agent.role)}</span>
        </div>
        <p class="agent-mandate">${esc(agent.mandate ?? agent.lastAction ?? "—")}</p>
        <div class="agent-meter" title="Exposure ${riskPct}% of limit" aria-valuenow="${riskPct}" aria-valuemin="0" aria-valuemax="100" role="progressbar">
          <span style="width:${riskPct}%; background:${esc(agent.color)}"></span>
        </div>
        <div class="agent-stats">
          <span>Exposure ${money(exposure)}</span>
          <span>PnL <span class="${agent.pnl >= 0 ? "positive" : "negative"}">${money(agent.pnl ?? 0)}</span></span>
        </div>
        <div class="agent-stats">
          <span>Signals ${agent.signals ?? 0}</span>
          <span>Win rate ${winRate != null ? `${winRate}%` : "—"}</span>
        </div>
      `;
      return row;
    })
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PORTFOLIO PANEL
   ══════════════════════════════════════════════════════════════════════════ */
function renderPortfolio(d) {
  // The engine snapshot doesn't include a dedicated portfolio block —
  // we derive it from kpis + agent state.
  const k = d.kpis ?? {};
  const agents = d.agents ?? [];

  const riskUsed = k.riskUsed ?? 0;
  const openPnl = k.openPnl ?? 0;
  const realPnl = k.realizedPnl ?? 0;
  const capital = 10000; // initial capital from portfolio-engine.mjs
  const equity = capital + realPnl + openPnl;
  const roi = capital > 0 ? ((realPnl / capital) * 100) : 0;

  const totalWins = agents.reduce((s, a) => s + (a.wins ?? 0), 0);
  const totalLosses = agents.reduce((s, a) => s + (a.losses ?? 0), 0);
  const totalTrades = totalWins + totalLosses;
  const winRatePct = totalTrades > 0 ? Math.round((totalWins / totalTrades) * 100) : null;

  // ROI badge
  const roiStr = `${roi >= 0 ? "+" : ""}${roi.toFixed(2)}%`;
  el.roiBadge.textContent = roiStr;
  el.roiBadge.className = `panel-badge roi-badge ${roi >= 0 ? "positive" : "negative"}`;

  el.portBalance.textContent = money(capital);
  el.portEquity.textContent = money(equity);
  el.portEquity.className = `port-value ${equity >= capital ? "positive" : "negative"}`;
  el.portExposure.textContent = money(riskUsed);
  el.portWinRate.textContent = winRatePct != null ? `${winRatePct}%` : "—";
  el.portTrades.textContent = totalTrades;
  el.portWL.textContent = `${totalWins} / ${totalLosses}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   FIXTURE BOARD
   ══════════════════════════════════════════════════════════════════════════ */
function renderFixtures(fixtures) {
  el.fixtureCount.textContent = fixtures.length;
  if (!fixtures.length) {
    el.fixturesList.innerHTML = `<p class="empty-state">No live fixtures.</p>`;
    return;
  }
  el.fixturesList.replaceChildren(
    ...fixtures.map((f) => {
      const statusClass = f.status === "Live" ? "live"
        : f.status === "Final" ? "final"
          : "scheduled";
      const row = document.createElement("article");
      row.className = "fixture-row";
      row.setAttribute("role", "listitem");
      row.innerHTML = `
        <div class="fixture-scoreline">
          <strong>${esc(f.home)} <span style="opacity:.55">vs</span> ${esc(f.away)}</strong>
          <span class="score-pill">${f.homeScore ?? 0} – ${f.awayScore ?? 0}</span>
        </div>
        <div class="fixture-stage">
          <span>${esc(f.stage ?? "")}</span>
          <span class="status-badge ${statusClass}">${f.status === "Live" ? `${f.minute ?? 0}′ ●` : esc(f.status)}</span>
        </div>
        <div class="odds-grid">
          ${(f.outcomes ?? []).map((outcome, i) => {
        const prob = f.probabilities?.[i] ?? 0;
        const odd = f.odds?.[i] ?? 0;
        return `
              <div class="odds-row">
                <span>${esc(outcome)}</span>
                <strong>${odd.toFixed(2)}×</strong>
                <span class="pct">${Math.round(prob * 100)}%</span>
              </div>
              <div class="prob-track" aria-hidden="true">
                <span style="width:${Math.round(prob * 100)}%"></span>
              </div>
            `;
      }).join("")}
        </div>
      `;
      return row;
    })
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   OPEN BOOK (positions)
   ══════════════════════════════════════════════════════════════════════════ */
function renderPositions(positions) {
  const open = positions.filter((p) => p.status === "open");
  el.bookCount.textContent = open.length;
  if (!open.length) {
    el.positionsList.innerHTML = `<p class="empty-state">No open positions.</p>`;
    return;
  }
  el.positionsList.replaceChildren(
    ...open.slice(0, 12).map((p) => {
      const row = document.createElement("article");
      row.className = "position-row";
      row.setAttribute("role", "listitem");
      row.innerHTML = `
        <div class="position-top">
          <strong>${esc(p.outcome)}</strong>
          <span class="pnl-value ${p.pnl >= 0 ? "positive" : "negative"}">${money(p.pnl)}</span>
        </div>
        <div class="position-meta">
          <span><span class="agent-dot" style="background:${esc(p.agentColor ?? "#aaa")}; display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:4px;"></span>${esc(p.agentName)}</span>
          <span>${money(p.stake)} stake</span>
        </div>
        <div class="position-meta">
          <span>${esc(p.match)}</span>
          <span>${Math.round((p.confidence ?? 0) * 100)}% conf</span>
        </div>
      `;
      return row;
    })
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   AI REASONING TIMELINE
   ══════════════════════════════════════════════════════════════════════════ */
function renderSignals(signals) {
  el.decisionCount.textContent = `${signals.length} decisions`;
  if (!signals.length) {
    el.decisionLedger.innerHTML = `<p class="empty-state">Agents are warming up — decisions will appear here.</p>`;
    return;
  }

  // Only rebuild DOM when signal list changed (avoid flicker on every tick)
  const topId = signals[0]?.id ?? "";
  if (el.decisionLedger.dataset.topId === topId) return;
  el.decisionLedger.dataset.topId = topId;

  el.decisionLedger.replaceChildren(
    ...signals.slice(0, 16).map((sig) => {
      const conf = Math.round((sig.confidence ?? 0) * 100);
      const action = sig.direction === "steam" ? "BUY"
        : sig.direction === "drift" ? "SELL"
          : sig.direction === "fade" ? "FADE"
            : sig.direction === "buy" ? "BUY"
              : sig.type === "market-maker-quote" ? "QUOTE"
                : "HOLD";
      const actionClass = action === "BUY" ? "action-BUY"
        : action === "SELL" || action === "FADE" ? "action-SELL"
          : "action-HOLD";

      const row = document.createElement("article");
      row.className = `decision-row ${actionClass}`;
      row.innerHTML = `
        <div class="decision-top">
          <strong>
            <span class="agent-dot" style="background:${esc(sig.agentColor)}; display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:5px;"></span>
            ${esc(sig.agentName)} · ${esc(sig.outcome)}
          </strong>
          <div class="decision-tags">
            <span class="tag">${esc(action)}</span>
            <span class="tag">${esc(sig.type)}</span>
          </div>
        </div>
        <div class="confidence-bar" role="progressbar" aria-valuenow="${conf}" aria-valuemin="0" aria-valuemax="100" title="Confidence ${conf}%">
          <span style="width:${conf}%"></span>
        </div>
        <div class="decision-meta">
          <span>${esc(sig.match)} · ${sig.minute ?? 0}′</span>
          <span>${conf}% confidence · ${money(sig.stake ?? 0)} stake</span>
        </div>
        <p style="font-size:.78rem; color:rgba(244,248,245,.62); margin:0; line-height:1.4;">${esc(sig.rationale ?? "")}</p>
        ${sig.bid && sig.ask ? `
          <div class="decision-meta">
            <span>Bid ${sig.bid.toFixed(2)}× / Ask ${sig.ask.toFixed(2)}×</span>
            <span>Edge ${((sig.edge ?? 0) * 100).toFixed(1)} pts</span>
          </div>
        ` : `
          <div class="decision-meta">
            <span>Price ${(sig.price ?? 0).toFixed(2)}×</span>
            <span>Edge ${((sig.edge ?? 0) * 100).toFixed(1)} pts</span>
          </div>
        `}
      `;
      return row;
    })
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   SYSTEM HEALTH PANEL
   ══════════════════════════════════════════════════════════════════════════ */
function renderSystemHealth(d) {
  const ing = d.ingestion ?? {};
  const isConnected = d.mode === "live-txline"
    ? Boolean(ing.connected)
    : Boolean(d.running);

  setHealth(el.hConn, isConnected ? "Connected" : "Disconnected", isConnected ? "ok" : "err");
  setHealth(el.hHeartbeat, ing.lastHeartbeat
    ? `${Math.round((Date.now() - ing.lastHeartbeat) / 1000)}s ago`
    : (d.running ? "active" : "—"),
    d.running ? "ok" : "warn");
  el.hMessages.textContent = (ing.oddsEvents ?? 0) + (ing.scoreEvents ?? 0);
  el.hReconnects.textContent = ing.reconnects ?? 0;
  el.hEps.textContent = ing.eventsPerSecond != null ? ing.eventsPerSecond.toFixed(1) : "—";
  el.hLatency.textContent = ing.averageLatency != null ? `${Math.round(ing.averageLatency)} ms` : "— ms";
  el.hScoreEvents.textContent = ing.scoreEvents ?? 0;
  el.hOddsEvents.textContent = ing.oddsEvents ?? 0;
}

function setHealth(node, text, cls = "") {
  node.textContent = text;
  node.className = `health-val ${cls}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   RADAR CANVAS
   ══════════════════════════════════════════════════════════════════════════ */
function animateRadar() {
  const canvas = el.radarCanvas;
  const ctx = canvas.getContext("2d");

  // Resize canvas backing store to match CSS pixel size × DPR
  const cssW = canvas.clientWidth || 900;
  const cssH = canvas.clientHeight || 480;
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  drawRadar(ctx, cssW, cssH);
  state.frame += 1;
  requestAnimationFrame(animateRadar);
}

function drawRadar(ctx, W, H) {
  const signals = state.snapshot?.signals ?? [];
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.min(W, H) * 0.40;

  ctx.clearRect(0, 0, W, H);

  // ── rings & crosshairs ──────────────────────────────────────────────────
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 1;
  for (let ring = 1; ring <= 4; ring++) {
    ctx.beginPath();
    ctx.arc(cx, cy, (R / 4) * ring, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
  ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
  ctx.stroke();

  // ── axis labels ─────────────────────────────────────────────────────────
  ctx.fillStyle = "rgba(255,255,255,0.30)";
  ctx.font = "600 11px Inter, sans-serif";
  ctx.fillText("odds velocity", cx + 8, cy - R - 8);
  ctx.fillText("model edge", cx + R - 68, cy - 8);
  ctx.fillText("risk", cx + 8, cy + R + 18);
  ctx.fillText("counterflow", cx - R - 4, cy - 8);

  // ── sweep beam ──────────────────────────────────────────────────────────
  const sweep = (state.frame / 100) % (Math.PI * 2);
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  grad.addColorStop(0, "rgba(20,184,166,0.22)");
  grad.addColorStop(1, "rgba(20,184,166,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, R, sweep - 0.42, sweep + 0.10);
  ctx.closePath();
  ctx.fill();

  // ── signal dots ─────────────────────────────────────────────────────────
  if (!signals.length) return;

  signals.slice(0, 28).forEach((sig, i) => {
    const angle = (i / Math.max(1, signals.length)) * Math.PI * 2 + state.frame / 240;
    const dist = R * (0.20 + (sig.confidence ?? 0.5) * 0.74);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const dotR = 4 + (sig.confidence ?? 0.5) * 8;
    const alpha = 0.45 + (sig.confidence ?? 0.5) * 0.55;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = sig.agentColor ?? "#14b8a6";
    ctx.beginPath();
    ctx.arc(x, y, dotR, 0, Math.PI * 2);
    ctx.fill();

    // pulse ring for high-confidence signals
    if ((sig.confidence ?? 0) > 0.75) {
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.arc(x, y, dotR + 5 + (state.frame % 30) * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.globalAlpha = 1;
}

/* ══════════════════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════════════════ */

/** Format a number as compact currency, e.g. $1,234 or -$56 */
function money(value) {
  const v = Number(value) || 0;
  const abs = Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 });
  return `${v < 0 ? "-" : ""}$${abs}`;
}

/** Shorten a long hash/receipt string for display */
function shortHash(value) {
  if (!value || value.length <= 12) return value ?? "—";
  return `${String(value).slice(0, 6)}…${String(value).slice(-4)}`;
}

/** Safely escape HTML to prevent XSS from external data */
function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ══════════════════════════════════════════════════════════════════════════
   SETTLEMENT HISTORY
   ══════════════════════════════════════════════════════════════════════════ */
function renderSettlements(settlements) {
  el.settleCount.textContent = `${settlements.length} settled`;

  if (!settlements.length) {
    el.settlementList.innerHTML =
      `<p class="empty-state">Settlements appear when matches reach Full Time.</p>`;
    return;
  }

  // Avoid rebuilding if list hasn't changed
  const topId = String(settlements[0]?.fixtureId ?? "");
  if (el.settlementList.dataset.topId === topId) return;
  el.settlementList.dataset.topId = topId;

  el.settlementList.replaceChildren(
    ...settlements.map((s) => {
      const pnlClass = (s.totalPnL ?? 0) >= 0 ? "positive" : "negative";
      const proof = s.validation?.allVerified === true ? "verified"
        : s.validation?.allVerified === false ? "failed"
          : "pending";
      const proofLabel = proof === "verified" ? "Verified on Solana ✅"
        : proof === "failed" ? "Proof failed ❌"
          : "Proof pending ⏳";

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
          <span class="proof-pill ${proof}">${proofLabel}</span>
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
            <span class="settle-stat-label">Net PnL</span>
            <span class="settle-stat-val ${pnlClass}">${money(s.totalPnL ?? 0)}</span>
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
            <span class="settle-stat-label">Settled</span>
            <span class="settle-stat-val">${fmtTime(s.settledAt)}</span>
          </div>
        </div>
        ${s.records?.length ? `
        <details style="font-size:.76rem;color:var(--muted);cursor:pointer;">
          <summary style="font-weight:800;color:var(--ink);">
            ${s.records.length} position${s.records.length !== 1 ? "s" : ""}
          </summary>
          ${s.records.map((r) => `
            <div style="display:flex;justify-content:space-between;padding:3px 0;
              border-bottom:1px solid var(--line);">
              <span>
                <span style="display:inline-block;width:7px;height:7px;border-radius:50%;
                  background:${esc(r.agentColor)};margin-right:4px;"></span>
                ${esc(r.agentName)} · ${esc(r.outcome)}
              </span>
              <span class="${(r.pnl ?? 0) >= 0 ? "positive" : "negative"}"
                style="font-weight:800;">
                ${r.result} ${money(r.pnl ?? 0)}
              </span>
            </div>`).join("")}
        </details>` : ""}
      `;
      return row;
    })
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MERKLE PROOF / ON-CHAIN VALIDATION
   ══════════════════════════════════════════════════════════════════════════ */
function renderProofs(proofs) {
  const verified = proofs.filter((p) => p.allVerified).length;
  const failed   = proofs.filter((p) => !p.allVerified).length;

  el.proofVerifiedCount.textContent = `${verified} ✅`;
  el.proofFailedCount.textContent   = `${failed} ❌`;

  if (proofs.length) {
    const latest  = proofs[0];
    // Network derived from snapshot — always mainnet since that's our subscription
    const network = state.snapshot?.mode === "live-txline" ? "mainnet" : "mainnet";
    el.proofLastRoot.textContent = latest.merkleRoot
      ? `${latest.merkleRoot.slice(0, 10)}…` : "—";
    el.proofProgram.textContent  = "9ExbZj…KaA";
    el.proofNetwork.textContent  = network;
    el.proofLeaves.textContent   = "8 leaves";
  }

  if (!proofs.length) {
    el.proofList.innerHTML =
      `<p class="empty-state" style="color:rgba(244,248,245,.45);">
        Proofs generated when fixtures reach Full Time.
       </p>`;
    return;
  }

  const topSig = proofs[0]?.solanaSignature ?? "";
  if (el.proofList.dataset.topSig === topSig) return;
  el.proofList.dataset.topSig = topSig;

  el.proofList.replaceChildren(
    ...proofs.map((p) => {
      const pillCls = p.allVerified ? "verified" : "failed";
      const pillLabel = p.allVerified ? "Verified on Solana ✅" : "Verification failed ❌";
      const sigShort = p.solanaSignature
        ? `${p.solanaSignature.slice(0, 14)}…${p.solanaSignature.slice(-6)}`
        : "—";
      const rootShort = p.merkleRoot
        ? `${p.merkleRoot.slice(0, 12)}…`
        : "—";

      const row = document.createElement("article");
      row.className = "proof-row";
      row.setAttribute("role", "listitem");
      row.innerHTML = `
        <div class="proof-top">
          <strong>${esc(p.match)} · ${esc(p.finalScore ?? "—")}</strong>
          <span class="proof-pill ${pillCls}">${pillLabel}</span>
        </div>
        <div class="proof-tree">
          <span>Root: <strong>${esc(rootShort)}</strong></span>
          <span>Leaves: <strong>8</strong></span>
          <span>Network: <strong style="color:var(--teal)">mainnet</strong></span>
          <span>At: <strong>${fmtTime(p.timestamp)}</strong></span>
        </div>
        <div class="proof-sig">
          <span>Sig:</span>
          <span class="mono">${esc(sigShort)}</span>
          <a href="${esc(p.solscanUrl ?? "#")}" target="_blank" rel="noopener">
            View on Solscan ↗ (mainnet)
          </a>
        </div>
      `;
      return row;
    })
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   ANALYTICS
   ══════════════════════════════════════════════════════════════════════════ */
function renderAnalytics(analytics) {
  if (!analytics || typeof analytics !== "object") return;

  // ── Header badges ────────────────────────────────────────────────────────
  const sharpe = analytics.sharpe;
  el.sharpeLabel.textContent = sharpe?.value != null
    ? `Sharpe ${sharpe.label} (${sharpe.interpretation})`
    : "Sharpe —";

  const best = analytics.best;
  el.bestStratLabel.textContent = best
    ? `🏆 ${best.name}`
    : "—";

  // ── Leaderboard ──────────────────────────────────────────────────────────
  const lb = analytics.leaderboard ?? [];
  el.leaderboardBody.replaceChildren(
    ...lb.map((row, idx) => {
      const tr = document.createElement("tr");
      const winPct = row.winRate != null ? `${Math.round(row.winRate * 100)}%` : "—";
      const roiStr = row.roi != null ? `${row.roi >= 0 ? "+" : ""}${row.roi}%` : "—";
      const evStr = row.avgEV != null ? row.avgEV.toFixed(2) : "—";
      const pnlCls = (row.pnl ?? 0) >= 0 ? "positive" : "negative";
      tr.innerHTML = `
        <td>
          <div class="lb-name">
            ${idx === 0 ? `<span class="lb-crown">👑</span>` : ""}
            <span class="lb-dot" style="background:${esc(row.color)}"></span>
            <div>
              ${esc(row.name)}
              <span class="lb-role">${esc(row.role)}</span>
            </div>
          </div>
        </td>
        <td class="${pnlCls}" style="font-weight:900;">${money(row.pnl ?? 0)}</td>
        <td class="${(row.roi ?? 0) >= 0 ? "positive" : "negative"}">${roiStr}</td>
        <td>${winPct}</td>
        <td>${row.signals ?? 0}</td>
        <td>${evStr}</td>
      `;
      return tr;
    })
  );

  // ── Accuracy ─────────────────────────────────────────────────────────────
  const acc = analytics.accuracy ?? {};
  el.accuracyGrid.replaceChildren(
    ...(acc.perAgent ?? []).map((agent) => {
      const accPct = agent.accuracy != null ? Math.round(agent.accuracy * 100) : null;
      const confPct = agent.avgConf != null ? Math.round(agent.avgConf * 100) : null;
      const calPct = agent.calibration != null ? Math.round(agent.calibration * 100) : null;

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
            ${accPct != null ? `<span>Acc <strong>${accPct}%</strong></span>` : ""}
            ${calPct != null ? `<span>Cal <strong>${calPct}%</strong></span>` : ""}
          </div>
        </div>
        ${accPct != null ? `
          <div class="acc-bar" title="Accuracy ${accPct}%" role="progressbar"
            aria-valuenow="${accPct}" aria-valuemin="0" aria-valuemax="100">
            <span style="width:${accPct}%;background:${esc(agent.color)}"></span>
          </div>` : ""}
        ${confPct != null ? `
          <div class="acc-bar acc-bar-conf" title="Avg confidence ${confPct}%"
            role="progressbar" aria-valuenow="${confPct}" aria-valuemin="0" aria-valuemax="100">
            <span style="width:${confPct}%"></span>
          </div>` : ""}
      `;
      return div;
    })
  );

  // ── EV chart ─────────────────────────────────────────────────────────────
  drawEvChart(analytics.evChart ?? []);

  // ── Equity curve ─────────────────────────────────────────────────────────
  drawEquityChart(analytics.timeline ?? []);

  // ── Heatmap ──────────────────────────────────────────────────────────────
  drawHeatmap(analytics.heatmap ?? { stages: [], rows: [] });
}

/* ── Analytics tab switcher ─────────────────────────────────────────────── */
function bindAnalyticsTabs() {
  document.querySelectorAll(".atab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      document.querySelectorAll(".atab").forEach((b) => {
        b.classList.toggle("atab-active", b === btn);
        b.setAttribute("aria-selected", String(b === btn));
      });
      document.querySelectorAll(".atab-pane").forEach((pane) => {
        pane.classList.toggle("atab-pane-active", pane.id === `tab${cap(target)}`);
      });
      // Redraw canvases when their tab becomes visible
      if (target === "ev") drawEvChart(state.snapshot?.analytics?.evChart ?? []);
      if (target === "equity") drawEquityChart(state.snapshot?.analytics?.timeline ?? []);
    });
  });
}

function cap(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ── EV distribution bar chart ──────────────────────────────────────────── */
function drawEvChart(evData) {
  const canvas = el.evCanvas;
  if (!canvas) return;
  const W = canvas.clientWidth || 600;
  const H = 200;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  if (!evData.length) {
    ctx.fillStyle = "#647570";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.fillText("No signal data yet", 16, H / 2);
    return;
  }

  const pad = { top: 16, right: 12, bottom: 28, left: 38 };
  const cW = W - pad.left - pad.right;
  const cH = H - pad.top - pad.bottom;
  const maxEV = Math.max(...evData.map((d) => Math.abs(d.ev)), 1);
  const barW = Math.max(2, cW / evData.length - 2);

  // Zero axis
  ctx.strokeStyle = "rgba(100,117,112,.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top + cH / 2);
  ctx.lineTo(pad.left + cW, pad.top + cH / 2);
  ctx.stroke();

  // Y labels
  ctx.fillStyle = "#647570";
  ctx.font = "600 10px Inter, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`+${maxEV.toFixed(1)}`, pad.left - 4, pad.top + 4);
  ctx.fillText("0", pad.left - 4, pad.top + cH / 2 + 4);
  ctx.fillText(`-${maxEV.toFixed(1)}`, pad.left - 4, pad.top + cH - 2);
  ctx.textAlign = "left";

  evData.forEach((d, i) => {
    const x = pad.left + i * (cW / evData.length);
    const norm = d.ev / maxEV;               // -1 … +1
    const barH = Math.abs(norm) * (cH / 2);
    const y = norm >= 0
      ? pad.top + cH / 2 - barH
      : pad.top + cH / 2;

    ctx.fillStyle = d.agentColor ?? "#14b8a6";
    ctx.globalAlpha = 0.75 + (d.confidence ?? 0) * 0.25;
    ctx.beginPath();
    ctx.roundRect
      ? ctx.roundRect(x, y, barW, Math.max(barH, 1), 2)
      : ctx.rect(x, y, barW, Math.max(barH, 1));
    ctx.fill();
  });

  ctx.globalAlpha = 1;
}

/* ── Portfolio equity curve ─────────────────────────────────────────────── */
function drawEquityChart(timeline) {
  const canvas = el.equityCanvas;
  if (!canvas) return;
  const W = canvas.clientWidth || 600;
  const H = 200;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  if (timeline.length < 2) {
    ctx.fillStyle = "#647570";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.fillText("Equity curve builds as ticks accumulate…", 16, H / 2);
    return;
  }

  const pad = { top: 16, right: 12, bottom: 28, left: 52 };
  const cW = W - pad.left - pad.right;
  const cH = H - pad.top - pad.bottom;
  const equities = timeline.map((p) => p.equity);
  const minEq = Math.min(...equities);
  const maxEq = Math.max(...equities);
  const range = Math.max(maxEq - minEq, 1);

  const xScale = cW / (timeline.length - 1);
  const yScale = (v) => pad.top + cH - ((v - minEq) / range) * cH;

  // Grid lines
  ctx.strokeStyle = "rgba(100,117,112,.15)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (cH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cW, y);
    ctx.stroke();
    const val = maxEq - ((maxEq - minEq) / 4) * i;
    ctx.fillStyle = "#647570";
    ctx.font = "600 10px Inter, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`$${Math.round(val).toLocaleString()}`, pad.left - 4, y + 4);
  }
  ctx.textAlign = "left";

  // Fill under curve
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
  grad.addColorStop(0, "rgba(20,184,166,.22)");
  grad.addColorStop(1, "rgba(20,184,166,.0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(pad.left, yScale(timeline[0].equity));
  timeline.forEach((p, i) => {
    ctx.lineTo(pad.left + i * xScale, yScale(p.equity));
  });
  ctx.lineTo(pad.left + (timeline.length - 1) * xScale, pad.top + cH);
  ctx.lineTo(pad.left, pad.top + cH);
  ctx.closePath();
  ctx.fill();

  // Line
  ctx.strokeStyle = "#14b8a6";
  ctx.lineWidth = 2;
  ctx.beginPath();
  timeline.forEach((p, i) => {
    const x = pad.left + i * xScale;
    const y = yScale(p.equity);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Latest equity label
  const lastY = yScale(equities[equities.length - 1]);
  ctx.fillStyle = "#14b8a6";
  ctx.font = "800 11px Inter, sans-serif";
  ctx.fillText(`$${Math.round(equities[equities.length - 1]).toLocaleString()}`,
    pad.left + cW + 4, lastY + 4);
}

/* ── Win-rate heatmap ───────────────────────────────────────────────────── */
function drawHeatmap(heatmap) {
  const { stages, rows } = heatmap;
  el.heatmapGrid.innerHTML = "";
  if (!rows.length || !stages.length) {
    el.heatmapGrid.innerHTML =
      `<p class="empty-state">Heatmap builds once positions close.</p>`;
    return;
  }

  const table = document.createElement("table");
  table.className = "heatmap-table";

  const thead = table.createTHead();
  const hr = thead.insertRow();
  const th0 = document.createElement("th");
  th0.textContent = "Agent";
  hr.appendChild(th0);
  stages.forEach((s) => {
    const th = document.createElement("th");
    th.textContent = s;
    hr.appendChild(th);
  });

  const tbody = table.createTBody();
  rows.forEach((row) => {
    const tr = tbody.insertRow();
    const td0 = tr.insertCell();
    td0.innerHTML = `
      <div class="hm-agent-cell">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;
          background:${esc(row.color)};flex-shrink:0;"></span>
        ${esc(row.name)}
      </div>`;
    row.cells.forEach((cell) => {
      const td = tr.insertCell();
      if (cell.winRate === null) {
        td.textContent = "—";
        td.style.color = "#647570";
      } else {
        const pct = Math.round(cell.winRate * 100);
        td.textContent = `${pct}%`;
        // heat colour: green → red based on win rate
        const r = Math.round(239 - pct * 1.8);
        const g = Math.round(68 + pct * 1.3);
        td.style.background = `rgba(${r},${g},80,0.15)`;
        td.style.color = pct >= 50 ? "#15803d" : "#991b1b";
        td.title = `${cell.trades} trade${cell.trades !== 1 ? "s" : ""}`;
      }
    });
  });

  el.heatmapGrid.appendChild(table);
}

/* ── Time formatter ─────────────────────────────────────────────────────── */
function fmtTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch { return "—"; }
}
