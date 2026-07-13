// src/analytics/analytics-engine.mjs
//
// Computes all analytics from the engine's live position + signal + agent state.
// Called every tick — all methods are pure computations, no side-effects.
//
// Provides:
//   sharpeRatio()        — annualised risk-adjusted return
//   strategyLeaderboard()— ranked list of strategies by PnL / win-rate / EV
//   portfolioTimeline()  — equity curve data points (for sparkline chart)
//   signalAccuracy()     — per-agent and overall prediction accuracy
//   expectedValueChart() — EV distribution across recent signals
//   winRateHeatmap()     — agent × outcome-type win-rate grid
//   summary()            — all of the above in one call

import { mean, round, stdev, sum } from "../math.mjs";

const RISK_FREE_RATE = 0.04;           // 4 % annual, used in Sharpe calc
const TICKS_PER_YEAR = 365 * 24 * 60; // approximate for normalisation

class AnalyticsEngine {
  constructor() {
    // Rolling equity curve — we store sampled snapshots
    this._equityCurve = [];   // [{ tick, equity, realizedPnl }]
    this._initialCapital = 10_000;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tick update — call this every engine tick
  // ─────────────────────────────────────────────────────────────────────────

  recordTick({ tick, agents, positions }) {
    const realizedPnl = round(sum(agents.map((a) => a.pnl ?? 0)), 2);
    const openPnl     = round(
      sum(positions.filter((p) => p.status === "open").map((p) => p.pnl ?? 0)),
      2
    );
    const equity = round(this._initialCapital + realizedPnl + openPnl, 2);

    this._equityCurve.push({ tick, equity, realizedPnl });

    // Keep last 120 ticks (enough for a sparkline)
    if (this._equityCurve.length > 120) {
      this._equityCurve.shift();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Sharpe Ratio
  // ─────────────────────────────────────────────────────────────────────────

  sharpeRatio() {
    if (this._equityCurve.length < 3) {
      return { value: null, label: "—", interpretation: "Insufficient data" };
    }

    // Tick-level returns: (equity[i] - equity[i-1]) / equity[i-1]
    const returns = [];
    for (let i = 1; i < this._equityCurve.length; i++) {
      const prev = this._equityCurve[i - 1].equity;
      const curr = this._equityCurve[i].equity;
      if (prev > 0) returns.push((curr - prev) / prev);
    }

    if (!returns.length) return { value: null, label: "—", interpretation: "No returns" };

    const avgReturn   = mean(returns);
    const returnStdev = stdev(returns);

    if (returnStdev === 0) {
      return { value: null, label: "—", interpretation: "No variance in returns" };
    }

    // Annualise: multiply by √(ticks_per_year)
    const annualisedAvg   = avgReturn   * TICKS_PER_YEAR;
    const annualisedStdev = returnStdev * Math.sqrt(TICKS_PER_YEAR);
    const sharpe          = round((annualisedAvg - RISK_FREE_RATE) / annualisedStdev, 3);

    const interpretation =
      sharpe >= 3   ? "Excellent"   :
      sharpe >= 2   ? "Very good"   :
      sharpe >= 1   ? "Good"        :
      sharpe >= 0   ? "Marginal"    :
                      "Negative";

    return { value: sharpe, label: sharpe.toFixed(2), interpretation };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Strategy Leaderboard
  // ─────────────────────────────────────────────────────────────────────────

  strategyLeaderboard(agents, positions) {
    // Build per-strategy stats from closed positions
    const closed    = positions.filter((p) => p.status === "won" || p.status === "lost");
    const byStrategy = new Map();

    for (const pos of closed) {
      const key = pos.agentId;
      if (!byStrategy.has(key)) {
        const agent = agents.find((a) => a.id === key);
        byStrategy.set(key, {
          agentId:    key,
          name:       agent?.name   ?? key,
          role:       agent?.role   ?? "—",
          color:      agent?.color  ?? "#14b8a6",
          wins:       0,
          losses:     0,
          pnl:        0,
          totalStake: 0,
          totalEV:    0,
          signals:    agent?.signals ?? 0,
        });
      }
      const row = byStrategy.get(key);
      if (pos.status === "won") row.wins++;
      else                       row.losses++;
      row.pnl        = round(row.pnl + (pos.pnl ?? 0), 2);
      row.totalStake = round(row.totalStake + (pos.stake ?? 0), 2);

      // EV contribution: confidence × edge approximation
      const ev = (pos.confidence ?? 0) * (pos.pnl ?? 0);
      row.totalEV = round(row.totalEV + ev, 2);
    }

    // Merge agents that have no closed positions yet
    for (const agent of agents) {
      if (!byStrategy.has(agent.id)) {
        byStrategy.set(agent.id, {
          agentId:    agent.id,
          name:       agent.name,
          role:       agent.role,
          color:      agent.color,
          wins:       agent.wins   ?? 0,
          losses:     agent.losses ?? 0,
          pnl:        agent.pnl    ?? 0,
          totalStake: 0,
          totalEV:    0,
          signals:    agent.signals ?? 0,
        });
      }
    }

    return [...byStrategy.values()]
      .map((row) => {
        const total   = row.wins + row.losses;
        const winRate = total > 0 ? round(row.wins / total, 3) : null;
        const roi     = row.totalStake > 0
          ? round((row.pnl / row.totalStake) * 100, 1)
          : null;
        const avgEV   = total > 0 ? round(row.totalEV / total, 2) : null;
        return { ...row, total, winRate, roi, avgEV };
      })
      .sort((a, b) => b.pnl - a.pnl);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Portfolio Timeline (equity curve for sparkline)
  // ─────────────────────────────────────────────────────────────────────────

  portfolioTimeline() {
    return this._equityCurve.map((p) => ({
      tick:        p.tick,
      equity:      p.equity,
      realizedPnl: p.realizedPnl,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Signal Accuracy
  // ─────────────────────────────────────────────────────────────────────────

  signalAccuracy(agents, positions) {
    const closed = positions.filter((p) => p.status === "won" || p.status === "lost");

    // Overall
    const overall = closed.length > 0
      ? round(closed.filter((p) => p.status === "won").length / closed.length, 3)
      : null;

    // Per-agent
    const perAgent = agents.map((agent) => {
      const agentClosed = closed.filter((p) => p.agentId === agent.id);
      const acc = agentClosed.length > 0
        ? round(agentClosed.filter((p) => p.status === "won").length / agentClosed.length, 3)
        : null;
      // Calibration: how close is average confidence to actual win-rate?
      const avgConf = agentClosed.length > 0
        ? round(mean(agentClosed.map((p) => p.confidence ?? 0)), 3)
        : null;
      const calibration = acc != null && avgConf != null
        ? round(1 - Math.abs(acc - avgConf), 3)
        : null;
      return {
        agentId:     agent.id,
        name:        agent.name,
        color:       agent.color,
        trades:      agentClosed.length,
        accuracy:    acc,
        avgConf:     avgConf,
        calibration: calibration,
      };
    });

    return { overall, perAgent };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Expected Value Chart
  // ─────────────────────────────────────────────────────────────────────────

  expectedValueChart(signals) {
    // Last 40 signals — plot EV = confidence × edge
    return signals.slice(0, 40).map((sig) => ({
      id:        sig.id,
      agentName: sig.agentName,
      agentColor: sig.agentColor ?? "#14b8a6",
      match:     sig.match,
      outcome:   sig.outcome,
      ev:        round((sig.confidence ?? 0) * (sig.edge ?? 0) * 100, 2),
      confidence: sig.confidence ?? 0,
      edge:      sig.edge ?? 0,
      type:      sig.type,
      at:        sig.at,
    })).reverse(); // chronological order
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Win-Rate Heatmap
  // Produces a grid: agents × fixture stages → win rate
  // ─────────────────────────────────────────────────────────────────────────

  winRateHeatmap(agents, positions, fixtures) {
    const stages = [...new Set(fixtures.map((f) => f.stage).filter(Boolean))];
    if (!stages.length) return { stages: [], rows: [] };

    const closed = positions.filter((p) => p.status === "won" || p.status === "lost");

    // Map fixtureId → stage
    const fixtureStage = new Map(fixtures.map((f) => [f.id, f.stage]));

    const rows = agents.map((agent) => {
      const cells = stages.map((stage) => {
        const stageClosed = closed.filter(
          (p) => p.agentId === agent.id && fixtureStage.get(p.fixtureId) === stage
        );
        const winRate = stageClosed.length > 0
          ? round(stageClosed.filter((p) => p.status === "won").length / stageClosed.length, 2)
          : null;
        return { stage, winRate, trades: stageClosed.length };
      });
      return { agentId: agent.id, name: agent.name, color: agent.color, cells };
    });

    return { stages, rows };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Best-performing strategy
  // ─────────────────────────────────────────────────────────────────────────

  bestStrategy(leaderboard) {
    if (!leaderboard.length) return null;
    return leaderboard[0]; // already sorted by PnL desc
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Master summary — called from engine.mjs for snapshot
  // ─────────────────────────────────────────────────────────────────────────

  summary({ agents, positions, signals, fixtures }) {
    const leaderboard = this.strategyLeaderboard(agents, positions);
    const accuracy    = this.signalAccuracy(agents, positions);
    return {
      sharpe:           this.sharpeRatio(),
      leaderboard,
      best:             this.bestStrategy(leaderboard),
      timeline:         this.portfolioTimeline(),
      accuracy,
      evChart:          this.expectedValueChart(signals),
      heatmap:          this.winRateHeatmap(agents, positions, fixtures),
    };
  }

  reset() {
    this._equityCurve = [];
  }
}

export default new AnalyticsEngine();
