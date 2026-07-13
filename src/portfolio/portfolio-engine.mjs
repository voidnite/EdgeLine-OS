// src/portfolio/portfolio-engine.mjs

import logger from "../logger/logger.mjs";
import eventBus from "../core/event-bus.mjs";
import EVENTS from "../core/events.mjs";
import domainEvent from "../core/domain-event.mjs";
class PortfolioEngine {

    constructor() {

        this.reset();

    }

    /**
     * Reset the entire portfolio.
     */
    reset() {

        this.initialCapital = 10000;

        this.cash = this.initialCapital;

        this.openPositions = [];

        this.closedPositions = [];

        this.totalExposure = 0;

        this.totalTrades = 0;

        this.wins = 0;

        this.losses = 0;

        this.realizedPnL = 0;

        this.unrealizedPnL = 0;

    }

    /**
     * Open a new trading position.
     */
    open(signal) {

        if (!signal.approved) {

            logger.warn(

                `Trade rejected (${signal.id})`

            );

            return null;

        }

        const now = Date.now();

        const position = {

            //----------------------------------
            // Identity
            //----------------------------------

            id: signal.id,

            fixtureId: signal.fixtureId,

            strategy: signal.strategy,

            action: signal.action,

            side: signal.side,

            //----------------------------------
            // Match
            //----------------------------------

            homeTeam: signal.homeTeam,

            awayTeam: signal.awayTeam,

            //----------------------------------
            // Trading
            //----------------------------------

            confidence: signal.confidence,

            riskLevel: signal.riskLevel,

            positionSize: signal.positionSize,

            entryMinute: signal.minute,

            entryOdds:

                signal.raw?.marketOdds ?? 2,

            stopLoss:

                signal.stopLoss,

            takeProfit:

                signal.takeProfit,

            //----------------------------------
            // Lifecycle
            //----------------------------------

            openedAt: now,

            closedAt: null,

            status: "OPEN",

            result: null,

            currentPnL: 0,

            exitOdds: null,

            //----------------------------------
            // Timeline
            //----------------------------------

            lifecycle: [

                {

                    state: "OPENED",

                    timestamp: now

                }

            ]

        };

        //----------------------------------
        // Portfolio updates
        //----------------------------------

        this.cash -= position.positionSize;

        this.totalExposure += position.positionSize;

        this.totalTrades++;

        this.openPositions.push(position);

        //----------------------------------
        // Audit
        //----------------------------------

        eventBus.emit(

            EVENTS.PORTFOLIO_POSITION_OPENED,

            domainEvent.create({

                source: "portfolio",

                type: EVENTS.PORTFOLIO_POSITION_OPENED,

                payload: position,

                correlationId: position.id

            })

        );
        logger.info(

            `Opened Position ${position.id}`,

            {

                fixtureId: position.fixtureId,

                strategy: position.strategy,

                stake: position.positionSize

            }

        );

        return position;

    }

    /**
     * Update unrealized P/L.
     */
    update(signal) {

        const position =

            this.openPositions.find(

                p => p.id === signal.id

            );

        if (!position) {

            return;

        }

        const currentOdds =

            signal.raw?.marketOdds ??

            position.entryOdds;

        const pnl =

            (

                (

                    position.entryOdds -

                    currentOdds

                )

                /

                position.entryOdds

            )

            *

            position.positionSize;

        position.currentPnL =

            Math.round(pnl);

        position.exitOdds =

            currentOdds;

        position.lifecycle.push({

            state: "UPDATED",

            timestamp: Date.now(),

            pnl: position.currentPnL,

            odds: currentOdds

        });

        eventBus.emit(

            EVENTS.PORTFOLIO_POSITION_UPDATED,

            domainEvent.create({

                source: "portfolio",

                type: EVENTS.PORTFOLIO_POSITION_UPDATED,

                correlationId: position.id,

                payload: {

                    position,

                    marketOdds: currentOdds,

                    pnl: position.currentPnL

                }

            })

        );

        this.calculateUnrealizedPnL();

    }

