# EdgeLine OS

EdgeLine OS is an autonomous trading tools and agents submission for the TxODDS World Cup track. It ingests TxLINE-style odds and score updates, runs deterministic agents, logs decisions, tracks paper PnL, and exposes a professional control-room UI for judges.

The system is designed for two modes:

- Deterministic replay: works immediately for demos and judging when live match activity is quiet.
- Live-ready TxLINE mode: uses TxLINE credentials to connect to World Cup scores and odds streams.

## Why This Should Score Well

- Core functionality: running backend agent loop, SSE updates, odds board, positions, signals, receipts.
- Autonomous operation: agents run on a schedule without manual intervention.
- Logic quality: every strategy is deterministic, documented, and risk-limited.
- Novelty: combines sharp movement detection, model-vs-market edge, market-maker quotes, and agent-vs-agent counterflow.
- Production readiness: server API, streaming UI, risk controls, no frontend secrets, deployable Node app.

## Run Locally

```bash
cd trading-tools-agents
node server.mjs
```

Open:

```text
http://localhost:8899
```

No npm install is required because the project uses only Node built-ins.

## Live TxLINE Mode

Create `.env` from `.env.example`, then set:

```bash
TXLINE_LIVE=true
TXLINE_NETWORK=devnet
TXLINE_GUEST_JWT=your_guest_jwt
TXLINE_API_TOKEN=your_activated_api_token
```

The live client is in `src/txline-client.mjs`. The replay engine remains available as a fallback for demo reliability.

## API

- `GET /api/health`
- `GET /api/state`
- `GET /api/signals`
- `GET /api/stream`
- `POST /api/control` with `{ "action": "start" | "pause" | "reset" | "tick" }`

## TxLINE Endpoints Used

- `/api/fixtures/snapshot`
- `/api/odds/stream`
- `/api/scores/stream`
- `/api/odds/snapshot/:fixtureId`
- `/api/scores/snapshot/:fixtureId`

## Submission Links

- Public repo:
- Deployed app:
- Demo video:
- Backend/API endpoint:
