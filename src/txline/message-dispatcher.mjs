import logger from "../logger/logger.mjs";

import lifecycle from "./connection-lifecycle.mjs";

import streamProcessor from "./stream-processor.mjs";

import classifier from "./classifier.mjs";
import EVENT_TYPES from "./event-types.mjs";

class MessageDispatcher {

    dispatch(event) {

        try {

            lifecycle.message(event.lastEventId);

            const type = classifier.classify(event);

            switch (type) {

                case EVENT_TYPES.HEARTBEAT:

                    lifecycle.heartbeat();

                    break;

                case EVENT_TYPES.SCORE:

                    streamProcessor.process(event);

                    break;

                default:

                    logger.debug("Unknown SSE event");

            }

        }

        catch (error) {

            lifecycle.error(error);

        }

    }

}

export default new MessageDispatcher();