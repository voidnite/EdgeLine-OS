// src/txline/sse-client.mjs

import config from "../config/config.mjs";

import logger from "../logger/logger.mjs";

import jwtManager from "./jwt-manager.mjs";

import reconnectManager from "./reconnect-manager.mjs";

import lifecycle from "./connection-lifecycle.mjs";

import dispatcher from "./message-dispatcher.mjs";

import { readSseMessages } from "./sse/reader.mjs";

class SSEClient {

    constructor() {

        this.abortController = null;

        this.running = false;

        this.lastEventId = null;

        this.response = null;

    }

    /**
     * Starts the streaming client.
     */
    async start() {

        if (this.running) {

            logger.warn("SSE client already running.");

            return;

        }

        this.running = true;

        await this.connect();

    }

    /**
     * Opens a live connection to TxLINE.
     */
    async connect() {

        lifecycle.connecting();

        try {

            // Docs: Authorization: Bearer ${guestJWT} + X-Api-Token: ${apiToken}
            const guestToken = await jwtManager.getToken();
            const apiToken   = config.txline.apiToken;

            if (!apiToken) {
                throw new Error(
                    "TXLINE_API_TOKEN is not set in .env — run the activation script first."
                );
            }

            const headers = {
                "Authorization":  `Bearer ${guestToken}`,
                "X-Api-Token":    apiToken,
                "Accept":         "text/event-stream",
                "Cache-Control":  "no-cache",
            };

            // Resume stream if supported
            if (this.lastEventId) {

                headers["Last-Event-ID"] =
                    this.lastEventId;

            }

            const url =
                `${config.txline.apiBase}${config.txline.endpoints.scoresStream}`;

            logger.info(
                `Connecting to ${url}`
            );

            this.abortController =
                new AbortController();

            this.response =
                await fetch(url, {

                    method: "GET",

                    headers,

                    signal:
                        this.abortController.signal

                });

            if (!this.response.ok) {

                throw new Error(

                    `TxLINE returned ${this.response.status}`

                );

            }

            lifecycle.connected();

            reconnectManager.reset();

            await this.readLoop();

        }

        catch (error) {

            if (!this.running)
                return;

            lifecycle.error(error);

            lifecycle.disconnected(error);

            await this.scheduleReconnect();

        }

    }

    /**
     * Reads the incoming SSE stream.
     */
    async readLoop() {

        try {

            for await (

                const message of readSseMessages(

                    this.response

                )

            ) {

                if (!this.running)
                    break;

                // Store Last-Event-ID
                if (message.id) {

                    this.lastEventId =

                        message.id;

                }

                dispatcher.dispatch({

                    event:

                        message.event,

                    lastEventId:

                        message.id,

                    data:

                        message.data

                });

            }

            if (this.running) {

                throw new Error(

                    "TxLINE stream closed."

                );

            }

        }

        catch (error) {

            if (!this.running)
                return;

            lifecycle.error(error);

            lifecycle.disconnected(error);

            await this.scheduleReconnect();

        }

    }
    /**
 * Schedule a reconnect using the reconnect manager.
 */
    async scheduleReconnect() {

        if (!this.running) {
            return;
        }

        lifecycle.reconnecting();

        await reconnectManager.schedule(async () => {

            try {

                await this.connect();

            } catch (error) {

                lifecycle.error(error);

                await this.scheduleReconnect();

            }

        });

    }

    /**
     * Gracefully stop the streaming client.
     */
    stop() {

        logger.info("Stopping TxLINE SSE client...");

        this.running = false;

        reconnectManager.cancel();

        if (this.abortController) {

            this.abortController.abort();

            this.abortController = null;

        }

        lifecycle.shutdown();

    }

    /**
     * Restart the stream.
     */
    async restart() {

        logger.info("Restarting TxLINE SSE client...");

        this.stop();

        this.running = true;

        await this.connect();

    }

    /**
     * Returns whether the client is currently running.
     */
    isRunning() {

        return this.running;

    }

    /**
     * Returns connection status for the dashboard/API.
     */
    status() {

        return {

            running: this.running,

            lastEventId: this.lastEventId,

            streamUrl:
                `${config.txline.apiBase}${config.txline.endpoints.scoresStream}`,

            lifecycle:
                lifecycle.status(),

            reconnect:
                reconnectManager.status(),

            jwt:
                jwtManager.getStatus()

        };

    }

}

const sseClient = new SSEClient();

export default sseClient;