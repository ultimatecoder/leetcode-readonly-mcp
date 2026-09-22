import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
    EditorialData,
    LEETCODE_ORIGIN,
    LeetCodeService
} from "../../leetcode/leetcode-service.js";
import {
    DEFAULT_EDITORIAL_LANG,
    renderEditorial
} from "../../utils/editorial.js";
import { buildImageContent } from "../../utils/images.js";
import { ToolRegistry } from "./tool-registry.js";

function formatHeader(editorial: EditorialData, url: string): string[] {
    return [
        `# Editorial: ${editorial.questionFrontendId}. ${editorial.title}`,
        "",
        `- URL: ${url}`,
        `- Editorial premium only: ${editorial.paidOnly ? "yes" : "no"}`,
        `- Can see editorial: ${editorial.canSeeDetail ? "yes" : "no"}`,
        `- Has video solution: ${editorial.hasVideoSolution ? "yes" : "no"} (video is not included)`
    ];
}

/**
 * Editorial tool registry class that handles registration of the official editorial tool.
 */
export class EditorialToolRegistry extends ToolRegistry {
    public registerTools(): void {
        this.server.tool(
            "get_problem_editorial",
            "Returns the official LeetCode editorial of a problem as Markdown, with solution code for the chosen language and the editorial's images and slideshow frames. Premium editorials need a premium session in LEETCODE_SESSION.",
            {
                titleSlug: z
                    .string()
                    .describe(
                        "Problem URL slug (e.g., 'lru-cache')—the path segment after /problems/"
                    ),
                lang: z
                    .string()
                    .optional()
                    .default(DEFAULT_EDITORIAL_LANG)
                    .describe(
                        "Language of the solution code, as a LeetCode langSlug (e.g. 'java', 'python3', 'cpp', 'javascript', 'golang'), or 'all' for every language. Default: 'java'."
                    )
            },
            async ({ titleSlug, lang }) => {
                const editorial =
                    await this.leetcodeService.fetchEditorial(titleSlug);
                const url = `${LEETCODE_ORIGIN}/problems/${titleSlug}/editorial/`;
                const header = formatHeader(editorial, url);

                if (!editorial.content) {
                    const reason = !editorial.paidOnly
                        ? "This problem has no official editorial."
                        : this.leetcodeService.isAuthenticated()
                          ? "The editorial is premium only and the session in LEETCODE_SESSION cannot see it (not premium, or expired)."
                          : "The editorial is premium only. Set LEETCODE_SESSION to the session cookie of a premium account.";
                    return {
                        content: [
                            {
                                type: "text",
                                text: [...header, "", reason].join("\n")
                            }
                        ]
                    };
                }

                const rendered = await renderEditorial(editorial.content, {
                    lang: lang.toLowerCase(),
                    baseUrl: `${LEETCODE_ORIGIN}/problems/${titleSlug}/solution/`,
                    fetchPlaygroundCodes: (uuid) =>
                        this.leetcodeService.fetchPlaygroundCodes(uuid),
                    fetchSlideFrames: (stem) =>
                        this.leetcodeService.fetchSlideFrames(stem)
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: [
                                ...header,
                                `- Code language: ${lang}`,
                                "",
                                rendered.text
                            ].join("\n")
                        },
                        ...(await buildImageContent(rendered.images))
                    ]
                };
            }
        );
    }
}

/**
 * Registers the editorial tool with the MCP server.
 *
 * @param server - The MCP server instance to register tools with
 * @param leetcodeService - The LeetCode service implementation to use for API calls
 */
export function registerEditorialTools(
    server: McpServer,
    leetcodeService: LeetCodeService
): void {
    new EditorialToolRegistry(server, leetcodeService).registerTools();
}
