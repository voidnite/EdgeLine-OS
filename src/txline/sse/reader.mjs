// src/txline/sse/reader.mjs

import { parseSseBlock } from "./parser.mjs";
import SseMessage from "./message.mjs";

export async function* readSseMessages(response) {

    if (!response.body) {

        throw new Error(
            "Stream response has no body."
        );

    }

    const reader =
        response.body.getReader();

    const decoder =
        new TextDecoder();

    let buffer = "";

    try {

        while (true) {

            const { value, done } =
                await reader.read();

            if (done)
                break;

            buffer +=
                decoder.decode(value, {

                    stream: true

                });

            let separator =
                buffer.match(/\r?\n\r?\n/);

            while (separator?.index !== undefined) {

                const block =
                    buffer.slice(0, separator.index);

                buffer =
                    buffer.slice(
                        separator.index +
                        separator[0].length
                    );

                const parsed =
                    parseSseBlock(block);

                if (parsed) {

                    yield new SseMessage(parsed);

                }

                separator =
                    buffer.match(/\r?\n\r?\n/);

            }

        }

    }

    finally {

        reader.releaseLock();

    }

}