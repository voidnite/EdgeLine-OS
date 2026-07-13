// src/txline/stats/possession.mjs

import GenericStat from "./generic.mjs";

class PossessionStat extends GenericStat {

    constructor() {

        super("possession");

    }

    supports() {

        return [

            40,

            41

        ];

    }

}

export default new PossessionStat();