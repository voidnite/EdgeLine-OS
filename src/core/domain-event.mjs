// src/core/domain-event.mjs

import crypto from "node:crypto";

class DomainEvent {

    create({

        source,

        type,

        payload,

        correlationId = null

    }) {

        return {

            id: crypto.randomUUID(),

            timestamp: Date.now(),

            isoTime: new Date().toISOString(),

            source,

            type,

            correlationId,

            payload

        };

    }

}

export default new DomainEvent();