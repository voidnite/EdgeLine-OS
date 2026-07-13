import PERIODS from "./stat-periods.mjs";

class StatUtils {

    getBaseKey(key) {

        return key % 1000;

    }

    getPeriodOffset(key) {

        return key - (key % 1000);

    }

    getPeriodName(key) {

        const offset = this.getPeriodOffset(key);

        switch (offset) {

            case PERIODS.FULL_GAME:
                return "FULL_GAME";

            case PERIODS.FIRST_HALF:
                return "FIRST_HALF";

            case PERIODS.SECOND_HALF:
                return "SECOND_HALF";

            case PERIODS.EXTRA_TIME_FIRST:
                return "EXTRA_TIME_FIRST";

            case PERIODS.EXTRA_TIME_SECOND:
                return "EXTRA_TIME_SECOND";

            case PERIODS.PENALTIES:
                return "PENALTIES";

            default:
                return "UNKNOWN";

        }

    }

}

export default new StatUtils();