export const LogLevel = Object.freeze({
    DEBUG: "DEBUG",
    INFO: "INFO",
    WARN: "WARN",
    ERROR: "ERROR",
});

class Logger {

    timestamp() {
        return new Date().toISOString();
    }

    write(level, message, meta = null) {

        const prefix =
            `[${this.timestamp()}] [${level}]`;

        if (meta) {
            console.log(prefix, message, meta);
        } else {
            console.log(prefix, message);
        }

    }

    debug(message, meta) {
        this.write(LogLevel.DEBUG, message, meta);
    }

    info(message, meta) {
        this.write(LogLevel.INFO, message, meta);
    }

    warn(message, meta) {
        this.write(LogLevel.WARN, message, meta);
    }

    error(message, meta) {
        this.write(LogLevel.ERROR, message, meta);
    }

}

export default new Logger();