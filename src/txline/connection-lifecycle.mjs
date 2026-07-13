// src/txline/connection-lifecycle.mjs

import connectionState from "./connection-state.mjs";
import heartbeatMonitor from "./heartbeat-monitor.mjs";
import metrics from "./metrics.mjs";

import eventBus from "../core/event-bus.mjs";
import EVENTS from "../core/events.mjs";

import logger from "../logger/logger.mjs";

class ConnectionLifecycle {

    connecting() {

        logger.info("Connecting to TxLINE...");

        connectionState.connectingNow();

    }

    connected() {

        logger.info("Connected to TxLINE");

        connectionState.connectedNow();

        metrics.connectedNow();

        heartbeatMonitor.start(() => {

            this.timeout();

        });

        eventBus.emit(

            EVENTS.TXLINE_CONNECTED

        );

    }

    heartbeat(latency = 0) {

        heartbeatMonitor.beat();

        metrics.heartbeat(latency);

        eventBus.emit(

            EVENTS.TXLINE_HEARTBEAT,

            {

                latency,

                timestamp: Date.now()

            }

        );

    }

    message(eventId = null) {

        metrics.message(eventId);

    }

    reconnecting() {

        logger.warn(

            "Attempting reconnect..."

        );

        connectionState.reconnectingNow();

        metrics.reconnect();

        eventBus.emit(

            EVENTS.TXLINE_RECONNECTED

        );

    }

    disconnected(error = null) {

        logger.warn(

            "Disconnected from TxLINE"

        );

        heartbeatMonitor.stop();

        connectionState.disconnected(error);

        metrics.disconnectedNow();

        eventBus.emit(

            EVENTS.TXLINE_DISCONNECTED,

            error

        );

    }

    error(error) {

        logger.error(

            error.message ?? error

        );

        metrics.error();

        eventBus.emit(

            EVENTS.TXLINE_ERROR,

            error

        );

    }

    timeout() {

        logger.warn(

            "Heartbeat timeout"

        );

        this.disconnected(

            new Error("Heartbeat timeout")

        );

    }

    shutdown() {

        logger.info(

            "Connection shutdown"

        );

        heartbeatMonitor.stop();

        connectionState.reset();

        metrics.disconnectedNow();

    }

    status() {

        return {

            connection:

                connectionState.status(),

            metrics:

                metrics.status(),

            heartbeat:

                heartbeatMonitor.status()

        };

    }

}

export default new ConnectionLifecycle();