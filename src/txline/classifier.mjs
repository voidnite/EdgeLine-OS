// src/txline/classifier.mjs

import EVENT_TYPES from "./event-types.mjs";

class Classifier {

    classify(event) {

        if (
            event.type === "heartbeat" ||
            event.event === "heartbeat"
        ) {

            return EVENT_TYPES.HEARTBEAT;

        }

        if (event.data) {

            return EVENT_TYPES.SCORE;

        }

        return EVENT_TYPES.UNKNOWN;

    }

}

export default new Classifier();