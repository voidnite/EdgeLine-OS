// src/txline/protocol/stat-periods.mjs

/**
 * TxLINE Period Multipliers
 *
 * Formula:
 * (period * 1000) + baseKey
 */

const STAT_PERIODS = Object.freeze({

    FULL_GAME: 0,

    FIRST_HALF: 1000,

    SECOND_HALF: 2000,

    EXTRA_TIME_FIRST: 3000,

    EXTRA_TIME_SECOND: 4000,

    PENALTIES: 5000,

});

export default STAT_PERIODS;