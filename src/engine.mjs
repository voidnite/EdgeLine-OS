import { EventEmitter } from "node:events";
import { evaluateStrategies, AGENT_BLUEPRINTS } from "./strategies.mjs";
import {
  clamp,
  decimalToProbability,
  hashReceipt,
  normalize,
  probabilityToDecimal,
  pseudoNoise,
  round,
  sum,
} from "./math.mjs";
import { createTxlineClient } from "./txline/txline-client.mjs";
import fixturesLoader from "./txline/fixtures-loader.mjs";
import settlementEngine from "./settlement/settlement-engine.mjs";
import onchainValidator from "./proof/onchain-validator.mjs";
import analyticsEngine from "./analytics/analytics-engine.mjs";

// Fallback fixtures — used when TXLINE_LIVE=false OR when live API returns nothing.
// Updated to real 2026 World Cup results as of July 12, 2026.
const REPLAY_FIXTURES = [

  // ── Semi-finals (upcoming — July 14-15 2026) ─────────────────────────────
  {
    id: 18220001,
    home: "France", away: "Spain",
    stage: "Semi-finals",
    minute: 0, status: "Scheduled",
    homeScore: 0, awayScore: 0,
    baseHome: 0.42, baseDraw: 0.25, baseAway: 0.33,
    outcomes: ["France", "Draw", "Spain"],
    startTime: "2026-07-14T20:00:00Z",
  },
  {
    id: 18220002,
    home: "England", away: "Argentina",
    stage: "Semi-finals",
    minute: 0, status: "Scheduled",
    homeScore: 0, awayScore: 0,
    baseHome: 0.37, baseDraw: 0.26, baseAway: 0.37,
    outcomes: ["England", "Draw", "Argentina"],
    startTime: "2026-07-15T20:00:00Z",
  },

  // ── Quarter-finals (finished — July 9-12 2026) ───────────────────────────
  {
    id: 18209181,
    home: "France", away: "Morocco",
    stage: "Quarter-finals",
    minute: 90, status: "Final",
    homeScore: 2, awayScore: 0,
    baseHome: 0.88, baseDraw: 0.04, baseAway: 0.08,
    outcomes: ["France", "Draw", "Morocco"],
    startTime: "2026-07-09T20:00:00Z",
  },
  {
    id: 18209182,
    home: "Spain", away: "Portugal",
    stage: "Quarter-finals",
    minute: 90, status: "Final",
    homeScore: 3, awayScore: 1,
    baseHome: 0.88, baseDraw: 0.04, baseAway: 0.08,
    outcomes: ["Spain", "Draw", "Portugal"],
    startTime: "2026-07-10T20:00:00Z",
  },
  {
    id: 18209183,
    home: "Norway", away: "England",
    stage: "Quarter-finals",
    minute: 120, status: "Final",
    homeScore: 1, awayScore: 2,
    baseHome: 0.08, baseDraw: 0.04, baseAway: 0.88,
    outcomes: ["Norway", "Draw", "England"],
    startTime: "2026-07-11T20:00:00Z",
  },
  {
    id: 18209184,
    home: "Argentina", away: "Switzerland",
    stage: "Quarter-finals",
    minute: 120, status: "Final",
    homeScore: 3, awayScore: 1,
    baseHome: 0.88, baseDraw: 0.04, baseAway: 0.08,
    outcomes: ["Argentina", "Draw", "Switzerland"],
    startTime: "2026-07-12T16:00:00Z",
  },
];

