// src/trading/decision-logger.mjs

import eventBus from "../core/event-bus.mjs";
import EVENTS from "../core/events.mjs";
import logger from "../logger/logger.mjs";

class DecisionLogger {

    constructor() {

        this.decisions = [];

        this.maxHistory = 1000;

        this.register();

    }

    /**
     * Subscribe to strategy events.
     */
    register() {

        eventBus.on(

            EVENTS.STRATEGY_SIGNAL,

            event => this.record(event)

        );

    }

    /**
     * Record a trading decision.
     */
    record(event) {

        const signal = event.payload;

        const decision = {

            id: event.id,

            correlationId: event.correlationId,

            timestamp: event.timestamp,

            isoTime: event.isoTime,

            source: event.source,

            fixtureId: signal.fixtureId,

            strategy: signal.strategy,

            action: signal.action,

            side: signal.side,

            confidence:

                signal.confidence?.value ??

                signal.confidence,

            confidenceReasons:

                signal.confidence?.reasons ??

                [],

            riskLevel:

                signal.risk?.riskLevel ??

                "UNKNOWN",

            riskScore:

                signal.risk?.riskScore ??

                0,

            approved:

                signal.risk?.approved ??

                false,

            positionSize:

                signal.risk?.positionSize ??

                0,

            stopLoss:

                signal.risk?.stopLoss ??

                0,

            takeProfit:

                signal.risk?.takeProfit ??

                0,

            homeTeam:

                signal.homeTeam,

            awayTeam:

                signal.awayTeam,

            score: {

                home:

                    signal.score?.homeScore,

                away:

                    signal.score?.awayScore,

                minute:

                    signal.score?.minute

            }

        };

        this.decisions.push(decision);

        if (

            this.decisions.length >

            this.maxHistory

        ) {

            this.decisions.shift();

        }

        logger.info(

            `Decision Logged: ${decision.action}`,

            {

                fixtureId:

                    decision.fixtureId,

                strategy:

                    decision.strategy,

                confidence:

                    decision.confidence

            }

        );

    }

    /**
     * Latest decisions.
     */
    latest(limit = 25) {

        return this.decisions

            .slice(-limit)

            .reverse();

    }

    /**
     * Decision history for one fixture.
     */
    byFixture(fixtureId) {

        return this.decisions.filter(

            decision =>

                decision.fixtureId ===

                fixtureId

        );

    }

    /**
     * Decision history for one strategy.
     */
    byStrategy(strategy) {

        return this.decisions.filter(

            decision =>

                decision.strategy ===

                strategy

        );

    }

    /**
     * Search by trade correlation ID.
     */
    byCorrelation(correlationId) {

        return this.decisions.filter(

            decision =>

                decision.correlationId ===

                correlationId

        );

    }

    /**
     * Dashboard summary.
     */
    status() {

        return {

            total:

                this.decisions.length,

            latest:

                this.latest(10)

        };

    }

    /**
     * Clear history.
     */
    clear() {

        this.decisions = [];

    }

}

export default new DecisionLogger();