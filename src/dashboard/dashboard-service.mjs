// src/dashboard/dashboard-service.mjs

import metrics from "../txline/metrics.mjs";
import portfolio from "../portfolio/portfolio-engine.mjs";
import decisionLogger from "../trading/decision-logger.mjs";
import lifecycle from "../txline/connection-lifecycle.mjs";

class DashboardService {

    /**
     * Returns everything needed by the UI.
     */
    snapshot() {

        return {

            generatedAt:

                Date.now(),

            connection:

                lifecycle.status(),

            metrics:

                metrics.status(),

            portfolio:

                portfolio.status(),

            decisions:

                decisionLogger.status(),

            system:

                this.systemHealth()

        };

    }

    /**
 * UI-ready dashboard data.
 */
    live() {

        const snapshot = this.snapshot();

        const portfolio = snapshot.portfolio.summary;

        const latestDecision =
            snapshot.decisions.latest?.[0] ?? null;

        return {

            generatedAt:
                snapshot.generatedAt,

            connection: {

                connected:
                    snapshot.connection.connection.connected,

                reconnecting:
                    snapshot.connection.connection.reconnecting,

                heartbeatHealthy:
                    snapshot.connection.heartbeat.healthy,

                latency:
                    snapshot.connection.heartbeat.latency,

                heartbeatAge:
                    snapshot.connection.heartbeat.heartbeatAge

            },

            metrics: {

                messages:
                    snapshot.metrics.messages,

                reconnects:
                    snapshot.metrics.reconnects,

                eventsPerSecond:
                    snapshot.metrics.eventsPerSecond,

                averageLatency:
                    snapshot.metrics.averageLatency

            },

            portfolio: {

                balance:
                    portfolio.cash,

                equity:
                    portfolio.equity,

                roi:
                    portfolio.roi,

                exposure:
                    portfolio.exposure,

                realizedPnL:
                    portfolio.realizedPnL,

                unrealizedPnL:
                    portfolio.unrealizedPnL,

                trades:
                    portfolio.trades,

                winRate:
                    portfolio.winRate

            },

            latestSignal:

                latestDecision
                    ? {

                        strategy:
                            latestDecision.strategy,

                        action:
                            latestDecision.action,

                        confidence:
                            latestDecision.confidence,

                        risk:
                            latestDecision.riskLevel,

                        fixture:

                            `${latestDecision.homeTeam} vs ${latestDecision.awayTeam}`,

                        minute:
                            latestDecision.score.minute,

                        score:

                            `${latestDecision.score.home}-${latestDecision.score.away}`,

                        reasons:

                            latestDecision.confidenceReasons

                    }
                    : null,

            health:

                snapshot.system

        };

    }

    /**
     * Simple health score.
     */
    systemHealth() {

        const metricsStatus =
            metrics.status();

        const lifecycleStatus =
            lifecycle.status();

        let score = 100;

        //--------------------------------
        // Connection
        //--------------------------------

        if (

            !lifecycleStatus.connection.connected

        ) {

            score -= 40;

        }

        //--------------------------------
        // Errors
        //--------------------------------

        score -=

            Math.min(

                metricsStatus.errors * 2,

                20

            );

        //--------------------------------
        // Reconnects
        //--------------------------------

        score -=

            Math.min(

                metricsStatus.reconnects * 3,

                15

            );

        //--------------------------------
        // Heartbeat
        //--------------------------------

        if (

            !lifecycleStatus.heartbeat.healthy

        ) {

            score -= 25;

        }

        score =

            Math.max(

                0,

                Math.round(score)

            );

        return {

            score,

            status:

                this.healthLabel(score)

        };

    }

    /**
     * Human-readable health.
     */
    healthLabel(score) {

        if (score >= 90)

            return "EXCELLENT";

        if (score >= 75)

            return "GOOD";

        if (score >= 50)

            return "WARNING";

        return "CRITICAL";

    }

}

export default new DashboardService();