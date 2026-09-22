import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LeetCodeService } from "../../leetcode/leetcode-service.js";

/**
 * Base registry class for LeetCode tools.
 */
export abstract class ToolRegistry {
    /**
     * Creates a new tool registry instance.
     *
     * @param server - The MCP server instance to register tools with
     * @param leetcodeService - The LeetCode service implementation to use for API calls
     */
    constructor(
        protected server: McpServer,
        protected leetcodeService: LeetCodeService
    ) {}

    /**
     * Registers the tools of this registry with the MCP server.
     */
    public abstract registerTools(): void;
}
