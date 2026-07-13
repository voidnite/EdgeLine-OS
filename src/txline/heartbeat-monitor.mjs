// src/txline/heartbeat-monitor.mjs

import logger from "../logger/logger.mjs";

class HeartbeatMonitor {
    constructor(timeout = 60000, checkInterval = 5000) {
        this.timeout = timeout;
        this.checkInterval = checkInterval;

        this.timer = null;

        this.lastHeartbeat = null;

        this.heartbeatCount = 0;

        this.latency = 0;

        this.triggered = false;

        this.onTimeout = null;
    }

    /**
     * Start monitoring heartbeats.
     */
    start(callback) {
        this.stop();

        this.onTimeout = callback;

        this.triggered = false;

        this.lastHeartbeat = Date.now();

        logger.info("Heartbeat monitor started");

        this.timer = setInterval(() => {
            this.check();
        }, this.checkInterval);
    }

    /**
     * Record a heartbeat.
     * Optionally provide the server timestamp to estimate latency.
     */
    beat(serverTimestamp = null) {
        this.lastHeartbeat = Date.now();

        this.heartbeatCount++;

        this.triggered = false;

        if (serverTimestamp) {
            this.latency = Date.now() - serverTimestamp;
        }

        logger.debug(
            `Heartbeat #${this.heartbeatCount} received`
        );
    }

    /**
     * Internal timeout check.
     */
    check() {
        if (!this.lastHeartbeat) {
            return;
        }

        const elapsed =
            Date.now() - this.lastHeartbeat;

        if (elapsed <= this.timeout) {
            return;
        }

        if (this.triggered) {
            return;
        }

        this.triggered = true;

        logger.warn(
            `Heartbeat timeout (${elapsed} ms)`
        );

        if (this.onTimeout) {
            this.onTimeout();
        }
    }

    /**
     * Returns true if the connection
     * is considered healthy.
     */
    healthy() {
        if (!this.lastHeartbeat) {
            return false;
        }

        return (
            Date.now() - this.lastHeartbeat <
            this.timeout
        );
    }

    /**
     * Stop monitoring.
     */
    stop() {
        if (this.timer) {
            clearInterval(this.timer);

            this.timer = null;
        }
    }

    /**
     * Reset all metrics.
     */
    reset() {
        this.stop();

        this.lastHeartbeat = null;

        this.heartbeatCount = 0;

        this.latency = 0;

        this.triggered = false;

        this.onTimeout = null;
    }

    /**
     * Dashboard metrics.
     */
    status() {
        return {
            healthy: this.healthy(),

            timeout: this.timeout,

            heartbeatCount: this.heartbeatCount,

            latency: this.latency,

            lastHeartbeat: this.lastHeartbeat,

            heartbeatAge:
                this.lastHeartbeat
                    ? Date.now() - this.lastHeartbeat
                    : null
        };
    }
}

export default new HeartbeatMonitor();