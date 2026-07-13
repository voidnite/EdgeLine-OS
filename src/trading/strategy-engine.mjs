// src/trading/strategy-engine.mjs

import EventEmitter from "node:events";

import logger from "../logger/logger.mjs";

import signalGenerator from "./signal-generator.mjs";

import confidenceEngine from "./confidence-engine.mjs";

import riskEngine from "./risk-engine.mjs";

import eventBus from "../core/event-bus.mjs";
import EVENTS from "../core/events.mjs";
import domainEvent from "../core/domain-event.mjs";



class StrategyEngine extends EventEmitter {

    constructor() {

        super();

        this.strategies = [];

        this.registerDefaults();

    }

    register(strategy) {

        this.strategies.push(strategy);

    }

    registerDefaults() {

        this.register({

            id: "momentum",

            name: "Momentum Strategy",

            evaluate(score) {

                if (score.homeScore > score.awayScore) {

                    return {

                        action: "BUY",

                        side: "HOME"

                    };

                }

                if (score.awayScore > score.homeScore) {

                    return {

                        action: "BUY",

                        side: "AWAY"

                    };

                }

                return {

                    action: "HOLD"

                };

            }

        });

    }

    evaluate(score) {

        for (const strategy of this.strategies) {

            const decision =
                strategy.evaluate(score);

            if (!decision)
                continue;

            const confidence =
                confidenceEngine.calculate(

                    score,

                    decision

                );

            const risk =
                riskEngine.calculate(

                    score,

                    confidence

                );


            const signal =
                signalGenerator.generate({

                    strategy: strategy.name,

                    score,

                    decision,

                    confidence,

                    risk

                });

            logger.info(
                `${strategy.name} -> ${signal.action}`
            );

            // Local subscribers
            this.emit("signal", signal);

            // Global event bus
            eventBus.emit(

                EVENTS.STRATEGY_SIGNAL,

                domainEvent.create({

                    source: "strategy-engine",

                    type: EVENTS.STRATEGY_SIGNAL,

                    correlationId: `fixture-${signal.fixtureId}`,

                    payload: signal

                })

            );
        }

    }

}

export default new StrategyEngine();