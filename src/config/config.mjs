import dotenv from "dotenv";

dotenv.config();

const network = process.env.TXLINE_NETWORK || "devnet";

const apiBase =
    network === "mainnet"
        ? "https://txline.txodds.com"
        : "https://txline-dev.txodds.com";

const config = {

    app: {

        port: Number(process.env.PORT || 8899),

        tickMs: Number(process.env.AGENT_TICK_MS || 3000),

        liveMode: process.env.TXLINE_LIVE === "true",

    },

    txline: {

        network,

        apiBase,

        apiToken: process.env.TXLINE_API_TOKEN,

        endpoints: {

            // Authentication
            guestAuth: "/auth/guest/start",

            // Live Streams
            scoresStream: "/api/scores/stream",
            oddsStream: "/api/odds/stream",

            // Historical APIs
            scoresSnapshot: "/api/scores/snapshot",
            scoresHistory: "/api/scores/history",

            oddsSnapshot: "/api/odds/snapshot",
            oddsHistory: "/api/odds/history",

            fixtures: "/api/fixtures/snapshot",

            // Merkle Validation
            scoreValidation: "/api/scores/stat-validation",
            oddsValidation: "/api/odds/market-validation",

        }

    }

};

export default config;