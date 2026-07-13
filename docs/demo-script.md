# Demo Video Script

Keep the video under 5 minutes.

## 0:00 - 0:30 Problem

World Cup odds and scores move too quickly for a manual operator to watch every match. TxLINE gives fast normalized odds and scores, so the opportunity is to turn that stream into autonomous trading intelligence.

## 0:30 - 1:20 App Walkthrough

Open EdgeLine OS. Show:

- Agent arena.
- Signal radar.
- World Cup odds board.
- Decision ledger.
- Open paper positions.

## 1:20 - 2:30 Autonomy

Click `Run agents`. Explain that the system keeps running without manual input. Every tick ingests odds and score updates, evaluates strategies, applies risk checks, and logs decisions.

Show the four agents:

- Sharp Sentinel.
- Model Voyager.
- Maker Prime.
- Counterflow.

## 2:30 - 3:30 TxLINE Integration

Show the technical overview or code quickly:

- `src/txline-client.mjs`
- `/api/odds/stream`
- `/api/scores/stream`
- `/api/fixtures/snapshot`

Explain that replay mode is included because live match activity may be quiet during judging.

## 3:30 - 4:30 Strategy Results

Show:

- New signals appearing.
- Confidence and rationale.
- Open PnL changing.
- Risk used.
- Latest receipt hash.

## 4:30 - 5:00 Close

Summarize:

EdgeLine OS turns TxLINE into an autonomous trading operations layer: it ingests, reasons, quotes, manages risk, and explains every decision.
