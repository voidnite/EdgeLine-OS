export default Object.freeze({

    // -------------------
    // TxLINE
    // -------------------

    TXLINE_CONNECTED: "txline.connected",
    TXLINE_DISCONNECTED: "txline.disconnected",
    TXLINE_HEARTBEAT: "txline.heartbeat",
    TXLINE_SCORE: "txline.score",
    TXLINE_ERROR: "txline.error",
    TXLINE_RECONNECTED: "txline.reconnected",

    // -------------------
    // Portfolio
    // -------------------

    PORTFOLIO_POSITION_OPENED: "portfolio.position.opened",
    PORTFOLIO_POSITION_UPDATED: "portfolio.position.updated",
    PORTFOLIO_POSITION_CLOSED: "portfolio.position.closed",
    PORTFOLIO_POSITION_SETTLED: "portfolio.position.settled",

    // -------------------
    // Strategy
    // -------------------

    STRATEGY_SIGNAL: "strategy.signal",

    // -------------------
    // Risk
    // -------------------

    RISK_APPROVED: "risk.approved",
    RISK_REJECTED: "risk.rejected",

    // -------------------
    // Settlement
    // -------------------

    SETTLEMENT_STARTED: "settlement.started",
    SETTLEMENT_COMPLETED: "settlement.completed",
    SETTLEMENT_FAILED: "settlement.failed",

    // -------------------
    // Validation / Proof
    // -------------------

    VALIDATION_REQUESTED: "validation.requested",
    VALIDATION_VERIFIED: "validation.verified",
    VALIDATION_FAILED: "validation.failed",
    PROOF_GENERATED: "proof.generated"

});