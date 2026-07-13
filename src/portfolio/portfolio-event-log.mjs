// src/portfolio/portfolio-event-log.mjs

import crypto from "node:crypto";

import eventBus from "../core/event-bus.mjs";

import EVENTS from "../core/events.mjs";

import logger from "../logger/logger.mjs";

class PortfolioEventLog {

    constructor() {

        this.events = [];

        this.register();

    }

    register() {

        eventBus.on(

            EVENTS.PORTFOLIO_POSITION_OPENED,

            event => {

                this.record(

                    event.type,

                    event.payload,

                    event

                );

            }

        );

        eventBus.on(

            EVENTS.PORTFOLIO_POSITION_UPDATED,

            event => {

                this.record(

                    event.type,

                    event.payload.position,

                    event

                );

            }

        );
        eventBus.on(

            EVENTS.PORTFOLIO_POSITION_CLOSED,

            event => {

                this.record(

                    event.type,

                    event.payload.position,

                    event

                );

            }

        );
        eventBus.on(

            EVENTS.PORTFOLIO_POSITION_SETTLED,

            payload =>

                this.record(

                    "SETTLED",

                    payload.position,

                    payload

                )

        );

    }

    record(type, position, metadata = {}) {

        const event = {

            id: crypto.randomUUID(),

            sequence: this.events.length + 1,

            type,

            timestamp: Date.now(),

            isoTime: new Date().toISOString(),

            positionId: position.id,

            fixtureId: position.fixtureId,

            strategy: position.strategy,

            action: position.action,

            side: position.side,

            status: position.status,

            positionSize: position.positionSize,

            currentPnL: position.currentPnL,

            metadata

        };

        this.events.push(event);

        logger.info(

            `Portfolio Event: ${type}`,

            {

                sequence: event.sequence,

                positionId: event.positionId

            }

        );

    }

    latest(limit = 20) {

        return this.events

            .slice(-limit)

            .reverse();

    }

    history() {

        return [...this.events];

    }

    clear() {

        this.events = [];

    }

    status() {

        return {

            totalEvents: this.events.length,

            latest: this.latest()

        };

    }

}

export default new PortfolioEventLog();