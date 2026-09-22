#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import minimist from "minimist";
import { LeetCodeService } from "./leetcode/leetcode-service.js";
import { createMcpServer } from "./server.js";
import logger from "./utils/logger.js";

const HELP = `leetcode-readonly-mcp - read-only MCP server for leetcode.com

Usage: leetcode-readonly-mcp [--help]

Runs over stdio. Downloads problems, editorials, and their images; never writes to LeetCode.

Environment variables:
  LEETCODE_SESSION    Optional LEETCODE_SESSION cookie of your account.
                      Required for premium editorials and company tags.`;

/**
 * Main function that initializes and starts the server over stdio.
 */
async function main() {
    const args = minimist(process.argv.slice(2), {
        boolean: ["help"],
        alias: { h: "help" }
    });
    if (args.help) {
        process.stderr.write(HELP + "\n");
        process.exit(0);
    }

    const leetcodeService = await LeetCodeService.create(
        process.env.LEETCODE_SESSION || undefined
    );
    const server = createMcpServer(leetcodeService);
    await server.connect(new StdioServerTransport());
}

main().catch((error) => {
    logger.error("Failed to start LeetCode MCP Server: %s", error);
    process.exit(1);
});
