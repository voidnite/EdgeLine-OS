import {
  clamp,
  decimalToProbability,
  mean,
  probabilityToDecimal,
  pseudoNoise,
  removeVig,
  round,
  stdev,
} from "./math.mjs";

// ELO-based team strength for pre-match signal generation
const TEAM_ELO = {
  "France": 0.88, "Argentina": 0.86, "England": 0.82, "Spain": 0.85,
  "Brazil": 0.84, "Germany": 0.80, "Portugal": 0.78, "Netherlands": 0.76,
  "Belgium": 0.74, "Norway": 0.68, "Morocco": 0.66, "Switzerland": 0.70,
  "USA": 0.65, "Colombia": 0.67, "Australia": 0.58, "Japan": 0.67,
};

function eloProbs(home, away) {
  const sH = TEAM_ELO[home] ?? 0.60;
  const sA = TEAM_ELO[away] ?? 0.60;
  const hf = sH / (sH + sA);
  const af = sA / (sH + sA);
  return removeVig([
    Math.max(0.04, 0.10 + hf * 0.65),
    Math.max(0.04, 0.26 - Math.abs(hf - 0.5) * 0.12),
    Math.max(0.04, 0.10 + af * 0.65),
  ]);
}

export const AGENT_BLUEPRINTS = [
  {
    id: "sharp-sentinel",
    name: "Sharp Sentinel",
    role: "Movement detector",
    color: "#14b8a6",
    mandate: "Flags fast odds movement with cross-book confirmation.",
    riskLimit: 900,
  },
  {
    id: "model-voyager",
    name: "Model Voyager",
    role: "Model-vs-market scout",
    color: "#f59e0b",
    mandate: "Compares in-play model probability against TxLINE consensus.",
    riskLimit: 700,
  },
  {
    id: "maker-prime",
    name: "Maker Prime",
    role: "In-play market maker",
    color: "#6366f1",
    mandate: "Quotes bid/ask prices with volatility-aware spread control.",
    riskLimit: 1100,
  },
  {
    id: "counterflow",
    name: "Counterflow",
    role: "Agent arena rival",
    color: "#ef4444",
    mandate: "Takes the other side of overextended moves after velocity spikes.",
    riskLimit: 650,
  },
];

export function evaluateStrategies({ fixtures, history, agents, tick }) {
  const signals = [];
  for (const fixture of fixtures) {
    // Skip Final fixtures entirely — nothing to trade
    if (fixture.status === "Final") continue;

    const marketHistory = history.get(fixture.id) || [];
    // Need at least 2 history points; for Scheduled fixtures we allow 1
    if (marketHistory.length < 2) continue;

    signals.push(...sharpMovementSignals(fixture, marketHistory, agents, tick));
    signals.push(...modelEdgeSignals(fixture, marketHistory, agents, tick));
    signals.push(...marketMakerQuotes(fixture, marketHistory, agents, tick));
    signals.push(...counterflowSignals(fixture, marketHistory, agents, tick));
  }

  return signals
    .filter(Boolean)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 12);
}

// ── Sharp Sentinel ────────────────────────────────────────────────────────
function sharpMovementSignals(fixture, history, agents, tick) {
  const agent  = agents.get("sharp-sentinel");
  const latest = history.at(-1);

  // Live: use real odds movement
  if (fixture.status === "Live" && history.length >= 4) {
    const previous = history.at(-4);
    return fixture.outcomes.map((outcome, index) => {
      const delta      = latest.probabilities[index] - previous.probabilities[index];
      const velocity   = delta / Math.max(1, latest.tick - previous.tick);
      const dispersion = stdev(history.slice(-5).map(p => p.probabilities[index]));
      const confidence = clamp(Math.abs(delta) * 5.2 + dispersion * 2.7, 0, 0.96);
      if (Math.abs(delta) < 0.045 || confidence < 0.32) return null;
      return buildSignal({
        tick, fixture, agent,
        type: "sharp-move", outcome,
        direction: delta > 0 ? "steam" : "drift",
        edge: delta, confidence,
        stake: 60 + confidence * 120,
        rationale: `${outcome} moved ${round(delta * 100, 1)} pts · velocity ${round(velocity * 100, 2)} pts/tick.`,
      });
    }).filter(Boolean);
  }

  // Pre-match: ELO divergence from market with tick-based noise
  const elo    = eloProbs(fixture.home, fixture.away);
  const market = latest.probabilities;
  const noise  = pseudoNoise(tick * 7 + (fixture.id % 100), tick, 0.016);

  return fixture.outcomes.map((outcome, index) => {
    const divergence = elo[index] - market[index] + noise;
    if (Math.abs(divergence) < 0.012) return null;
    const confidence = clamp(Math.abs(divergence) * 6.5 + 0.38, 0.38, 0.84);
    return buildSignal({
      tick, fixture, agent,
      type: "pre-match-move", outcome,
      direction: divergence > 0 ? "steam" : "drift",
      edge: divergence, confidence,
      stake: 55 + confidence * 110,
      rationale: `Pre-match: ${outcome} at ${round(market[index]*100,1)}% vs ELO fair value ${round(elo[index]*100,1)}%.`,
    });
  }).filter(Boolean);
}

