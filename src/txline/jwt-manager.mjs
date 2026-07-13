// src/txline/jwt-manager.mjs

import { jwtDecode } from "jwt-decode";

import config from "../config/config.mjs";
import logger from "../logger/logger.mjs";

class JwtManager {
    constructor() {
        this.jwt = null;
        this.expiry = 0;
        this.refreshing = null;
    }

    /**
     * Returns a valid Guest JWT.
     */
    async getToken() {
        const now = Date.now();

        if (
            this.jwt &&
            now < this.expiry - 5 * 60 * 1000
        ) {
            return this.jwt;
        }

        // Prevent multiple refreshes at once.
        if (this.refreshing) {
            return this.refreshing;
        }

        this.refreshing = this.refresh();

        try {
            return await this.refreshing;
        } finally {
            this.refreshing = null;
        }
    }

    /**
     * Requests a fresh Guest JWT from TxLINE.
     */
    async refresh() {
        const url =
            `${config.txline.apiBase}${config.txline.endpoints.guestAuth}`;

        logger.info("Requesting Guest JWT");

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    Accept: "application/json"
                }
            });

            if (!response.ok) {
                throw new Error(
                    `Guest JWT request failed (${response.status})`
                );
            }

            const data = await response.json();

            if (!data.token) {
                throw new Error(
                    "Guest JWT not returned by server."
                );
            }

            this.jwt = data.token;

            const decoded = jwtDecode(this.jwt);

            if (!decoded.exp) {
                throw new Error(
                    "JWT missing expiration."
                );
            }

            this.expiry = decoded.exp * 1000;

            logger.info("Guest JWT acquired", {
                expires:
                    new Date(this.expiry).toISOString()
            });

            return this.jwt;
        }
        catch (error) {

            logger.error(
                "Unable to acquire Guest JWT",
                error.message
            );

            throw error;
        }
    }

    /**
     * Authentication headers.
     */
    async getAuthHeaders(extra = {}) {

        const token =
            await this.getToken();

        return {
            Authorization:
                `Bearer ${token}`,

            "X-Api-Token":
                config.txline.apiToken,

            ...extra
        };

    }

    /**
     * Whether cached token is valid.
     */
    isValid() {

        return (

            this.jwt &&

            Date.now() <
            this.expiry - 5 * 60 * 1000

        );

    }

    invalidate() {

        logger.warn(
            "Guest JWT invalidated"
        );

        this.jwt = null;

        this.expiry = 0;

    }

    getExpiry() {

        return this.expiry;

    }

    getStatus() {

        return {

            authenticated:
                !!this.jwt,

            valid:
                this.isValid(),

            expiresAt:
                this.expiry,

            expiresIn:

                this.expiry

                    ? Math.max(

                        0,

                        Math.floor(

                            (
                                this.expiry -
                                Date.now()
                            ) / 1000

                        )

                    )

                    : 0

        };

    }

}

export default new JwtManager();