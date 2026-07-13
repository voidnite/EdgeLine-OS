// src/txline/metrics.mjs

const HISTORY_SIZE = 60;

class Metrics {

    constructor() {
        this.reset();
    }

    reset() {

        // -------------------------
        // Connection
        // -------------------------

        this.connected = false;

        this.connectionStarted = null;

        this.connectionCount = 0;

        this.reconnectCount = 0;

        // -------------------------
        // Events
        // -------------------------

        this.messages = 0;

        this.heartbeats = 0;

        this.errors = 0;

        // -------------------------
        // Event IDs
        // -------------------------

        this.lastEventId = null;

        this.lastHeartbeat = null;

        // -------------------------
        // Latency
        // -------------------------

        this.totalLatency = 0;

        this.averageLatency = 0;

        this.minLatency = null;

        this.maxLatency = null;

        // -------------------------
        // Throughput
        // -------------------------

        this.eventsThisSecond = 0;

        this.eventsPerSecond = 0;

        this.lastSecond = Math.floor(Date.now() / 1000);

        // -------------------------
        // Dashboard History
        // -------------------------

        this.latencyHistory = [];

        this.epsHistory = [];

        this.heartbeatHistory = [];

        this.reconnectHistory = [];

        // -------------------------
        // Health
        // -------------------------

        this.healthScore = 100;

    }

    // ===================================
    // CONNECTION
    // ===================================

    connectedNow() {

        this.connected = true;

        this.connectionStarted = Date.now();

        this.connectionCount++;

    }

    disconnectedNow() {

        this.connected = false;

    }

    reconnect() {

        this.reconnectCount++;

        this.pushHistory(

            this.reconnectHistory,

            {

                timestamp: Date.now(),

                reconnects: this.reconnectCount

            }

        );

        this.calculateHealth();

    }

    // ===================================
    // EVENTS
    // ===================================

    message(eventId = null) {

        this.messages++;

        if (eventId) {

            this.lastEventId = eventId;

        }

        this.calculateEPS();

    }

    heartbeat(latency = 0) {

        this.heartbeats++;

        this.lastHeartbeat = Date.now();

        if (latency > 0) {

            this.totalLatency += latency;

            this.averageLatency = Math.round(

                this.totalLatency /

                this.heartbeats

            );

            if (

                this.minLatency === null ||

                latency < this.minLatency

            ) {

                this.minLatency = latency;

            }

            if (

                this.maxLatency === null ||

                latency > this.maxLatency

            ) {

                this.maxLatency = latency;

            }

            this.pushHistory(

                this.latencyHistory,

                {

                    timestamp: Date.now(),

                    latency

                }

            );

        }

        this.pushHistory(

            this.heartbeatHistory,

            {

                timestamp: Date.now()

            }

        );

        this.calculateHealth();

    }

    error() {

        this.errors++;

        this.calculateHealth();

    }

    // ===================================
    // EVENTS PER SECOND
    // ===================================

    calculateEPS() {

        const second =

            Math.floor(Date.now() / 1000);

        if (second !== this.lastSecond) {

            this.eventsPerSecond =

                this.eventsThisSecond;

            this.pushHistory(

                this.epsHistory,

                {

                    timestamp: Date.now(),

                    eps: this.eventsPerSecond

                }

            );

            this.eventsThisSecond = 0;

            this.lastSecond = second;

        }

        this.eventsThisSecond++;

    }

    // ===================================
    // HISTORY
    // ===================================

    pushHistory(array, value) {

        array.push(value);

        if (array.length > HISTORY_SIZE) {

            array.shift();

        }

    }

    // ===================================
    // HEALTH
    // ===================================

    calculateHealth() {

        let score = 100;

        score -= this.errors * 10;

        score -= this.reconnectCount * 3;

        if (this.averageLatency > 100) {

            score -= 5;

        }

        if (this.averageLatency > 300) {

            score -= 10;

        }

        if (!this.connected) {

            score -= 20;

        }

        this.healthScore = Math.max(score, 0);

    }

    // ===================================
    // HELPERS
    // ===================================

    uptime() {

        if (!this.connectionStarted) {

            return 0;

        }

        return Date.now() -

            this.connectionStarted;

    }

    formatDuration(ms) {

        const seconds =

            Math.floor(ms / 1000);

        const h =

            Math.floor(seconds / 3600);

        const m =

            Math.floor(

                (seconds % 3600) / 60

            );

        const s =

            seconds % 60;

        return `${h}h ${m}m ${s}s`;

    }

    // ===================================
    // DASHBOARD
    // ===================================

    status() {

        return {

            connected:

                this.connected,

            healthScore:

                this.healthScore,

            connectionCount:

                this.connectionCount,

            reconnectCount:

                this.reconnectCount,

            uptime:

                this.uptime(),

            uptimeFormatted:

                this.formatDuration(

                    this.uptime()

                ),

            messages:

                this.messages,

            heartbeats:

                this.heartbeats,

            errors:

                this.errors,

            averageLatency:

                this.averageLatency,

            minLatency:

                this.minLatency,

            maxLatency:

                this.maxLatency,

            eventsPerSecond:

                this.eventsPerSecond,

            lastHeartbeat:

                this.lastHeartbeat,

            lastEventId:

                this.lastEventId,

            latencyHistory:

                this.latencyHistory,

            epsHistory:

                this.epsHistory,

            heartbeatHistory:

                this.heartbeatHistory,

            reconnectHistory:

                this.reconnectHistory

        };

    }

}

export default new Metrics();