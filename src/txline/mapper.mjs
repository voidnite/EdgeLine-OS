import registry from "./stats/registry.mjs";

class TxLineMapper {

    map(event) {

        if (!event.valid)
            return event;

        const p = event.payload;

        const decodedStats = (p.stats || []).map(stat =>
            registry.decode(stat)
        );

        const homeScore =
            this.getScore(decodedStats, "HOME");

        const awayScore =
            this.getScore(decodedStats, "AWAY");

        const scoreDifference =
            homeScore - awayScore;

        let leader = "DRAW";

        if (homeScore > awayScore)
            leader = "HOME";

        if (awayScore > homeScore)
            leader = "AWAY";

        return {

            fixtureId: p.fixtureId,

            sequence: p.seq,

            timestamp: p.ts,

            period: p.period,

            stats: decodedStats,

            homeScore,

            awayScore,

            scoreDifference,

            leader,

            isDraw: homeScore === awayScore,

            isHomeLeading: homeScore > awayScore,

            isAwayLeading: awayScore > homeScore,

            isFinished: p.finished ?? false,

            receivedAt: event.receivedAt,

            raw: p

        };

    }

    getScore(stats, side) {

        const score = stats.find(stat =>
            stat.side === side
        );

        return score?.score ?? 0;

    }

}

export default new TxLineMapper();