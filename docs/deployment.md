# Deployment

## Frontend And Backend Together

EdgeLine OS is a single Node app. It serves the frontend and API from one process.

Recommended hosts:

- Render
- Railway
- Fly.io
- DigitalOcean App Platform

## Render Settings

- Root directory: `trading-tools-agents`
- Build command: leave empty
- Start command: `node server.mjs`

Environment variables:

```bash
PORT=8899
AGENT_TICK_MS=3000
TXLINE_LIVE=false
TXLINE_NETWORK=mainnet
TXLINE_GUEST_JWT=
TXLINE_API_TOKEN=
```

For live TxLINE mode:

```bash
TXLINE_LIVE=true
TXLINE_GUEST_JWT=your_guest_jwt
TXLINE_API_TOKEN=your_activated_api_token
```

## Judge URL

After deploy, submit the app URL. Judges can open the dashboard and also test:

```text
/api/health
/api/state
/api/signals
/api/stream
```
