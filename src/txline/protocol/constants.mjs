// src/txline/protocol/constants.mjs

const CONSTANTS = Object.freeze({

    HEARTBEAT_TIMEOUT: 60000,

    INITIAL_RECONNECT_DELAY: 2000,

    MAX_RECONNECT_DELAY: 30000,

    MAX_BACKOFF_MULTIPLIER: 2

});

export default CONSTANTS;