// ── Model Voyager ─────────────────────────────────────────────────────────
function modelEdgeSignals(fixture, history, agents, tick) {
  const agent  = agents.get("model-voyager");
  const latest = history.at(-1);

  // ELO-based fair value as the "model"; TxLINE market odds as "market"
  const elo    = eloProbs(fixture.home, fixture.away);
  const market = latest.probabilities;
  // Per-tick perturbation so signals vary each tick
  const perturb = pseudoNoise((fixture.id % 97) + 13, tick, 0.020);

  return fixture.outcomes.map((outcome, index) => {
    const modelProb  = clamp(elo[index] + perturb, 0.03, 0.94);
    const marketProb = market[index];
    const edge       = modelProb - marketProb;
    const confidence = clamp(Math.abs(edge) * 5.2 + (fixture.volatility ?? 0.04) * 1.8, 0, 0.93);
    if (Math.abs(edge) < 0.010 || confidence < 0.28) return null;
    return buildSignal({
      tick, fixture, agent,
      type: "model-edge", outcome,
      direction: "buy",
      edge, confidence,
      stake: 50 + confidence * 100,
      rationale: `ELO model ${round(modelProb*100,1)}% vs market ${round(marketProb*100,1)}% — ${round(edge*100,1)} pt edge.`,
    });
  }).filter(Boolean);
}

// ── Maker Prime ───────────────────────────────────────────────────────────
function marketMakerQuotes(fixture, history, agents, tick) {
  const agent    = agents.get("maker-prime");
  const latest   = history.at(-1);
  const quotes   = [];
  const vol      = (fixture.volatility ?? 0.04) + stdev(history.slice(-8).flatMap(p => p.probabilities));
  const spread   = clamp(0.018 + vol * 0.18 + (fixture.minute ?? 0) / 9000, 0.018, 0.085);

  latest.probabilities.forEach((probability, index) => {
    const bidP = clamp(probability - spread / 2, 0.01, 0.98);
    const askP = clamp(probability + spread / 2, 0.02, 0.99);
    if (index === latest.leaderIndex || tick % 4 === index) {
      quotes.push(buildSignal({
        tick, fixture, agent,
        type: "market-maker-quote",
        outcome: fixture.outcomes[index],
        direction: "quote",
        edge: spread,
        confidence: clamp(0.44 + vol, 0.3, 0.88),
        stake: 80,
        bid: probabilityToDecimal(bidP),
        ask: probabilityToDecimal(askP),
        rationale: `Spread ${round(spread*100,1)} pts after volatility and match-clock adjustment.`,
      }));
    }
  });

  return quotes.slice(0, 2);
}

