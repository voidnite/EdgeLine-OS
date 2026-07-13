// src/trading/signal-generator.mjs

import crypto from "node:crypto";

import logger from "../logger/logger.mjs";

class SignalGenerator {

    constructor() {

        this.sequence = 0;

    }

    /**
     * Create a standardized trading signal.
     */
    generate({

        strategy,

        score,

        decision,

        confidence,

        risk

    }) {

        this.sequence++;

        const signal = {

            id: this.generateId(),

            sequence: this.sequence,

            timestamp: Date.now(),

            isoTime: new Date().toISOString(),

            //----------------------------------
            // Match
            //----------------------------------

            fixtureId:
                score.fixtureId,

            homeTeam:
                score.homeTeam,

            awayTeam:
                score.awayTeam,

            minute:
                score.minute,

            period:
                score.period,

            status:
                score.status,

            //----------------------------------
            // Current Score
            //----------------------------------

            homeScore:
                score.homeScore,

            awayScore:
                score.awayScore,

            //----------------------------------
            // Decision
            //----------------------------------

            action:
                decision.action,

            side:
                decision.side ?? null,

            //----------------------------------
            // Strategy
            //----------------------------------

            strategy:
                strategy,

            //----------------------------------
            // Confidence
            //----------------------------------

            confidence:
                confidence.value,

            confidenceLevel:
                confidence.rating,

            recommendation:
                confidence.recommendation,

            confidenceReasons:
                confidence.reasons,

            //----------------------------------
            // Risk
            //----------------------------------

            approved:
                risk.approved,

            positionSize:
                risk.positionSize,

            kelly:
                risk.kelly,

            stopLoss:
                risk.stopLoss,

            takeProfit:
                risk.takeProfit,

            riskScore:
                risk.riskScore,

            riskLevel:
                risk.riskLevel,

            riskReasons:
                risk.reasons,

            //----------------------------------
            // Metadata
            //----------------------------------

            source: "TxLINE",

            version: "1.0.0",

            raw: score

        };

        logger.info(

            `${signal.action} ${signal.homeTeam} vs ${signal.awayTeam}`

        );

        return signal;

    }

    /**
     * Generate unique signal ID.
     */
    generateId() {

        return crypto.randomUUID();

    }

    /**
     * Clone signal.
     */
    clone(signal) {

        return structuredClone(signal);

    }

    /**
     * Dashboard summary.
     */
    summary(signal) {

        return {

            id:
                signal.id,

            action:
                signal.action,

            fixture:
                `${signal.homeTeam} vs ${signal.awayTeam}`,

            minute:
                signal.minute,

            confidence:
                signal.confidence,

            risk:
                signal.riskLevel,

            approved:
                signal.approved

        };

    }

    /**
     * Serialize.
     */
    toJSON(signal) {

        return JSON.stringify(

            signal,

            null,

            2

        );

    }

}

export default new SignalGenerator();