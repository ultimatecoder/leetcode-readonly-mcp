import TurndownService from "turndown";

const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-"
});

// Keep exponents and indices readable: 10<sup>4</sup> -> 10^4, a<sub>i</sub> -> a_i
turndown.addRule("sup", {
    filter: "sup",
    replacement: (content) => `^${content}`
});
turndown.addRule("sub", {
    filter: "sub",
    replacement: (content) => `_${content}`
});

/**
 * Converts LeetCode problem HTML into Markdown.
 */
export function htmlToMarkdown(html: string | null | undefined): string {
    if (!html) {
        return "";
    }
    return turndown.turndown(html).trim();
}
