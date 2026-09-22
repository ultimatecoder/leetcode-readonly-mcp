import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PROBLEM_CATEGORIES, PROBLEM_TAGS } from "../../common/constants.js";
import {
    CompanyStat,
    LEETCODE_ORIGIN,
    LeetCodeService
} from "../../leetcode/leetcode-service.js";
import { buildImageContent, extractImages } from "../../utils/images.js";
import { htmlToMarkdown } from "../../utils/markdown.js";
import { ToolRegistry } from "./tool-registry.js";

/**
 * Formats a simplified problem and its companies as a Markdown document.
 * Images in the description are replaced by "[Image N]" markers.
 */
export function formatProblem(
    problem: any,
    companies: Record<string, CompanyStat[]> | null
): { text: string; images: ReturnType<typeof extractImages>["images"] } {
    const url = `${LEETCODE_ORIGIN}/problems/${problem.titleSlug}/`;
    const description = extractImages(htmlToMarkdown(problem.content), url);

    const lines: string[] = [
        `# ${problem.questionFrontendId}. ${problem.title}`,
        "",
        `- Difficulty: ${problem.difficulty}`,
        `- Premium only: ${problem.isPaidOnly ? "yes" : "no"}`,
        `- URL: ${url}`,
        `- Topics: ${problem.topicTags.join(", ") || "none"}`,
        "",
        "## Description",
        "",
        description.text || "_Description not available._"
    ];

    if (problem.hints?.length) {
        lines.push("", "## Hints", "");
        problem.hints.forEach((hint: string, i: number) =>
            lines.push(`${i + 1}. ${htmlToMarkdown(hint)}`)
        );
    }

    if (problem.exampleTestcases) {
        lines.push(
            "",
            "## Example test cases (raw input)",
            "",
            "```",
            problem.exampleTestcases,
            "```"
        );
    }

    if (problem.similarQuestions?.length) {
        lines.push("", "## Similar questions", "");
        for (const q of problem.similarQuestions) {
            lines.push(`- ${q.title} (${q.titleSlug}, ${q.difficulty})`);
        }
    }

    lines.push("", "## Companies", "");
    const timeframes = companies ? Object.entries(companies) : [];
    if (timeframes.length === 0) {
        lines.push(
            "_Not available (requires a LeetCode premium session in LEETCODE_SESSION)._"
        );
    } else {
        for (const [timeframe, list] of timeframes) {
            lines.push(`### ${timeframe}`, "");
            lines.push(
                list
                    .map((c) =>
                        c.timesEncountered !== undefined
                            ? `${c.name} (${c.timesEncountered})`
                            : c.name
                    )
                    .join(", ") || "_none_",
                ""
            );
        }
    }

    if (problem.codeSnippets?.length) {
        lines.push("", "## Code stubs");
        for (const snippet of problem.codeSnippets) {
            lines.push(
                "",
                `### ${snippet.lang}`,
                "",
                "```" + snippet.langSlug,
                snippet.code,
                "```"
            );
        }
    }

    return { text: lines.join("\n"), images: description.images };
}

/**
 * Problem tool registry class that handles registration of LeetCode problem-related tools.
 * This class manages tools for accessing problem details, searching problems, and daily challenges.
 */
export class ProblemToolRegistry extends ToolRegistry {
    public registerTools(): void {
        // Daily challenge tool
        this.server.tool(
            "get_daily_challenge",
            "Returns today's LeetCode Daily Challenge (date, title, titleSlug, difficulty). Use get_problem with the titleSlug for the full problem.",
            {},
            async () => {
                const data = await this.leetcodeService.fetchDailyChallenge();
                const question = data?.question ?? {};
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                date: data?.date,
                                link: `${LEETCODE_ORIGIN}${data?.link ?? ""}`,
                                questionFrontendId: question.questionFrontendId,
                                title: question.title,
                                titleSlug: question.titleSlug,
                                difficulty: question.difficulty,
                                isPaidOnly: question.isPaidOnly
                            })
                        }
                    ]
                };
            }
        );

        // Problem details tool
        this.server.tool(
            "get_problem",
            "Returns a LeetCode problem by titleSlug: description, examples, constraints, hints, topics, similar questions, companies (premium), code stubs, and the images of the description.",
            {
                titleSlug: z
                    .string()
                    .describe(
                        "Problem URL slug (e.g., 'two-sum', 'add-two-numbers')—the path segment after /problems/"
                    )
            },
            async ({ titleSlug }) => {
                const [problem, companies] = await Promise.all([
                    this.leetcodeService.fetchProblemSimplified(titleSlug),
                    this.leetcodeService.fetchCompanies(titleSlug)
                ]);
                const { text, images } = formatProblem(problem, companies);
                return {
                    content: [
                        { type: "text", text },
                        ...(await buildImageContent(images))
                    ]
                };
            }
        );

        // Search problems tool
        this.server.tool(
            "search_problems",
            "Searches LeetCode problems by category, tags, difficulty, and keywords, with pagination via limit/offset. Returns the matching problem list as JSON.",
            {
                category: z
                    .enum(PROBLEM_CATEGORIES as [string])
                    .default("all-code-essentials")
                    .describe(
                        "Problem set category (e.g., 'algorithms', 'database'). Default: 'all-code-essentials'."
                    ),
                tags: z
                    .array(z.enum(PROBLEM_TAGS as [string]))
                    .optional()
                    .describe(
                        "Topic tags to filter by, e.g. ['array', 'dynamic-programming']. Omit for no tag filter."
                    ),
                difficulty: z
                    .enum(["EASY", "MEDIUM", "HARD"])
                    .optional()
                    .describe("Difficulty filter. Omit for all levels."),
                searchKeywords: z
                    .string()
                    .optional()
                    .describe(
                        "Keyword search in problem titles and descriptions; a problem number also works"
                    ),
                limit: z
                    .number()
                    .optional()
                    .default(10)
                    .describe("Max results per page (default: 10)"),
                offset: z
                    .number()
                    .optional()
                    .describe("Results to skip for pagination (default: 0)")
            },
            async ({
                category,
                tags,
                difficulty,
                limit,
                offset,
                searchKeywords
            }) => {
                const data = await this.leetcodeService.searchProblems(
                    category,
                    tags,
                    difficulty,
                    limit,
                    offset,
                    searchKeywords
                );
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                filters: { tags, difficulty, searchKeywords },
                                pagination: { limit, offset },
                                problems: data
                            })
                        }
                    ]
                };
            }
        );
    }
}

/**
 * Registers all problem-related tools with the MCP server.
 *
 * @param server - The MCP server instance to register tools with
 * @param leetcodeService - The LeetCode service implementation to use for API calls
 */
export function registerProblemTools(
    server: McpServer,
    leetcodeService: LeetCodeService
): void {
    new ProblemToolRegistry(server, leetcodeService).registerTools();
}
