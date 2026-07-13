# Submission Template

## Project Name

EdgeLine OS

## Track

Trading Tools and Agents

## One-Liner

Autonomous World Cup trading agents that read TxLINE odds and score streams, detect edge, quote markets, manage risk, and track paper PnL.

## Links

- Demo video:
- Public repo:
- Deployed app:
- API endpoint:

## What It Does

EdgeLine OS runs four autonomous agents over TxLINE World Cup data:

- Sharp Sentinel detects major odds movement.
- Model Voyager compares market prices to an in-play model.
- Maker Prime quotes volatility-adjusted bid/ask prices.
- Counterflow competes with an opposite strategy in an agent arena.

The system logs every signal, applies risk limits, tracks paper positions, and displays results in a real-time control room.

## TxLINE Endpoints Used

- `/api/fixtures/snapshot`
- `/api/odds/stream`
- `/api/scores/stream`
- `/api/odds/snapshot/:fixtureId`
- `/api/scores/snapshot/:fixtureId`

## Technical Highlights

- Dependency-free Node server.
- SSE dashboard updates.
- Deterministic replay mode for judge review.
- Live TxLINE client adapter.
- Transparent strategy math.
- Risk limits and paper PnL.

## Feedback For TxODDS

What worked well:

- Normalized odds and score schema makes multi-agent analysis much easier.
- Fast streams are a natural fit for autonomous detection and quoting.
- World Cup free tier makes hackathon testing practical.

Friction:

- More official sample payloads would help agent builders test without waiting for live matches.
- A canonical replay/sandbox stream would make demo preparation easier.
