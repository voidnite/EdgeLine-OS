import scoreDecoder from "./score.mjs";
import cardDecoder from "./cards.mjs";

class Registry {

    constructor() {

        this.decoders = [

            scoreDecoder,

            cardDecoder

        ];

    }

    decode(stat) {

        for (const decoder of this.decoders) {

            if (decoder.supports(stat)) {

                return decoder.decode(stat);

            }

        }

        return {

            type: "unknown",

            key: stat.key,

            value: stat.value,

            period: stat.period

        };

    }

}

export default new Registry();