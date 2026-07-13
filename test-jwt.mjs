import axios from "axios";
import { jwtDecode } from "jwt-decode";
import config from "../config/config.mjs";

class JwtManager {
    constructor() {
        this.jwt = null;
        this.expiry = 0;
    }

    /**
     * Returns a valid Guest JWT.
     * Refreshes automatically if expired or about to expire.
     */
    async getToken() {
        const now = Date.now();

        // Refresh if token expires within the next 5 minutes
        if (this.jwt && now < this.expiry - (5 * 60 * 1000)) {
            return this.jwt;
        }

        return this.refresh();
    }

    /**
     * Request a fresh Guest JWT from TxLINE.
     */
    async refresh() {

        console.log("🔐 Requesting Guest JWT...");

        try {

            const response = await axios.post(
                `${config.txline.apiBase}/auth/guest/start`
            );

            this.jwt = response.data.token;

            const decoded = jwtDecode(this.jwt);

            if (!decoded.exp) {
                throw new Error("JWT does not contain an expiration time.");
            }

            // exp is in seconds since Unix epoch
            this.expiry = decoded.exp * 1000;

            console.log("✅ Guest JWT acquired");

            console.log(
                `🕒 Expires: ${new Date(this.expiry).toLocaleString()}`
            );

            return this.jwt;

        } catch (error) {

            console.error("❌ Failed to acquire Guest JWT");

            if (error.response) {
                console.error(error.response.status);
                console.error(error.response.data);
            } else {
                console.error(error.message);
            }

            throw error;
        }
    }

    /**
     * Force the next request to obtain a new JWT.
     */
    invalidate() {
        this.jwt = null;
        this.expiry = 0;
    }

    /**
     * Returns true if the current token is still usable.
     */
    isValid() {

        return (
            this.jwt &&
            Date.now() < this.expiry - (5 * 60 * 1000)
        );

    }

    /**
     * Returns JWT expiration timestamp.
     */
    getExpiry() {
        return this.expiry;
    }
}

export default new JwtManager();