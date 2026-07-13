// src/txline/sse/message.mjs

export default class SseMessage {

    constructor({

        id = null,

        event = null,

        data = "",

        retry = null

    } = {}) {

        this.id = id;

        this.event = event;

        this.data = data;

        this.retry = retry;

    }

    json() {

        try {

            return JSON.parse(this.data);

        }

        catch {

            return this.data;

        }

    }

}