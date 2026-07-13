// src/txline/txline-client.mjs

import { EventEmitter } from "node:events";

import sseClient from "./sse-client.mjs";

import eventBus from "../core/event-bus.mjs";
import EVENTS from "../core/events.mjs";

import logger from "../logger/logger.mjs";

class TxLineClient extends EventEmitter {

  constructor() {

    super();

    this.running = false;

    this.subscriptions = [];

  }

  /**
   * Starts the live TxLINE client.
   */
  async start() {

    if (this.running) {

      logger.warn("TxLINE client already running.");

      return;

    }

    logger.info("Starting TxLINE client...");

    this.registerEvents();

    await sseClient.start();

    this.running = true;

  }

  /**
   * Stops the client.
   */
  stop() {

    logger.info("Stopping TxLINE client...");

    sseClient.stop();

    this.unregisterEvents();

    this.running = false;

  }

  /**
   * Restart.
   */
  async restart() {

    this.stop();

    await this.start();

  }

  /**
   * Register internal event listeners.
   */
  registerEvents() {

    const handlers = [

      [
        EVENTS.TXLINE_CONNECTED,

        () => {

          this.emit("connected");

        }

      ],

      [
        EVENTS.TXLINE_DISCONNECTED,

        (error) => {

          this.emit(

            "disconnected",

            error

          );

        }

      ],

      [
        EVENTS.TXLINE_RECONNECTED,

        () => {

          this.emit("reconnected");

        }

      ],

      [
        EVENTS.TXLINE_HEARTBEAT,

        (heartbeat) => {

          this.emit(

            "heartbeat",

            heartbeat

          );

        }

      ],

      [
        EVENTS.TXLINE_SCORE,

        (score) => {

          this.emit(

            "score",

            score

          );

        }

      ],

      [
        EVENTS.TXLINE_ERROR,

        (error) => {

          this.emit(

            "error",

            error

          );

        }

      ]

    ];

    for (const [event, handler] of handlers) {

      eventBus.on(event, handler);

      this.subscriptions.push({

        event,

        handler

      });

    }

  }

  /**
   * Remove listeners.
   */
  unregisterEvents() {

    for (const subscription of this.subscriptions) {

      eventBus.off(

        subscription.event,

        subscription.handler

      );

    }

    this.subscriptions = [];

  }

  /**
   * Client status.
   */
  status() {

    return {

      running: this.running,

      stream:

        sseClient.status()

    };

  }

}

const client = new TxLineClient();

export default client;

export function createTxlineClient() {
  return new TxLineClient();
}