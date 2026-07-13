// src/txline/reconnect-manager.mjs

import logger from "../logger/logger.mjs";

class ReconnectManager {

    constructor(options = {}) {

        this.initialDelay =
            options.initialDelay ?? 2000;

        this.maxDelay =
            options.maxDelay ?? 30000;

        this.multiplier =
            options.multiplier ?? 2;

        this.currentDelay =
            this.initialDelay;

        this.retryCount = 0;

        this.lastReconnect = null;

        this.timer = null;

        this.running = false;

    }

    /**
     * Schedule the next reconnect attempt.
     */
    async schedule(callback) {

        if (this.running) {

            logger.debug(
                "Reconnect already scheduled."
            );

            return;

        }

        this.running = true;

        logger.warn(
            `Reconnect attempt #${this.retryCount + 1} in ${this.currentDelay} ms`
        );

        return new Promise((resolve, reject) => {

            this.timer = setTimeout(async () => {

                this.running = false;

                this.retryCount++;

                this.lastReconnect = Date.now();

                try {

                    await callback();

                    resolve();

                }

                catch (error) {

                    logger.error(
                        "Reconnect failed",
                        error.message
                    );

                    // Exponential backoff + jitter
                    const jitter =
                        Math.floor(Math.random() * 1000);

                    this.currentDelay = Math.min(
                        (this.currentDelay * this.multiplier) + jitter,
                        this.maxDelay
                    );

                    reject(error);

                }

            }, this.currentDelay);

        });

    }

    /**
     * Cancel any pending reconnect.
     */
    cancel() {

        if (this.timer) {

            clearTimeout(this.timer);

            this.timer = null;

        }

        this.running = false;

        logger.info(
            "Reconnect cancelled."
        );

    }

    /**
     * Reset after a successful connection.
     */
    reset() {

        this.cancel();

        this.currentDelay =
            this.initialDelay;

        this.retryCount = 0;

        this.lastReconnect = null;

        logger.info(
            "Reconnect manager reset."
        );

    }

    /**
     * Returns whether a reconnect
     * is currently scheduled.
     */
    isScheduled() {

        return this.running;

    }

    /**
     * Returns current reconnect status.
     */
    status() {

        return {

            scheduled:
                this.running,

            retryCount:
                this.retryCount,

            currentDelay:
                this.currentDelay,

            initialDelay:
                this.initialDelay,

            maxDelay:
                this.maxDelay,

            lastReconnect:
                this.lastReconnect

        };

    }

}

export default new ReconnectManager();