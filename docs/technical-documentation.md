# EdgeLine OS — Technical Documentation

## Core Idea

EdgeLine OS is an autonomous AI-powered sports trading platform built on top of the TxLINE oracle. It deploys four independent AI agents that continuously analyse live World Cup match data — odds movements, score updates, and model probabilities — and autonomously open, manage, and settle trading positions without any human intervention.

Every settled trade is cryptographically verified on Solana mainnet using TxLINE's Merkle proof system before payout is calculated. Users simply watch the agents work, monitor their portfolio, and receive real-time Telegram alerts.

---

## Business Highlights

- **Fully autonomous** — agents run 24/7, no manual trading required
- **Live oracle data** — all decisions powered by real TxLINE World Cup streams
- **On-chain settlement** — Solana Merkle proofs validate every result
- **Multi-agent architecture** — four agents with competing strategies running simultaneously
- **Production-grade** — MongoDB persistence, Telegram notifications, glass-morphism UI, JWT authentication

---

## Technical Highlights

### Architecture

```
TxLINE Oracle SSE Stream
       ↓
   Engine.mjs (tick every 3s)
       ↓
4 Strategy Agents evaluate each fixture:
  ├── Sharp Sentinel   (odds movement detection)
  ├── Model Voyager    (ELO model vs market edge)
  ├── Maker Prime      (bid/ask market making)
  └── Counterflow      (fade overextended moves)
       ↓
Risk Engine (Kelly Criterion sizing, exposure caps)
       ↓
Position Manager (open, track, close positions)
       ↓
Settlement Engine (detect Full Time → settle trades)
       ↓
On-Chain Validator (Merkle proof via TxLINE API)
       ↓
Telegram Bot (alert user) + Dashboard (live UI)
```

### Key Modules

| Module | Purpose |
|---|---|
| `src/engine.mjs` | Master engine — coordinates all agents, ticks every 3s |
| `src/strategies.mjs` | 4 agent strategies with ELO-based pre-match signals |
| `src/txline/fixtures-loader.mjs` | Fetches live fixtures from `/api/fixtures/snapshot` |
| `src/txline/sse-client.mjs` | SSE stream consumer for `/api/scores/stream` |
| `src/settlement/settlement-engine.mjs` | Detects Final status, settles positions |
| `src/proof/onchain-validator.mjs` | Calls `validateStat`, `validateStatV2`, `validateFixture` |
| `src/proof/merkle-proof.mjs` | Deterministic Merkle tree over fixture stats |
| `src/analytics/analytics-engine.mjs` | Sharpe ratio, leaderboard, EV chart, heatmap |
| `src/telegram/bot.mjs` | Real-time signal and settlement Telegram alerts |
| `src/db/mongoose.mjs` | MongoDB Atlas persistence for users, settlements, proofs |

---

## TxLINE Endpoints Used

| Endpoint | Purpose |
|---|---|
| `POST /auth/guest/start` | Obtain guest JWT for API authentication |
| `POST /api/token/activate` | Activate API subscription with wallet signature |
| `GET /api/fixtures/snapshot` | Fetch current World Cup fixture list with game states |
| `GET /api/scores/snapshot/{fixtureId}` | Get live score for a specific fixture |
| `GET /api/scores/historical/{fixtureId}` | Get historical score records for completed matches |
| `GET /api/scores/stream` (SSE) | Real-time score event stream — primary data feed |
| `GET /api/scores/stat-validation` | Retrieve Merkle proof for stat validation |
| `validateStat()` | On-chain Solana: validate a single statistic |
| `validateStatV2()` | On-chain Solana: multi-stat validation with period breakdown |
| `validateFixture()` | On-chain Solana: validate entire fixture outcome |

### On-Chain Program (Mainnet)
- **Program ID:** `9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA`
- **Network:** Solana Mainnet
- **Subscription:** Service Level 12 (real-time World Cup + International Friendlies)
- **Wallet:** `mMtLWyZEF6AQnUp2UsBVk4LJfsiynqhbRyNHiqo9AMt`

---

## Stack

- **Backend:** Node.js (ESM), server.mjs HTTP server, SSE streaming
- **Frontend:** Vanilla JS, glass-morphism CSS, HTML5 Canvas for charts
- **Database:** MongoDB Atlas (free tier) via Mongoose + bcryptjs
- **Notifications:** Telegram Bot API (polling mode)
- **Blockchain:** Solana Mainnet — TxLINE oracle program
- **Deployment:** Render (free tier web service, auto-deploy from GitHub)

---

## TxLINE API Feedback

**What we liked most:**
- The single normalised JSON schema is genuinely impressive — switching from group stage to knockout fixtures required zero code changes
- SSE stream reliability was excellent — heartbeats every 15 seconds gave us confidence the connection was healthy
- The Merkle proof system is a standout feature — being able to prove individual stats on-chain opens up use cases far beyond simple settlement
- `validateStatV2` with indexed multi-stat strategies is a clever design that scales cleanly
- The PascalCase fixture fields (`Participant1`, `FixtureId`, `GameState`) are consistent and easy to work with once documented

**Where we hit friction:**
- The `GameState` field is a numeric value (1/2/3) in the fixture snapshot but a string in the score stream — took debugging to discover the type mismatch
- `/api/scores/snapshot/{id}` returns an empty array for completed matches — had to fall back to `/api/scores/historical/{id}` which returns SSE-formatted data (not plain JSON), requiring a custom parser
- The activation flow (subscribe on-chain → sign message → POST activate) is well-documented but the error when the ATA (Associated Token Account) doesn't exist gives an opaque Anchor error rather than a clear "create your token account first" message
- Score data (goals, cards) in the fixture snapshot is absent — scores only arrive via the stream, so pre-seeding a fixture with its current score on startup requires the historical endpoint
