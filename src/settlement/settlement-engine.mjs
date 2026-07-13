// src/settlement/settlement-engine.mjs
//
// Detects when fixtures reach "Final" status, settles all open positions
// for that fixture, calculates payouts, and emits settlement events.
// Also triggers on-chain validation for each settled trade.

import { round } from "../math.mjs";
import eventBus from "../core/event-bus.mjs";
import EVENTS from "../core/events.mjs";
import domainEvent from "../core/domain-event.mjs";
import logger from "../logger/logger.mjs";

class SettlementEngine {
  constructor() {
    // fixtureId → true once we have settled it (avoid double-settling)
    this._settled = new Set();
    // Full history of every settlement record
    this.history = [];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Called every engine tick.
   * Scans fixtures for newly-Final matches and settles their positions.
   *
   * @param {object[]} fixtures   - current fixture list from AgentEngine
   * @param {object[]} positions  - current positions list from AgentEngine
   * @param {Map}      agentState - agent state map for exposure tracking
   * @returns {object[]} newly-created settlement records (may be empty)
   */
  settle(fixtures, positions, agentState) {
    const newRecords = [];

    for (const fixture of fixtures) {
      if (fixture.status !== "Final") continue;
      if (this._settled.has(fixture.id)) continue;

      this._settled.add(fixture.id);

      const fixturePositions = positions.filter(
        (p) => p.fixtureId === fixture.id && p.status === "open"
      );

      if (!fixturePositions.length) continue;

      logger.info(`Settling fixture ${fixture.id}: ${fixture.home} vs ${fixture.away}`);

      eventBus.emit(
        EVENTS.SETTLEMENT_STARTED,
        domainEvent.create({
          source: "settlement-engine",
          type: EVENTS.SETTLEMENT_STARTED,
          correlationId: `fixture-${fixture.id}`,
          payload: { fixtureId: fixture.id, positionCount: fixturePositions.length },
        })
      );

      const winner = this._winner(fixture);
      const records = fixturePositions.map((position) =>
        this._settlePosition(position, fixture, winner, agentState)
      );

      const totalPayout  = round(records.reduce((s, r) => s + r.payout,  0), 2);
      const totalStaked  = round(records.reduce((s, r) => s + r.stake,   0), 2);
      const totalPnL     = round(records.reduce((s, r) => s + r.pnl,     0), 2);
      const wins         = records.filter((r) => r.result === "WON").length;
      const losses       = records.filter((r) => r.result === "LOST").length;

      const summary = {
        fixtureId:   fixture.id,
        match:       `${fixture.home} vs ${fixture.away}`,
        stage:       fixture.stage,
        finalScore:  `${fixture.homeScore}-${fixture.awayScore}`,
        winner,
        settledAt:   new Date().toISOString(),
        positions:   records.length,
        wins,
        losses,
        totalStaked,
        totalPayout,
        totalPnL,
        records,
      };

      this.history.unshift(summary);
      newRecords.push(summary);

      eventBus.emit(
        EVENTS.SETTLEMENT_COMPLETED,
        domainEvent.create({
          source: "settlement-engine",
          type: EVENTS.SETTLEMENT_COMPLETED,
          correlationId: `fixture-${fixture.id}`,
          payload: summary,
        })
      );

      logger.info(
        `Settlement complete: ${fixture.home} vs ${fixture.away} — ` +
        `${wins}W/${losses}L  PnL ${totalPnL >= 0 ? "+" : ""}${totalPnL}`
      );
    }

    return newRecords;
  }

  /** All settlement records, newest first. */
  status() {
    return {
      totalSettled: this._settled.size,
      history: this.history.slice(0, 50),
    };
  }

  reset() {
    this._settled.clear();
    this.history = [];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────────────────

  _settlePosition(position, fixture, winner, agentState) {
    const won    = position.outcome === winner;
    const result = won ? "WON" : "LOST";

    // Payout: winner gets stake × 1.82 (fixed ~1.82 return for demo),
    // loser forfeits stake.  Real system would use the entry odds.
    const payout = won ? round(position.stake * 1.82, 2) : 0;
    const pnl    = round(payout - position.stake, 2);

    // Mutate position in-place (same reference held by engine)
    position.status     = won ? "won" : "lost";
    position.settledAt  = new Date().toISOString();
    position.pnl        = pnl;
    position.payout     = payout;
    position.result     = result;
    position.proofState = "pending"; // will be updated by on-chain validator

    // Update agent state
    const agent = agentState.get(position.agentId);
    if (agent) {
      agent.exposure = Math.max(0, agent.exposure - position.stake);
      agent.pnl      = round((agent.pnl ?? 0) + pnl, 2);
      if (won) agent.wins   = (agent.wins   ?? 0) + 1;
      else     agent.losses = (agent.losses ?? 0) + 1;
    }

    logger.info(
      `  Position ${position.id}: ${result}  pnl=${pnl >= 0 ? "+" : ""}${pnl}`
    );

    return {
      positionId:  position.id,
      agentId:     position.agentId,
      agentName:   position.agentName,
      agentColor:  position.agentColor ?? "#14b8a6",
      outcome:     position.outcome,
      stake:       position.stake,
      payout,
      pnl,
      result,
      confidence:  position.confidence,
      openedAt:    position.openedAt,
      settledAt:   position.settledAt,
      proofState:  "pending",
    };
  }

  _winner(fixture) {
    if (fixture.homeScore > fixture.awayScore) return fixture.home;
    if (fixture.awayScore > fixture.homeScore) return fixture.away;
    return "Draw";
  }
}

export default new SettlementEngine();
