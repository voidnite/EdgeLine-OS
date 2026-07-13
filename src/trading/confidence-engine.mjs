// src/trading/confidence-engine.mjs

import logger from "../logger/logger.mjs";

class ConfidenceEngine {

    calculate(score, decision) {

        const reasons = [];

        let confidence = 50;

        // --------------------------
        // Score Advantage
        // --------------------------

        const goalDifference =
            Math.abs(
                (score.homeScore ?? 0) -
                (score.awayScore ?? 0)
            );

        if (goalDifference >= 2) {

            confidence += 20;

            reasons.push(
                "Large goal advantage"
            );

        }
        else if (goalDifference === 1) {

            confidence += 10;

            reasons.push(
                "Team is leading"
            );

        }
        else {

            reasons.push(
                "Match is level"
            );

        }

        // --------------------------
        // Match Time
        // --------------------------

        const minute =
            score.minute ?? 0;

        if (minute >= 75) {

            confidence += 15;

            reasons.push(
                "Late stage of the match"
            );

        }
        else if (minute >= 45) {

            confidence += 8;

            reasons.push(
                "Second half"
            );

        }
        else {

            reasons.push(
                "Early match"
            );

        }

        // --------------------------
        // Momentum
        // --------------------------

        if (score.scoreDifference >= 2) {

            confidence += 10;

            reasons.push(
                "Strong momentum"
            );

        }

        // --------------------------
        // Red Cards
        // --------------------------

        if (score.homeRedCards > score.awayRedCards) {

            confidence -= 15;

            reasons.push(
                "Home team has more red cards"
            );

        }

        if (score.awayRedCards > score.homeRedCards) {

            confidence += 15;

            reasons.push(
                "Away team has more red cards"
            );

        }

        // --------------------------
        // Possession
        // --------------------------

        if (score.homePossession >= 60) {

            confidence += 5;

            reasons.push(
                "Home team dominating possession"
            );

        }

        if (score.awayPossession >= 60) {

            confidence += 5;

            reasons.push(
                "Away team dominating possession"
            );

        }

        // --------------------------
        // Shots on Target
        // --------------------------

        const shotsDiff =
            (score.homeShotsOnTarget ?? 0) -
            (score.awayShotsOnTarget ?? 0);

        if (shotsDiff >= 3) {

            confidence += 7;

            reasons.push(
                "Many more shots on target"
            );

        }

        if (shotsDiff <= -3) {

            confidence += 7;

            reasons.push(
                "Opponent under heavy pressure"
            );

        }

        // --------------------------
        // Strategy Bonus
        // --------------------------

        if (decision.action === "BUY") {

            confidence += 5;

            reasons.push(
                "Positive expected value"
            );

        }

        if (decision.action === "SELL") {

            confidence -= 5;

            reasons.push(
                "Negative expected value"
            );

        }

        // --------------------------
        // Clamp
        // --------------------------

        confidence =
            Math.max(
                0,
                Math.min(
                    100,
                    Math.round(confidence)
                )
            );

        logger.debug(
            `Confidence = ${confidence}%`
        );

        return {

            value: confidence,

            rating:
                this.rating(confidence),

            reasons,

            recommendation:
                this.recommendation(
                    confidence
                )

        };

    }

    rating(confidence) {

        if (confidence >= 90)
            return "VERY_HIGH";

        if (confidence >= 75)
            return "HIGH";

        if (confidence >= 60)
            return "MEDIUM";

        if (confidence >= 40)
            return "LOW";

        return "VERY_LOW";

    }

    recommendation(confidence) {

        if (confidence >= 80)
            return "STRONG_BUY";

        if (confidence >= 65)
            return "BUY";

        if (confidence >= 45)
            return "HOLD";

        if (confidence >= 30)
            return "SELL";

        return "STRONG_SELL";

    }

}

export default new ConfidenceEngine();