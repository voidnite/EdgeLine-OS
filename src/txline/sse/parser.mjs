// src/txline/sse/parser.mjs

export function parseSseBlock(block) {

    const message = {

        id: undefined,

        event: undefined,

        retry: undefined,

        data: ""

    };

    for (const rawLine of block.split(/\r?\n/)) {

        if (!rawLine)
            continue;

        // Ignore SSE comments
        if (rawLine.startsWith(":"))
            continue;

        const separator = rawLine.indexOf(":");

        const field =
            separator === -1
                ? rawLine
                : rawLine.slice(0, separator);

        const value =
            separator === -1
                ? ""
                : rawLine
                    .slice(separator + 1)
                    .replace(/^ /, "");

        switch (field) {

            case "id":

                message.id = value;

                break;

            case "event":

                message.event = value;

                break;

            case "retry":

                message.retry = Number(value);

                break;

            case "data":

                message.data += value + "\n";

                break;

        }

    }

    message.data =
        message.data.replace(/\n$/, "");

    if (
        !message.data &&
        !message.event &&
        !message.id
    ) {

        return null;

    }

    return message;

}