// src/txline/stats/shots.mjs

import GenericStat from "./generic.mjs";

class ShotStat extends GenericStat {

    constructor() {

        super("shots");

    }

    supports() {

        return [

            60,

            61

        ];

    }

}

export default new ShotStat();