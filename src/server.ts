import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LeetCodeService } from "./leetcode/leetcode-service.js";
import { registerEditorialTools } from "./mcp/tools/editorial-tools.js";
import { registerProblemTools } from "./mcp/tools/problem-tools.js";

/**
 * Retrieves the package.json object containing metadata about the project.
 *
 * @returns The package.json object containing metadata about the project.
 */
function getPackageJson() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packageJSONPath = join(__dirname, "..", "package.json");
    return JSON.parse(readFileSync(packageJSONPath, "utf-8"));
}

/**
 * Creates and configures the MCP server instance.
 */
export function createMcpServer(leetcodeService: LeetCodeService): McpServer {
    const server = new McpServer({
        name: "LeetCode Read-only MCP Server",
        version: getPackageJson().version
    });

    registerProblemTools(server, leetcodeService);
    registerEditorialTools(server, leetcodeService);

    return server;
}