export class AgentEngine extends EventEmitter {
  constructor({ tickMs = 3000, live = false } = {}) {
    super();
    this.tickMs = tickMs;
    this.mode = live ? "live-txline" : "deterministic-replay";
    this.live = live;
    this.timer = null;
    this.txline = createTxlineClient();

    this.registerTxlineEvents();

    this.reset();
  }
  reset() {
    this.tickCount = 0;
    this.startedAt = new Date().toISOString();

    // In live mode: use whatever the fixtures-loader has already fetched
    // (may be empty on first boot — filled in by start() before tick begins).
    // In replay mode: use the deterministic replay set.
    const source = this.live
      ? fixturesLoader.fixtures
      : REPLAY_FIXTURES;

    this._initFixtures(source.length ? source : REPLAY_FIXTURES);

    this.history = new Map();
    this.signals = [];
    this.positions = [];
    this.settlements = [];
    this.proofReceipts = [];
    settlementEngine.reset();
    onchainValidator.reset();
    analyticsEngine.reset();
    this.agentState = new Map(
      AGENT_BLUEPRINTS.map((agent) => [
        agent.id,
        {
          ...agent,
          exposure: 0,
          pnl: 0,
          signals: 0,
          wins: 0,
          losses: 0,
          lastAction: "Standing by",
        },
      ]),
    );
    this.ingestion = {
      source: this.mode,
      oddsEvents: 0,
      scoreEvents: 0,
      lastReceipt: null,
      lastHeartbeat: null,
      connected: false,
      txlineEndpoints: [
        "/api/fixtures",
        "/api/scores/stream",
        "/api/odds/stream",
        "/api/scores/snapshot",
        "/api/scores/stat-validation",
      ],
    };
    this.recordHistory();
    this.emit("update", this.snapshot());
  }

  // Initialise the fixtures array from any source (live or replay)
  _initFixtures(list) {
    this.fixtures = list.map((fixture, index) => {
      const base = [
        fixture.baseHome ?? 0.38,
        fixture.baseDraw ?? 0.27,
        fixture.baseAway ?? 0.35,
      ];
      const probabilities = fixture.probabilities ?? normalize(base);
      return {
        ...structuredClone(fixture),
        seed: fixture.seed ?? index + 10,
        volatility: fixture.volatility ?? (0.04 + index * 0.015),
        probabilities,
        odds: fixture.odds ?? probabilities.map(probabilityToDecimal),
        baseHome: probabilities[0],
        baseDraw: probabilities[1],
        baseAway: probabilities[2],
      };
    });
  }

  // Generate proofs for fixtures already Final when server starts
  // This populates the On-Chain panel immediately without waiting for new Final events
  _generateStartupProofs() {
    const finalFixtures = this.fixtures.filter(f => f.status === "Final");
    if (!finalFixtures.length) return;

    console.log(`[EdgeLine] Generating startup proofs for ${finalFixtures.length} finished fixtures…`);

    for (const fixture of finalFixtures) {
      try {
        // Generate proof
        const validation = onchainValidator.validateSettlement(fixture, []);
        const receipt = {
          fixtureId:       fixture.id,
          match:           `${fixture.home} vs ${fixture.away}`,
          finalScore:      `${fixture.homeScore}-${fixture.awayScore}`,
          allVerified:     validation.allVerified,
          merkleRoot:      validation.fixtureReceipt.data.merkleRoot,
          solanaSignature: validation.fixtureReceipt.signature,
          solscanUrl:      validation.fixtureReceipt.solscanUrl,
          timestamp:       new Date().toISOString(),
        };
        if (!this.proofReceipts.find(p => p.fixtureId === fixture.id)) {
          this.proofReceipts.unshift(receipt);
        }

        // Also add a settlement summary so Portfolio/Settlement History shows data
        if (!this.settlements.find(s => s.fixtureId === fixture.id)) {
          const winner = fixture.homeScore > fixture.awayScore ? fixture.home
                       : fixture.awayScore > fixture.homeScore ? fixture.away : "Draw";
          this.settlements.unshift({
            fixtureId:   fixture.id,
            match:       `${fixture.home} vs ${fixture.away}`,
            stage:       fixture.stage ?? "World Cup",
            finalScore:  `${fixture.homeScore}-${fixture.awayScore}`,
            winner,
            settledAt:   fixture.startTime ?? new Date().toISOString(),
            positions:   0,
            wins:        0,
            losses:      0,
            totalStaked: 0,
            totalPayout: 0,
            totalPnL:    0,
            records:     [],
            validation: {
              allVerified:     validation.allVerified,
              merkleRoot:      validation.fixtureReceipt.data.merkleRoot,
              solanaSignature: validation.fixtureReceipt.signature,
              solscanUrl:      validation.fixtureReceipt.solscanUrl,
            },
          });
        }

        console.log(`[EdgeLine] Proof: ${fixture.home} ${fixture.homeScore}-${fixture.awayScore} ${fixture.away} — ${validation.allVerified ? "✅ VERIFIED" : "❌ FAILED"}`);
      } catch (err) {
        console.warn(`[EdgeLine] Startup proof error for ${fixture.home} vs ${fixture.away}: ${err.message}`);
      }
    }

    this.proofReceipts = this.proofReceipts.slice(0, 50);
    this.settlements   = this.settlements.slice(0, 50);
    this.emit("update", this.snapshot());
  }

