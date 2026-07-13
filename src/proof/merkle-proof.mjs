// src/proof/merkle-proof.mjs
//
// Deterministic Merkle tree built over a fixture's final statistics.
// Each "leaf" is a canonical stat record: { fixtureId, statKey, value, period }.
// Produces a Merkle root and a proof path for any leaf index so the
// on-chain validator can verify individual claims without the full tree.

import { hashReceipt } from "../math.mjs";
import STAT_KEYS from "../txline/protocol/stat-keys.mjs";

// ─── Canonical leaf shape ────────────────────────────────────────────────────

/**
 * Build the ordered list of leaves from a settled fixture.
 * Every measurable statistic becomes one leaf.
 */
export function fixtureLeaves(fixture) {
  const { id, homeScore, awayScore, home, away, stage } = fixture;

  return [
    leaf(id, STAT_KEYS.PARTICIPANT1_GOALS,        homeScore ?? 0,  "FULL_GAME", home),
    leaf(id, STAT_KEYS.PARTICIPANT2_GOALS,        awayScore ?? 0,  "FULL_GAME", away),
    leaf(id, STAT_KEYS.PARTICIPANT1_YELLOW_CARDS, fixture.homeYellowCards ?? 0, "FULL_GAME", home),
    leaf(id, STAT_KEYS.PARTICIPANT2_YELLOW_CARDS, fixture.awayYellowCards ?? 0, "FULL_GAME", away),
    leaf(id, STAT_KEYS.PARTICIPANT1_RED_CARDS,    fixture.homeRedCards    ?? 0, "FULL_GAME", home),
    leaf(id, STAT_KEYS.PARTICIPANT2_RED_CARDS,    fixture.awayRedCards    ?? 0, "FULL_GAME", away),
    leaf(id, STAT_KEYS.PARTICIPANT1_CORNERS,      fixture.homeCorners     ?? 0, "FULL_GAME", home),
    leaf(id, STAT_KEYS.PARTICIPANT2_CORNERS,      fixture.awayCorners     ?? 0, "FULL_GAME", away),
  ];
}

function leaf(fixtureId, statKey, value, period, participant) {
  return { fixtureId, statKey, value, period, participant };
}

// ─── Merkle tree ─────────────────────────────────────────────────────────────

/**
 * Build a full Merkle tree from an ordered array of leaf objects.
 * Returns { root, layers } where layers[0] are leaf hashes, layers[n-1] is [root].
 */
export function buildTree(leaves) {
  if (!leaves.length) {
    const root = hashLeaf({ empty: true });
    return { root, layers: [[root]] };
  }

  // Layer 0: hash every leaf
  let layer = leaves.map((l) => hashLeaf(l));
  const layers = [layer];

  while (layer.length > 1) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left  = layer[i];
      const right = layer[i + 1] ?? layer[i]; // duplicate last node if odd
      next.push(combineHashes(left, right));
    }
    layers.push(next);
    layer = next;
  }

  return { root: layer[0], layers };
}

/**
 * Generate a proof path for the leaf at `index`.
 * Returns an array of { hash, position: "left"|"right" } sibling nodes
 * that, together with the leaf hash, reconstruct the root.
 */
export function generateProof(layers, index) {
  const proof = [];
  let idx = index;

  for (let depth = 0; depth < layers.length - 1; depth++) {
    const layer  = layers[depth];
    const isLeft = idx % 2 === 0;
    const sibIdx = isLeft ? idx + 1 : idx - 1;
    const sibling = layer[sibIdx] ?? layer[idx]; // odd-length: self-pair

    proof.push({
      hash:     sibling,
      position: isLeft ? "right" : "left",
    });

    idx = Math.floor(idx / 2);
  }

  return proof;
}

/**
 * Verify a proof path against a known root.
 * Returns true if the leaf + proof reconstruct the root exactly.
 */
export function verifyProof(leafHash, proof, root) {
  let current = leafHash;

  for (const step of proof) {
    current = step.position === "right"
      ? combineHashes(current, step.hash)
      : combineHashes(step.hash, current);
  }

  return current === root;
}

// ─── Convenience: build everything for a fixture in one call ─────────────────

/**
 * @returns {object} Full proof bundle for a fixture:
 *   { fixtureId, root, leaves, proofs[] }
 * Each proofs[i] = { leaf, leafHash, proof, verified }
 */
export function proveFixture(fixture) {
  const leaves  = fixtureLeaves(fixture);
  const { root, layers } = buildTree(leaves);

  const proofs = leaves.map((l, i) => {
    const leafHash = hashLeaf(l);
    const proof    = generateProof(layers, i);
    return {
      leaf:     l,
      leafHash,
      proof,
      verified: verifyProof(leafHash, proof, root),
    };
  });

  return {
    fixtureId: fixture.id,
    match:     `${fixture.home} vs ${fixture.away}`,
    finalScore: `${fixture.homeScore}-${fixture.awayScore}`,
    root,
    leafCount: leaves.length,
    proofs,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Hashing helpers ─────────────────────────────────────────────────────────

function hashLeaf(leafObj) {
  return hashReceipt({ __leaf: true, ...leafObj });
}

function combineHashes(left, right) {
  return hashReceipt({ __node: true, left, right });
}
