// src/txline/parser.mjs

export const EventType = Object.freeze({
    SCORE: "score",
    HEARTBEAT: "heartbeat",
    UNKNOWN: "unknown",
});

class TxLineParser {

    parse(raw) {

        try {

            const payload =
                typeof raw === "string"
                    ? JSON.parse(raw)
                    : raw;

            return {

                type:
                    this.detectType(payload),

                receivedAt:
                    Date.now(),

                payload,

                valid: true

            };

        }

        catch (error) {

            return {

                type: EventType.UNKNOWN,

                receivedAt: Date.now(),

                valid: false,

                error: error.message,

                payload: raw

            };

        }

    }

    detectType(payload) {

        if (
            payload?.event === "heartbeat" ||
            payload?.type === "heartbeat"
        ) {
            return EventType.HEARTBEAT;
        }

        return EventType.SCORE;

    }

}

export default new TxLineParser();