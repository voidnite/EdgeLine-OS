import STAT_KEYS from "../protocol/stat-keys.mjs";
import statUtils from "../protocol/stat-utils.mjs";

class ScoreStat {

    supports(stat) {

        const baseKey = statUtils.getBaseKey(stat.key);

        return [

            STAT_KEYS.PARTICIPANT1_GOALS,

            STAT_KEYS.PARTICIPANT2_GOALS,

        ].includes(baseKey);

    }

    decode(stat) {

        const baseKey = statUtils.getBaseKey(stat.key);

        return {

            type: "score",

            side:
                baseKey === STAT_KEYS.PARTICIPANT1_GOALS
                    ? "HOME"
                    : "AWAY",

            score: stat.value,

            period: statUtils.getPeriodName(stat.key),

            rawKey: stat.key,

        };

    }

}

export default new ScoreStat();