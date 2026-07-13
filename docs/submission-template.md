# EdgeLine OS — Hackathon Submission

## Project Name
EdgeLine OS

## Tagline
Autonomous AI sports trading powered by TxLINE oracle data and Solana on-chain settlement.

---

## Demo Video
[INSERT LOOM/YOUTUBE LINK HERE]

---

## Public Repository
https://github.com/voidnite/EdgeLine-OS

---

## Live Application
https://edgeline-os.onrender.com

---

## Brief Technical Documentation

### Core Idea
EdgeLine OS is a fully autonomous AI sports trading platform. Four independent AI agents continuously analyse live World Cup data from the TxLINE oracle — detecting odds movements, finding model-vs-market edge, making bid/ask quotes, and fading overextended moves. Every trade decision is made programmatically with no human intervention. At full time, match results are cryptographically verified on Solana mainnet using TxLINE's Merkle proof system before any settlement calculation occurs.

### Business Highlights
- Fully autonomous operation — 4 agents trade 24/7 without human input
- Real-time World Cup data from TxLINE SSE stream
- On-chain settlement via Solana Merkle proofs (trustless, verifiable)
- Telegram bot sends live signal and settlement alerts to any device
- MongoDB Atlas persistence for user accounts and trade history
- Production-ready: glass-morphism dashboard, multi-screen navigation, JWT auth

### Technical Architecture
```
TxLINE SSE Stream (/api/scores/stream)
    ↓
Engine (ticks every 3s) → 4 AI Agents → Risk Engine → Position Manager
    ↓
Settlement Engine → On-Chain Validator (validateFixture, validateStat, validateStatV2)
    ↓
Telegram Alerts + Dashboard (SSE /api/stream)
```

### TxLINE Endpoints Used
- `POST /auth/guest/start` — Guest JWT authentication
- `POST /api/token/activate` — Subscription activation with Solana wallet signature
- `GET /api/fixtures/snapshot` — Live fixture list with GameState
- `GET /api/scores/snapshot/{fixtureId}` — Live score data
- `GET /api/scores/historical/{fixtureId}` — Completed match score history
- `GET /api/scores/stream` (SSE) — Real-time score event stream (primary data feed)
- `GET /api/scores/stat-validation` — Merkle proof retrieval
- On-chain: `validateStat()`, `validateStatV2()`, `validateFixture()` via Solana program `9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA`

### Subscription Details
- Network: Solana Mainnet
- Service Level: 12 (real-time World Cup & International Friendlies)
- Wallet: `mMtLWyZEF6AQnUp2UsBVk4LJfsiynqhbRyNHiqo9AMt`

---

## TxLINE API Feedback

### What we liked most
The single normalised JSON schema is genuinely impressive — no schema changes needed across group stage, knockout rounds, or different competitions. The SSE stream reliability was excellent; 15-second heartbeats gave our reconnect manager clear signals to work with. The Merkle proof system is the standout feature — `validateStatV2` with indexed multi-stat strategies is an elegant design that scales cleanly and opens up settlement use cases far beyond simple win/loss.

### Where we hit friction
The `GameState` field is numeric (1/2/3) in the fixture snapshot but a string in the score stream — this type inconsistency required debugging to discover. The `/api/scores/snapshot/{id}` endpoint returns an empty array for completed matches with no clear documentation to use `/api/scores/historical/{id}` instead; the historical endpoint also returns SSE-formatted data rather than plain JSON, requiring a custom parser. The on-chain activation flow is well-documented but the error when an ATA (Associated Token Account) doesn't exist gives an opaque Anchor error code rather than a clear "create your token account first" message — this blocked us for several hours. Finally, score data (goals, cards) is absent from the fixture snapshot, so bootstrapping a fixture's current score on server startup requires an additional historical endpoint call that isn't mentioned in the quickstart.