  async start() {

    if (this.timer) return;

    if (this.live) {
      // 1. Load real fixtures from TxLINE before anything ticks
      console.log("[EdgeLine] Fetching live World Cup fixtures from TxLINE…");
      const liveFixtures = await fixturesLoader.start();

      if (liveFixtures.length) {
        this._initFixtures(liveFixtures);
        this.recordHistory();
        console.log(`[EdgeLine] Loaded ${liveFixtures.length} real fixtures`);
        // Immediately generate proofs for fixtures already Final on startup
        this._generateStartupProofs();
      } else {
        console.warn("[EdgeLine] No fixtures returned yet — will retry on next refresh");
      }

      // 2. Re-initialise fixtures whenever loader refreshes (every 5 min)
      fixturesLoader._onRefresh = (fresh) => {
        // Only add NEW fixtures — don't overwrite ones already being tracked
        for (const f of fresh) {
          if (!this.fixtures.find((x) => x.id === f.id)) {
            this.fixtures.push({
              ...f,
              seed: (f.id ?? 0) % 100,
              volatility: 0.04,
            });
            console.log(`[EdgeLine] New fixture added: ${f.home} vs ${f.away}`);
          }
        }
      };

      // 3. Start SSE stream
      await this.txline.start();
      this.ingestion.source = "txline-live";
    }

    this.timer = setInterval(() => this.tick(), this.tickMs);
  }

  tick() {

    this.tickCount++;

    // Replay mode only.
    if (!this.live) {

      this.applyReplayTick();

    }

    this.recordHistory();

    const signals = evaluateStrategies({

      fixtures: this.fixtures,

      history: this.history,

      agents: this.agentState,

      tick: this.tickCount,

    });

    this.executeSignals(signals);

    // ── Settlement (before markPositions so open positions are still open) ─
    const newSettlements = settlementEngine.settle(
      this.fixtures,
      this.positions,
      this.agentState,
    );

    this.markPositions();

    // ── On-chain validation for each newly-settled fixture ───────────────
    for (const summary of newSettlements) {
      const fixture = this.fixtures.find((f) => f.id === summary.fixtureId);
      if (fixture) {
        const validation = onchainValidator.validateSettlement(fixture, summary.records);
        summary.validation = {
          allVerified: validation.allVerified,
          merkleRoot: validation.fixtureReceipt.data.merkleRoot,
          solanaSignature: validation.fixtureReceipt.signature,
          solscanUrl: validation.fixtureReceipt.solscanUrl,
          statCount: validation.statReceipts.length,
        };
        this.proofReceipts.unshift({
          fixtureId: fixture.id,
          match: summary.match,
          finalScore: summary.finalScore,
          allVerified: validation.allVerified,
          merkleRoot: validation.fixtureReceipt.data.merkleRoot,
          solanaSignature: validation.fixtureReceipt.signature,
          solscanUrl: validation.fixtureReceipt.solscanUrl,
          timestamp: new Date().toISOString(),
        });
      }
      this.settlements.unshift(summary);
    }
    this.settlements = this.settlements.slice(0, 50);
    this.proofReceipts = this.proofReceipts.slice(0, 50);

    // ── Analytics ────────────────────────────────────────────────────────
    analyticsEngine.recordTick({
      tick: this.tickCount,
      agents: [...this.agentState.values()],
      positions: this.positions,
    });

    this.emit(

      "update",

      this.snapshot()

    );

  }

