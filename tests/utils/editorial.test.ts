import { describe, expect, it, vi } from "vitest";
import { parseSlideStem, renderEditorial } from "../../src/utils/editorial.js";

const BASE = "https://leetcode.com/problems/lru-cache/solution/";

const CONTENT = [
    "## Approach 1",
    '<iframe src="https://leetcode.com/playground/AbC123/shared" frameBorder="0" width="100%" height="400" name="AbC123"></iframe>',
    "![diagram](../Figures/146/diagram.png)",
    "!?!../Documents/146_LIS.json:1000,563!?!"
].join("\n\n");

function fetchers(
    overrides: Partial<Parameters<typeof renderEditorial>[1]> = {}
) {
    return {
        fetchPlaygroundCodes: vi.fn(async () => [
            { langSlug: "java", code: "class Solution {}\n" },
            { langSlug: "python3", code: "class Solution: pass" },
            { langSlug: "cpp", code: "class Solution {};" }
        ]),
        fetchSlideFrames: vi.fn(async () => [
            "https://assets.leetcode.com/static_assets/media/original_images/146/s1.png",
            "https://assets.leetcode.com/static_assets/media/original_images/146/s2.png"
        ]),
        ...overrides
    };
}

describe("parseSlideStem", () => {
    it("extracts the path after Documents/", () => {
        expect(parseSlideStem("../Documents/94_Binary.json:1000,563")).toBe(
            "94_Binary"
        );
        expect(parseSlideStem("../Documents/4/s1.json")).toBe("4/s1");
    });

    it("rejects markers that are not documents json", () => {
        expect(parseSlideStem("../Figures/1.png")).toBeNull();
        expect(parseSlideStem("../Other/x.json")).toBeNull();
    });
});

describe("renderEditorial", () => {
    it("uses java code by default and fetches each playground once", async () => {
        const f = fetchers();
        const { text } = await renderEditorial(CONTENT, {
            lang: "java",
            baseUrl: BASE,
            ...f
        });
        expect(text).toContain("```java\nclass Solution {}\n```");
        expect(text).not.toContain("```python");
        expect(text).not.toContain("<iframe");
        expect(f.fetchPlaygroundCodes).toHaveBeenCalledTimes(1);
        expect(f.fetchPlaygroundCodes).toHaveBeenCalledWith("AbC123");
    });

    it("selects a requested language", async () => {
        const { text } = await renderEditorial(CONTENT, {
            lang: "python3",
            baseUrl: BASE,
            ...fetchers()
        });
        expect(text).toContain("```python\nclass Solution: pass\n```");
        expect(text).not.toContain("```java");
    });

    it("includes every language for 'all'", async () => {
        const { text } = await renderEditorial(CONTENT, {
            lang: "all",
            baseUrl: BASE,
            ...fetchers()
        });
        expect(text).toContain("```java");
        expect(text).toContain("```python");
        expect(text).toContain("```cpp");
    });

    it("notes a missing language with the available ones", async () => {
        const { text } = await renderEditorial(CONTENT, {
            lang: "rust",
            baseUrl: BASE,
            ...fetchers()
        });
        expect(text).toContain(
            "has no rust version. Available: java, python3, cpp."
        );
    });

    it("degrades to a note when a playground cannot be fetched", async () => {
        const f = fetchers({
            fetchPlaygroundCodes: vi.fn(async () => {
                throw new Error("boom");
            })
        });
        const { text } = await renderEditorial(CONTENT, {
            lang: "java",
            baseUrl: BASE,
            ...f
        });
        expect(text).toContain(
            "Code could not be fetched: https://leetcode.com/playground/AbC123/shared"
        );
    });

    it("turns images and slideshow frames into labelled references", async () => {
        const f = fetchers();
        const { text, images } = await renderEditorial(CONTENT, {
            lang: "java",
            baseUrl: BASE,
            ...f
        });
        expect(f.fetchSlideFrames).toHaveBeenCalledWith("146_LIS");
        expect(text).toContain("[Image 1] (diagram)");
        expect(text).toContain(
            "> Slideshow 1 (2 frames): [Slide 1, frame 1] [Slide 1, frame 2]"
        );
        expect(images).toEqual([
            {
                label: "[Image 1]",
                url: "https://assets.leetcode.com/static_assets/media/original_images/146/diagram.png"
            },
            {
                label: "[Slide 1, frame 1]",
                url: "https://assets.leetcode.com/static_assets/media/original_images/146/s1.png"
            },
            {
                label: "[Slide 1, frame 2]",
                url: "https://assets.leetcode.com/static_assets/media/original_images/146/s2.png"
            }
        ]);
    });

    it("degrades to a note when slides cannot be fetched", async () => {
        const f = fetchers({
            fetchSlideFrames: vi.fn(async () => {
                throw new Error("404");
            })
        });
        const { text, images } = await renderEditorial(CONTENT, {
            lang: "java",
            baseUrl: BASE,
            ...f
        });
        expect(text).toContain(
            "> Slideshow 1 could not be fetched (../Documents/146_LIS.json:1000,563)."
        );
        expect(images).toHaveLength(1);
    });
});
