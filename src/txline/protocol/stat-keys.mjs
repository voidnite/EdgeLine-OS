// src/txline/protocol/stat-keys.mjs

/**
 * Official TxLINE Soccer Statistic Keys
 *
 * Documentation:
 * https://txline.txodds.com/documentation/scores/soccer-feed
 */

const BASE_STAT_KEYS = Object.freeze({

    // Goals
    PARTICIPANT1_GOALS: 1,
    PARTICIPANT2_GOALS: 2,

    // Yellow Cards
    PARTICIPANT1_YELLOW_CARDS: 3,
    PARTICIPANT2_YELLOW_CARDS: 4,

    // Red Cards
    PARTICIPANT1_RED_CARDS: 5,
    PARTICIPANT2_RED_CARDS: 6,

    // Corners
    PARTICIPANT1_CORNERS: 7,
    PARTICIPANT2_CORNERS: 8,

});

export default BASE_STAT_KEYS;