  applyReplayTick() {
    for (const fixture of this.fixtures) {
      if (fixture.status === "Scheduled" && this.tickCount > 8) {
        fixture.status = "Live";
      }
      if (fixture.status !== "Live") continue;

      fixture.minute = clamp(fixture.minute + 1, 0, 90);
      const goalPulse = goalPulseFor(fixture.id, this.tickCount);
      if (goalPulse === "home") fixture.homeScore += 1;
      if (goalPulse === "away") fixture.awayScore += 1;
      if (fixture.minute >= 90) fixture.status = "Final";

      const scoreLean = (fixture.homeScore - fixture.awayScore) * 0.08;
      const clockLean = (fixture.minute / 90) * scoreLean;
      const noise = [
        pseudoNoise(fixture.seed, this.tickCount, fixture.volatility),
        pseudoNoise(fixture.seed + 1, this.tickCount, fixture.volatility * 0.7),
        pseudoNoise(fixture.seed + 2, this.tickCount, fixture.volatility),
      ];
      const steam = this.tickCount % 9 === fixture.seed % 9 ? 0.065 : 0;
      const raw = [
        fixture.baseHome + scoreLean + clockLean + noise[0] + steam,
        fixture.baseDraw + noise[1] - Math.abs(scoreLean) * 0.3,
        fixture.baseAway - scoreLean - clockLean + noise[2],
      ];
      fixture.probabilities = normalize(raw.map((value) => clamp(value, 0.03, 0.88)));
      fixture.odds = fixture.probabilities.map(probabilityToDecimal);
      fixture.volatility = clamp(
        fixture.volatility * 0.92 + sum(noise.map(Math.abs)) * 0.18 + (goalPulse ? 0.03 : 0),
        0.02,
        0.28,
      );
      this.ingestion.oddsEvents += 1;
      if (goalPulse) this.ingestion.scoreEvents += 1;
    }
    this.ingestion.lastReceipt = hashReceipt({
      tick: this.tickCount,
      fixtures: this.fixtures.map(({ id, homeScore, awayScore, minute }) => ({
        id,
        homeScore,
        awayScore,
        minute,
      })),
    });
  }
  registerTxlineEvents() {
    this.txline.on("connected", () => {
      this.ingestion.source = "txline-live";
      this.ingestion.connected = true;
      console.log("[EdgeLine] TxLINE stream connected ✅");
      this.emit("update", this.snapshot());
    });

    this.txline.on("reconnected", () => {
      this.ingestion.connected = true;
    });

    this.txline.on("disconnected", () => {
      this.ingestion.connected = false;
      this.emit("update", this.snapshot());
    });

    this.txline.on("heartbeat", () => {
      this.ingestion.lastHeartbeat = Date.now();
      this.ingestion.connected = true;
    });

    this.txline.on("score", (evt) => {
      this.applyLiveScore(evt);
    });

    this.txline.on("error", (err) => {
      console.error("[EdgeLine] TxLINE error:", err?.message ?? err);
    });
  }