    /**
     * Close a position.
     */
    close(id, result = "LOSE") {

        const index =

            this.openPositions.findIndex(

                p => p.id === id

            );

        if (index === -1) {

            return;

        }

        const position =

            this.openPositions[index];

        //----------------------------------
        // Final state
        //----------------------------------

        position.status = "CLOSED";

        position.closedAt = Date.now();

        position.result = result;

        if (result === "WIN") {

            this.wins++;

            position.currentPnL =

                position.takeProfit;

        }

        else {

            this.losses++;

            position.currentPnL =

                -position.stopLoss;

        }

        position.lifecycle.push({

            state: "CLOSED",

            timestamp: position.closedAt,

            result,

            pnl: position.currentPnL

        });

        //----------------------------------
        // Portfolio updates
        //----------------------------------

        this.cash +=

            position.positionSize +

            position.currentPnL;

        this.realizedPnL +=

            position.currentPnL;

        this.totalExposure -=

            position.positionSize;

        //----------------------------------
        // Move position
        //----------------------------------

        this.closedPositions.push(position);

        this.openPositions.splice(index, 1);

        this.calculateUnrealizedPnL();

        //----------------------------------
        // Immutable audit event
        //----------------------------------

        eventBus.emit(

            EVENTS.PORTFOLIO_POSITION_CLOSED,

            domainEvent.create({

                source: "portfolio",

                type: EVENTS.PORTFOLIO_POSITION_CLOSED,

                correlationId: position.id,

                payload: {

                    position,

                    result,

                    pnl: position.currentPnL

                }

            })

        );
        logger.info(

            `Closed Position ${position.id}`,

            {

                result,

                pnl: position.currentPnL

            }

        );

    }
    /**
 * Recalculate unrealized P/L.
 */
    calculateUnrealizedPnL() {

        this.unrealizedPnL =

            this.openPositions.reduce(

                (total, position) =>

                    total + position.currentPnL,

                0

            );

    }

    /**
     * Portfolio Return on Investment.
     */
    roi() {

        if (this.initialCapital === 0) {

            return 0;

        }

        return Number(

            (

                (this.realizedPnL /

                    this.initialCapital)

                * 100

            ).toFixed(2)

        );

    }

    /**
     * Portfolio win rate.
     */
    winRate() {

        const total =

            this.wins +

            this.losses;

        if (total === 0) {

            return 0;

        }

        return Number(

            (

                (this.wins / total)

                * 100

            ).toFixed(2)

        );

    }

    /**
     * Exposure grouped by strategy.
     */
    exposureByStrategy() {

        const exposure = {};

        for (const position of this.openPositions) {

            exposure[position.strategy] ??= {

                positions: 0,

                exposure: 0

            };

            exposure[position.strategy].positions++;

            exposure[position.strategy].exposure +=

                position.positionSize;

        }

        return exposure;

    }

    /**
     * Exposure grouped by fixture.
     */
    exposureByFixture() {

        const exposure = {};

        for (const position of this.openPositions) {

            exposure[position.fixtureId] ??= {

                fixtureId: position.fixtureId,

                match:

                    `${position.homeTeam} vs ${position.awayTeam}`,

                positions: 0,

                exposure: 0

            };

            exposure[position.fixtureId].positions++;

            exposure[position.fixtureId].exposure +=

                position.positionSize;

        }

        return exposure;

    }

    /**
     * Lightweight dashboard summary.
     */
    summary() {

        return {

            capital:

                this.initialCapital,

            cash:

                this.cash,

            equity:

                this.cash +

                this.unrealizedPnL,

            exposure:

                this.totalExposure,

            realizedPnL:

                this.realizedPnL,

            unrealizedPnL:

                this.unrealizedPnL,

            roi:

                this.roi(),

            trades:

                this.totalTrades,

            wins:

                this.wins,

            losses:

                this.losses,

            winRate:

                this.winRate()

        };

    }

    /**
     * Full portfolio status.
     */
    status() {

        return {

            summary:

                this.summary(),

            openPositions:

                this.openPositions,

            closedPositions:

                this.closedPositions,

            strategyExposure:

                this.exposureByStrategy(),

            fixtureExposure:

                this.exposureByFixture(),

            portfolioEvents:

                portfolioEventLog.status()

        };

    }

}

export default new PortfolioEngine();