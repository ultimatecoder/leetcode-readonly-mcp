import { pino } from "pino";

// Log to stderr: stdout carries the MCP stdio protocol.
const logger = pino(
    {
        level: "info",
        formatters: {
            level: (label: string) => ({ level: label.toUpperCase() })
        },
        timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
        messageKey: "message",
        nestedKey: "payload"
    },
    pino.destination(2)
);

export default logger;