  pause() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.live) {
      this.txline.stop();
      fixturesLoader.stop();
    }
    this.emit("update", this.snapshot());
  }

  applyLiveScore(domainEvt) {
    // domainEvt is a DomainEvent envelope — payload holds the mapped score
    const score = domainEvt?.payload ?? domainEvt;

    let fixture = this.fixtures.find((f) => f.id === score.fixtureId);

    // If we haven't seen this fixture yet, try to pull it from the loader
    if (!fixture) {
      const loaded = fixturesLoader.fixtures.find((f) => f.id === score.fixtureId);
      if (loaded) {
        fixture = {
          ...loaded,
          seed: (loaded.id ?? 0) % 100,
          volatility: 0.04,
        };
        this.fixtures.push(fixture);
        console.log(`[EdgeLine] Live fixture discovered: ${fixture.home} vs ${fixture.away}`);
      } else {
        // Unknown fixture — skip for now
        return;
      }
    }

    // Update fields from the score event
    if (score.minute != null) fixture.minute = score.minute;
    if (score.homeScore != null) fixture.homeScore = score.homeScore;
    if (score.awayScore != null) fixture.awayScore = score.awayScore;
    if (score.isFinished) fixture.status = "Final";
    else if (score.period === "H1" || score.period === "H2") fixture.status = "Live";

    // Recalculate probabilities from updated score
    const scoreDiff = fixture.homeScore - fixture.awayScore;
    const timeFactor = Math.min((fixture.minute ?? 0) / 90, 1);
    const rawH = fixture.baseHome + scoreDiff * 0.12 + timeFactor * scoreDiff * 0.06;
    const rawD = fixture.baseDraw - Math.abs(scoreDiff) * 0.04;
    const rawA = fixture.baseAway - scoreDiff * 0.12 - timeFactor * scoreDiff * 0.06;
    fixture.probabilities = normalize([
      Math.max(0.03, rawH),
      Math.max(0.03, rawD),
      Math.max(0.03, rawA),
    ]);
    fixture.odds = fixture.probabilities.map(probabilityToDecimal);

    // Bump volatility on score changes
    const prevHome = fixture._prevHomeScore ?? fixture.homeScore;
    const prevAway = fixture._prevAwayScore ?? fixture.awayScore;
    if (fixture.homeScore !== prevHome || fixture.awayScore !== prevAway) {
      fixture.volatility = Math.min((fixture.volatility ?? 0.04) + 0.06, 0.3);
      fixture._prevHomeScore = fixture.homeScore;
      fixture._prevAwayScore = fixture.awayScore;
    }

    this.ingestion.scoreEvents++;
    this.ingestion.connected = true;
    this.ingestion.lastReceipt = score.sequence ?? score.id ?? null;
    this.ingestion.lastHeartbeat = Date.now();

    this.emit("update", this.snapshot());
  }

  recordHistory() {
    for (const fixture of this.fixtures) {
      const points = this.history.get(fixture.id) || [];
      points.push({
        tick: this.tickCount,
        minute: fixture.minute,
        probabilities: fixture.probabilities,
        odds: fixture.odds,
        leaderIndex: leaderIndex(fixture.probabilities),
      });
      this.history.set(fixture.id, points.slice(-30));
    }
  }

  executeSignals(signals) {
    for (const signal of signals) {
      if (this.signals.some((item) => item.id === signal.id)) continue;
      this.signals.unshift({
        ...signal,
        receipt: hashReceipt(signal),
      });
      this.signals = this.signals.slice(0, 100);
      const agent = this.agentState.get(signal.agentId);
      if (!agent) continue;
      agent.signals += 1;
      agent.lastAction = signal.rationale;

      if (signal.type === "market-maker-quote") continue;
      if (agent.exposure + signal.stake > agent.riskLimit) {
        agent.lastAction = `Risk manager rejected ${signal.outcome}: exposure cap`;
        continue;
      }
      this.positions.unshift({
        id: signal.id,
        agentId: signal.agentId,
        agentName: signal.agentName,
        fixtureId: signal.fixtureId,
        match: signal.match,
        outcome: signal.outcome,
        direction: signal.direction,
        entryProbability: 1 / signal.price,
        stake: signal.stake,
        confidence: signal.confidence,
        openedAt: signal.at,
        pnl: 0,
        status: "open",
      });
      this.positions = this.positions.slice(0, 80);
      agent.exposure += signal.stake;
    }
  }

  markPositions() {
    for (const position of this.positions) {
      // Skip anything settlement-engine has already handled
      if (position.status !== "open") continue;
      const fixture = this.fixtures.find((item) => item.id === position.fixtureId);
      if (!fixture) continue;
      const index = fixture.outcomes.indexOf(position.outcome);
      if (index === -1) continue;
      const currentProbability = decimalToProbability(fixture.odds[index]);
      position.pnl = round(
        position.stake * ((currentProbability - position.entryProbability) / position.entryProbability),
        2,
      );
      // Do NOT close Final positions here — settlement-engine owns that
    }
  }

  snapshot() {
    const agents = [...this.agentState.values()].map((agent) => ({
      ...agent,
      winRate: agent.wins + agent.losses ? round(agent.wins / (agent.wins + agent.losses), 3) : null,
    }));
    const openPnl = round(sum(this.positions.filter((item) => item.status === "open").map((item) => item.pnl)), 2);
    const realizedPnl = round(sum(agents.map((agent) => agent.pnl)), 2);
    const riskUsed = round(sum(agents.map((agent) => agent.exposure)), 2);
    return {
      name: "EdgeLine OS",
      mode: this.mode,
      running: Boolean(this.timer),
      tick: this.tickCount,
      tickMs: this.tickMs,
      startedAt: this.startedAt,
      kpis: {
        signals: this.signals.length,
        openPositions: this.positions.filter((item) => item.status === "open").length,
        openPnl,
        realizedPnl,
        riskUsed,
        accuracy: projectedAccuracy(this.positions),
      },
      ingestion: this.ingestion,
      agents,
      fixtures: this.fixtures.map((fixture) => ({
        id: fixture.id,
        home: fixture.home,
        away: fixture.away,
        stage: fixture.stage,
        minute: fixture.minute,
        status: fixture.status,
        homeScore: fixture.homeScore,
        awayScore: fixture.awayScore,
        outcomes: fixture.outcomes,
        odds: fixture.odds.map((value) => round(value, 2)),
        probabilities: fixture.probabilities.map((value) => round(value, 4)),
        volatility: round(fixture.volatility, 3),
      })),
      signals: this.signals.slice(0, 40),
      positions: this.positions.slice(0, 30),
      settlements: this.settlements.slice(0, 20),
      proofs: this.proofReceipts.slice(0, 20),
      analytics: analyticsEngine.summary({
        agents: [...this.agentState.values()],
        positions: this.positions,
        signals: this.signals,
        fixtures: this.fixtures,
      }),
    };
  }
}

function leaderIndex(probabilities) {
  let bestIndex = 0;
  let best = -Infinity;
  probabilities.forEach((value, index) => {
    if (value > best) {
      best = value;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function goalPulseFor(fixtureId, tick) {
  const key = `${fixtureId}:${tick}`;
  if (key === "8810401:11") return "away";
  if (key === "8810402:15") return "away";
  if (key === "8810403:8") return "home";
  if (key === "8810404:22") return "home";
  return null;
}

function winningOutcome(fixture) {
  if (fixture.homeScore > fixture.awayScore) return fixture.home;
  if (fixture.awayScore > fixture.homeScore) return fixture.away;
  return "Draw";
}

function projectedAccuracy(positions) {
  const closed = positions.filter((item) => item.status === "won" || item.status === "lost");
  if (!closed.length) {
    const open = positions.filter((item) => item.status === "open");
    if (!open.length) return null;
    return round(sum(open.map((item) => item.confidence)) / open.length, 3);
  }
  return round(closed.filter((item) => item.status === "won").length / closed.length, 3);
}
