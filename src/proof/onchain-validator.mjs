// src/proof/onchain-validator.mjs
//
// Simulates the TxLINE on-chain validation API surface:
//   validateStat()     — validate a single statistic against the Merkle root
//   validateStatV2()   — same but with extended metadata + period breakdown
//   validateFixture()  — validate the entire fixture outcome
//
// In production these calls would hit the Solana program via
// the TxLINE SDK.  Here we use our deterministic Merkle proof module
// so the verification math is real — only the RPC transport is simulated.
//
// Every validated record gets a Solana-style signature (deterministic hash)
// and a "Verified on Solana ✅" flag visible in the dashboard.

import { proveFixture, verifyProof } from "./merkle-proof.mjs";
import { hashReceipt } from "../math.mjs";
import STAT_KEYS from "../txline/protocol/stat-keys.mjs";
import eventBus from "../core/event-bus.mjs";
import EVENTS from "../core/events.mjs";
import domainEvent from "../core/domain-event.mjs";
import logger from "../logger/logger.mjs";

// Simulated Solana mainnet program ID (real TxLINE oracle program)
const PROGRAM_ID = "9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA";
const NETWORK    = "mainnet";

class OnchainValidator {
  constructor() {
    // fixtureId → proof bundle
    this._proofs = new Map();
    // positionId → validation receipt
    this._receipts = new Map();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Core validation methods (mirror TxLINE SDK surface)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * validateStat(fixtureId, statKey, expectedValue)
   * Prove a single stat (e.g. goals = 2) is included in the Merkle root.
   */
  validateStat(fixture, statKey, expectedValue) {
    const bundle = this._getOrBuildProof(fixture);
    const match  = bundle.proofs.find(
      (p) => p.leaf.statKey === statKey && p.leaf.value === expectedValue
    );

    if (!match) {
      return this._receipt(fixture.id, "validateStat", false, {
        statKey, expectedValue,
        reason: "Leaf not found in tree",
      });
    }

    const verified = verifyProof(match.leafHash, match.proof, bundle.root);
    return this._receipt(fixture.id, "validateStat", verified, {
      statKey,
      expectedValue,
      leafHash:  match.leafHash,
      proofDepth: match.proof.length,
      merkleRoot: bundle.root,
    });
  }

  /**
   * validateStatV2(fixtureId, statKey, expectedValue, period)
   * Extended version — validates stat within a specific period.
   */
  validateStatV2(fixture, statKey, expectedValue, period = "FULL_GAME") {
    const bundle = this._getOrBuildProof(fixture);
    const match  = bundle.proofs.find(
      (p) =>
        p.leaf.statKey === statKey &&
        p.leaf.value   === expectedValue &&
        p.leaf.period  === period
    );

    if (!match) {
      return this._receipt(fixture.id, "validateStatV2", false, {
        statKey, expectedValue, period,
        reason: "Leaf not found for period",
      });
    }

    const verified = verifyProof(match.leafHash, match.proof, bundle.root);
    return this._receipt(fixture.id, "validateStatV2", verified, {
      statKey,
      expectedValue,
      period,
      participant: match.leaf.participant,
      leafHash:    match.leafHash,
      proofDepth:  match.proof.length,
      merkleRoot:  bundle.root,
    });
  }

  /**
   * validateFixture(fixtureId)
   * Validate the entire final outcome (score, all stats).
   * Returns one receipt summarising all individual stat validations.
   */
  validateFixture(fixture) {
    const bundle   = this._getOrBuildProof(fixture);
    const results  = bundle.proofs.map((p) => ({
      statKey:    p.leaf.statKey,
      value:      p.leaf.value,
      period:     p.leaf.period,
      participant: p.leaf.participant,
      verified:   p.verified,
    }));

    const allVerified = results.every((r) => r.verified);
    return this._receipt(fixture.id, "validateFixture", allVerified, {
      match:      bundle.match,
      finalScore: bundle.finalScore,
      merkleRoot: bundle.root,
      leafCount:  bundle.leafCount,
      stats:      results,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Bulk: validate everything for a just-settled fixture
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Run all three validators for a settled fixture and tag every
   * position record's proofState.
   *
   * @param {object}   fixture    - Final fixture object
   * @param {object[]} records    - Settlement records for this fixture
   * @returns {object} { fixtureReceipt, statReceipts[], allVerified }
   */
  validateSettlement(fixture, records) {
    logger.info(`On-chain validation: ${fixture.home} vs ${fixture.away}`);

    // 1. Validate full fixture outcome
    const fixtureReceipt = this.validateFixture(fixture);

    // 2. Validate key stats individually (goals + cards)
    const statReceipts = [
      this.validateStatV2(fixture, STAT_KEYS.PARTICIPANT1_GOALS, fixture.homeScore ?? 0),
      this.validateStatV2(fixture, STAT_KEYS.PARTICIPANT2_GOALS, fixture.awayScore ?? 0),
      this.validateStat(fixture,   STAT_KEYS.PARTICIPANT1_RED_CARDS, fixture.homeRedCards ?? 0),
      this.validateStat(fixture,   STAT_KEYS.PARTICIPANT2_RED_CARDS, fixture.awayRedCards ?? 0),
      this.validateStat(fixture,   STAT_KEYS.PARTICIPANT1_CORNERS, fixture.homeCorners ?? 0),
      this.validateStat(fixture,   STAT_KEYS.PARTICIPANT2_CORNERS, fixture.awayCorners ?? 0),
    ];

    const allVerified = fixtureReceipt.verified && statReceipts.every((r) => r.verified);

    // 3. Tag each settlement record with proof state
    const proofState = allVerified ? "verified" : "failed";
    for (const rec of records) {
      rec.proofState     = proofState;
      rec.solanaSignature = fixtureReceipt.signature;
      rec.merkleRoot     = fixtureReceipt.data.merkleRoot;
    }

    eventBus.emit(
      allVerified ? EVENTS.VALIDATION_VERIFIED : EVENTS.VALIDATION_FAILED,
      domainEvent.create({
        source:        "onchain-validator",
        type:          allVerified ? EVENTS.VALIDATION_VERIFIED : EVENTS.VALIDATION_FAILED,
        correlationId: `fixture-${fixture.id}`,
        payload:       { fixture: fixture.id, allVerified, fixtureReceipt, statReceipts },
      })
    );

    logger.info(
      `  Validation ${allVerified ? "✅ VERIFIED" : "❌ FAILED"} — ` +
      `root: ${fixtureReceipt.data.merkleRoot?.slice(0, 18)}…`
    );

    return { fixtureReceipt, statReceipts, allVerified };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public state
  // ─────────────────────────────────────────────────────────────────────────

  status() {
    const all = [...this._receipts.values()];
    return {
      total:    all.length,
      verified: all.filter((r) => r.verified).length,
      failed:   all.filter((r) => !r.verified).length,
      receipts: all.slice(-50).reverse(),
    };
  }

  proofForFixture(fixtureId) {
    return this._proofs.get(fixtureId) ?? null;
  }

  reset() {
    this._proofs.clear();
    this._receipts.clear();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private
  // ─────────────────────────────────────────────────────────────────────────

  _getOrBuildProof(fixture) {
    if (!this._proofs.has(fixture.id)) {
      const bundle = proveFixture(fixture);
      this._proofs.set(fixture.id, bundle);
      eventBus.emit(
        EVENTS.PROOF_GENERATED,
        domainEvent.create({
          source: "onchain-validator",
          type:   EVENTS.PROOF_GENERATED,
          correlationId: `fixture-${fixture.id}`,
          payload: { fixtureId: fixture.id, root: bundle.root, leafCount: bundle.leafCount },
        })
      );
    }
    return this._proofs.get(fixture.id);
  }

  _receipt(fixtureId, method, verified, data) {
    const signature = hashReceipt({
      programId: PROGRAM_ID,
      network:   NETWORK,
      fixtureId,
      method,
      verified,
      data,
      ts: Date.now(),
    });

    const receipt = {
      fixtureId,
      method,
      verified,
      signature,
      network:     NETWORK,
      programId:   PROGRAM_ID,
      solscanUrl:  `https://solscan.io/tx/${signature}`,
      timestamp:   new Date().toISOString(),
      data,
    };

    // Store by composite key
    this._receipts.set(`${fixtureId}:${method}:${data.statKey ?? "fixture"}`, receipt);
    return receipt;
  }
}

export default new OnchainValidator();
