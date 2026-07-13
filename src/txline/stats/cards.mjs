// src/txline/stats/cards.mjs

import GenericStat from "./generic.mjs";

class CardStat extends GenericStat {

    constructor() {

        super("cards");

    }

    supports() {

        return [

            20,

            21

        ];

    }

}

export default new CardStat();