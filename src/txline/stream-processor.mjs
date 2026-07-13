// src/txline/stream-processor.mjs

import parser from "./payload-parser.mjs";
import mapper from "./mapper.mjs";

import logger from "../logger/logger.mjs";

import metrics from "./metrics.mjs";

import eventBus from "../core/event-bus.mjs";

import EVENTS from "../core/events.mjs";

import domainEvent from "../core/domain-event.mjs";

class StreamProcessor {

    process(rawEvent) {

        try {

            metrics.message(rawEvent.lastEventId);

            const parsed =
                parser.parse(rawEvent.data);

            if (!parsed.valid) {

                logger.warn(

                    "Invalid TxLINE payload"

                );

                return;

            }

            const mapped =
                mapper.map(parsed);

            eventBus.emit(

                EVENTS.TXLINE_SCORE,

                domainEvent.create({

                    source: "txline",

                    type: EVENTS.TXLINE_SCORE,

                    correlationId:

                        `fixture-${mapped.fixtureId}`,

                    payload: mapped

                })

            );
        }

        catch (error) {

            metrics.error();

            logger.error(

                error.message

            );

            eventBus.emit(

                EVENTS.TXLINE_ERROR,

                error

            );

        }

    }

}

export default new StreamProcessor();