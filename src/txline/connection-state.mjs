class ConnectionState {

    constructor() {

        this.reset();

    }

    reset() {

        this.connected = false;

        this.connecting = false;

        this.reconnecting = false;

        this.lastConnectedAt = null;

        this.lastDisconnectedAt = null;

        this.lastError = null;

    }

    connectingNow() {

        this.connecting = true;

    }

    connectedNow() {

        this.connected = true;

        this.connecting = false;

        this.reconnecting = false;

        this.lastConnectedAt = Date.now();

    }

    disconnected(error = null) {

        this.connected = false;

        this.connecting = false;

        this.lastDisconnectedAt = Date.now();

        this.lastError = error;

    }

    reconnectingNow() {

        this.reconnecting = true;

    }

    status() {

        return {

            connected: this.connected,

            connecting: this.connecting,

            reconnecting: this.reconnecting,

            lastConnectedAt: this.lastConnectedAt,

            lastDisconnectedAt: this.lastDisconnectedAt,

            lastError: this.lastError

        };

    }

}

export default new ConnectionState();