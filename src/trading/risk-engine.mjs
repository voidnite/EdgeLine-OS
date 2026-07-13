// src/trading/risk-engine.mjs

import logger from "../logger/logger.mjs";
import eventBus from "../core/event-bus.mjs";
import EVENTS from "../core/events.mjs";
import domainEvent from "../core/domain-event.mjs";
class RiskEngine {

    constructor() {

        this.config = {

            bankroll: 10000,

            maxExposurePercent: 25,

            maxTradePercent: 5,

            stopLossPercent: 10,

            takeProfitPercent: 20,

            dailyLossLimitPercent: 15

        };

        this.currentExposure = 0;

        this.dailyPnL = 0;

    }

    /**
     * Main risk calculation.
     */
    calculate(score, confidence) {

        const reasons = [];

        //------------------------------------
        // Kelly Criterion
        //------------------------------------

        const probability =
            confidence.value / 100;

        const odds =
            score.marketOdds ?? 2.0;

        const kelly =
            this.kelly(probability, odds);

        //------------------------------------
        // Suggested Stake
        //------------------------------------

        let positionSize =
            this.config.bankroll * kelly;

        //------------------------------------
        // Max trade size
        //------------------------------------

        const maxTrade =

            this.config.bankroll *

            (this.config.maxTradePercent / 100);

        if (positionSize > maxTrade) {

            positionSize = maxTrade;

            reasons.push(

                "Maximum trade size applied"

            );

        }

        //------------------------------------
        // Exposure
        //------------------------------------

        const maxExposure =

            this.config.bankroll *

            (this.config.maxExposurePercent / 100);

        const projectedExposure =

            this.currentExposure +

            positionSize;

        let approved = true;

        if (projectedExposure > maxExposure) {

            approved = false;

            reasons.push(

                "Maximum exposure exceeded"

            );

        }

        //------------------------------------
        // Daily Loss Limit
        //------------------------------------

        const dailyLimit =

            this.config.bankroll *

            (this.config.dailyLossLimitPercent / 100);

        if (

            Math.abs(this.dailyPnL)

            >= dailyLimit

        ) {

            approved = false;

            reasons.push(

                "Daily loss limit reached"

            );

        }

        //------------------------------------
        // Confidence filter
        //------------------------------------

        if (confidence.value < 60) {

            approved = false;

            reasons.push(

                "Confidence below threshold"

            );

        }

        //------------------------------------
        // Risk score
        //------------------------------------

        const riskScore =

            this.calculateRiskScore(

                confidence.value,

                projectedExposure,

                maxExposure

            );

        //------------------------------------
        // Stop loss
        //------------------------------------

        const stopLoss =

            positionSize *

            (this.config.stopLossPercent / 100);

        //------------------------------------
        // Take profit
        //------------------------------------

        const takeProfit =

            positionSize *

            (this.config.takeProfitPercent / 100);

        const result = {

            approved,

            reasons,

            kelly,

            positionSize:

                Math.round(positionSize),

            stopLoss:

                Math.round(stopLoss),

            takeProfit:

                Math.round(takeProfit),

            projectedExposure:

                Math.round(projectedExposure),

            riskScore,

            riskLevel:

                this.riskLevel(riskScore)

        };

        logger.debug(`Risk Score: ${riskScore}`);

        // Publish risk decision
        eventBus.emit(

            approved
                ? EVENTS.RISK_APPROVED
                : EVENTS.RISK_REJECTED,

            domainEvent.create({

                source: "risk-engine",

                type: approved
                    ? EVENTS.RISK_APPROVED
                    : EVENTS.RISK_REJECTED,

                correlationId:
                    `fixture-${score.fixtureId ?? "unknown"}`,

                payload: {

                    score,

                    result

                }

            })

        );

        return result;
    }

    /**
     * Kelly Criterion
     */
    kelly(probability, odds) {

        const b = odds - 1;

        const p = probability;

        const q = 1 - p;

        const fraction =

            ((b * p) - q) / b;

        return Math.max(

            0,

            Math.min(

                fraction,

                this.config.maxTradePercent / 100

            )

        );

    }

    /**
     * Portfolio exposure.
     */
    addExposure(amount) {

        this.currentExposure += amount;

    }

    removeExposure(amount) {

        this.currentExposure =

            Math.max(

                0,

                this.currentExposure - amount

            );

    }

    /**
     * Record realised P/L.
     */
    updatePnL(amount) {

        this.dailyPnL += amount;

    }

    resetDay() {

        this.dailyPnL = 0;

    }

    calculateRiskScore(

        confidence,

        projectedExposure,

        maxExposure

    ) {

        let score = 100;

        score -=

            (100 - confidence) * 0.4;

        score -=

            (projectedExposure /

                maxExposure) * 30;

        score =

            Math.max(

                0,

                Math.min(

                    100,

                    Math.round(score)

                )

            );

        return score;

    }

    riskLevel(score) {

        if (score >= 80)

            return "LOW";

        if (score >= 60)

            return "MEDIUM";

        if (score >= 40)

            return "HIGH";

        return "VERY_HIGH";

    }

    status() {

        return {

            bankroll:

                this.config.bankroll,

            currentExposure:

                this.currentExposure,

            exposurePercent:

                Math.round(

                    (this.currentExposure /

                        this.config.bankroll)

                    * 100

                ),

            dailyPnL:

                this.dailyPnL

        };


        const result = {

            approved,

            reasons,

            kelly,

            positionSize:

                Math.round(positionSize),

            stopLoss:

                Math.round(stopLoss),

            takeProfit:

                Math.round(takeProfit),

            projectedExposure:

                Math.round(projectedExposure),

            riskScore,

            riskLevel:

                this.riskLevel(riskScore)

        };

        logger.debug(`Risk Score: ${riskScore}`);

        // Publish risk decision
        eventBus.emit(

            approved
                ? EVENTS.RISK_APPROVED
                : EVENTS.RISK_REJECTED,

            domainEvent.create({

                source: "risk-engine",

                type: approved
                    ? EVENTS.RISK_APPROVED
                    : EVENTS.RISK_REJECTED,

                correlationId:
                    `fixture-${score.fixtureId ?? "unknown"}`,

                payload: {

                    score,

                    result

                }

            })

        );

        return result;

    }

}

export default new RiskEngine();