// ── Counterflow ───────────────────────────────────────────────────────────
function counterflowSignals(fixture, history, agents, tick) {
  const agent  = agents.get("counterflow");
  const latest = history.at(-1);

  // Live: fade real overextension
  if (fixture.status === "Live" && history.length >= 4) {
    const previous = history.at(-3);
    const outputs  = [];
    latest.probabilities.forEach((probability, index) => {
      const move   = probability - previous.probabilities[index];
      const recent = history.slice(-7).map(p => p.probabilities[index]);
      const sd     = stdev(recent);
      const zScore = sd ? (probability - mean(recent)) / sd : 0;
      const conf   = clamp(Math.abs(zScore) / 3, 0, 0.9);
      if (move > 0.04 && zScore > 1.35 && conf > 0.38) {
        const target = leastChangedOutcome(fixture, latest.probabilities, index);
        outputs.push(buildSignal({
          tick, fixture, agent,
          type: "counterflow", outcome: target,
          direction: "fade", edge: -move, confidence: conf,
          stake: 40 + conf * 80,
          rationale: `${fixture.outcomes[index]} overextended (z=${round(zScore,2)}).`,
        }));
      }
    });
    return outputs;
  }

  // Pre-match: fade the most market-overpriced outcome vs ELO
  const elo    = eloProbs(fixture.home, fixture.away);
  const market = latest.probabilities;
  const nudge  = pseudoNoise((fixture.id % 53) + 7, tick + 3, 0.014);

  let maxOverprice = -Infinity, maxIdx = -1;
  market.forEach((mProb, i) => {
    const overpr = mProb - elo[i] + nudge;
    if (overpr > maxOverprice) { maxOverprice = overpr; maxIdx = i; }
  });
  if (maxIdx === -1 || maxOverprice < 0.008) return [];

  const confidence = clamp(maxOverprice * 6 + 0.32, 0.32, 0.86);
  const target     = leastChangedOutcome(fixture, market, maxIdx);
  return [buildSignal({
    tick, fixture, agent,
    type: "pre-match-fade", outcome: target,
    direction: "fade", edge: -maxOverprice, confidence,
    stake: 40 + confidence * 80,
    rationale: `Fading ${fixture.outcomes[maxIdx]} — market ${round(market[maxIdx]*100,1)}% vs ELO ${round(elo[maxIdx]*100,1)}%.`,
  })];
}

// ── Helpers ───────────────────────────────────────────────────────────────
function leastChangedOutcome(fixture, probabilities, excludedIndex) {
  let best = 0, bestValue = Infinity;
  probabilities.forEach((value, index) => {
    if (index !== excludedIndex && value < bestValue) { best = index; bestValue = value; }
  });
  return fixture.outcomes[best];
}

function fixtureModelProbabilities(fixture) {
  const bH = fixture.baseHome ?? fixture.probabilities?.[0] ?? 0.38;
  const bD = fixture.baseDraw ?? fixture.probabilities?.[1] ?? 0.27;
  const bA = fixture.baseAway ?? fixture.probabilities?.[2] ?? 0.35;
  const scoreDiff  = (fixture.homeScore ?? 0) - (fixture.awayScore ?? 0);
  const timeFactor = clamp((fixture.minute ?? 0) / 90, 0, 1);
  return removeVig([
    Math.max(0.03, bH + scoreDiff * 0.16 + timeFactor * scoreDiff * 0.11),
    Math.max(0.03, bD + (scoreDiff === 0 ? 0.08 * timeFactor : -0.04 * timeFactor)),
    Math.max(0.03, bA - scoreDiff * 0.16 - timeFactor * scoreDiff * 0.11),
  ]);
}

function buildSignal({ tick, fixture, agent, type, outcome, direction, edge, confidence, stake, bid = null, ask = null, rationale }) {
  const price = currentPrice(fixture, outcome);
  return {
    id: `${tick}-${agent.id}-${fixture.id}-${type}-${outcome}`.replaceAll(" ", "-").toLowerCase(),
    tick,
    at: new Date().toISOString(),
    fixtureId: fixture.id,
    match: `${fixture.home} vs ${fixture.away}`,
    minute: fixture.minute,
    agentId: agent.id,
    agentName: agent.name,
    agentColor: agent.color,
    type,
    outcome,
    direction,
    edge:       round(edge, 4),
    confidence: round(confidence, 3),
    stake:      Math.round(stake),
    price:      round(price, 2),
    bid:        bid ? round(bid, 2) : null,
    ask:        ask ? round(ask, 2) : null,
    rationale,
  };
}

function currentPrice(fixture, outcome) {
  const index = fixture.outcomes.indexOf(outcome);
  const odds  = fixture.odds[index] || 2;
  return probabilityToDecimal(decimalToProbability(odds));
}
