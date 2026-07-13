// src/txline/stats/generic.mjs

export default class GenericStat {

    constructor(name) {
        this.name = name;
    }

    supports() {
        return [];
    }

    decode(stat) {

        return {

            name: this.name,

            key: stat.key,

            value: stat.value,

            period: stat.period

        };

    }

}