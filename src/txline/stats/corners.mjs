// src/txline/stats/corners.mjs

import GenericStat from "./generic.mjs";

class CornerStat extends GenericStat {

    constructor() {

        super("corners");

    }

    supports() {

        return [

            50,

            51

        ];

    }

}

export default new CornerStat();