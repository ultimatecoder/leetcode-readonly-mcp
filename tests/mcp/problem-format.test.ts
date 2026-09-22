import { describe, expect, it } from "vitest";
import { formatProblem } from "../../src/mcp/tools/problem-tools.js";

const problem = {
    titleSlug: "rotate-image",
    questionFrontendId: "48",
    title: "Rotate Image",
    content:
        '<p>Rotate.</p><img src="https://assets.leetcode.com/uploads/mat1.jpg" /><ul><li><code>1 &lt;= n &lt;= 10<sup>4</sup></code></li></ul>',
    isPaidOnly: false,
    difficulty: "Medium",
    topicTags: ["array", "matrix"],
    codeSnippets: [
        { lang: "Java", langSlug: "java", code: "class Solution {}" }
    ],
    exampleTestcases: "[[1,2],[3,4]]",
    hints: ["Use <b>transpose</b>."],
    similarQuestions: [{ title: "X", titleSlug: "x", difficulty: "Easy" }]
};

describe("formatProblem", () => {
    it("renders a markdown document with image markers", () => {
        const { text, images } = formatProblem(problem, null);
        expect(text).toContain("# 48. Rotate Image");
        expect(text).toContain("- Topics: array, matrix");
        expect(text).toContain("[Image 1]");
        expect(text).toContain("10^4");
        expect(text).toContain("1. Use **transpose**.");
        expect(text).toContain("```java\nclass Solution {}\n```");
        expect(images).toEqual([
            {
                label: "[Image 1]",
                url: "https://assets.leetcode.com/uploads/mat1.jpg"
            }
        ]);
    });

    it("explains when companies are not available", () => {
        expect(formatProblem(problem, null).text).toContain(
            "_Not available (requires a LeetCode premium session"
        );
    });

    it("lists companies per timeframe", () => {
        const { text } = formatProblem(problem, {
            "three-months": [
                { name: "Google", timesEncountered: 5 },
                { name: "Amazon" }
            ]
        });
        expect(text).toContain("### three-months\n\nGoogle (5), Amazon");
    });
});
