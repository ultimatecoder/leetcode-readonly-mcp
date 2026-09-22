import { describe, expect, it } from "vitest";
import {
    extractImages,
    isAllowedImageUrl,
    resolveAssetUrl
} from "../../src/utils/images.js";

const BASE = "https://leetcode.com/problems/rotate-image/";

describe("resolveAssetUrl", () => {
    it("maps relative editorial figures to original_images", () => {
        expect(resolveAssetUrl("../Figures/94/94_BinarySlide1.PNG", BASE)).toBe(
            "https://assets.leetcode.com/static_assets/media/original_images/94/94_BinarySlide1.PNG"
        );
    });

    it("keeps absolute URLs and resolves other relative paths against the base", () => {
        expect(
            resolveAssetUrl("https://assets.leetcode.com/uploads/a.jpg", BASE)
        ).toBe("https://assets.leetcode.com/uploads/a.jpg");
        expect(resolveAssetUrl("/static/x.png", BASE)).toBe(
            "https://leetcode.com/static/x.png"
        );
    });
});

describe("extractImages", () => {
    it("replaces markdown and html images with numbered markers", () => {
        const text = [
            'Example ![grid](https://assets.leetcode.com/uploads/grid.jpg "title")',
            '<img alt="tree" src="https://assets.leetcode.com/uploads/tree.png" style="width: 200px" />'
        ].join("\n");
        const result = extractImages(text, BASE);
        expect(result.text).toBe("Example [Image 1] (grid)\n[Image 2] (tree)");
        expect(result.images).toEqual([
            {
                label: "[Image 1]",
                url: "https://assets.leetcode.com/uploads/grid.jpg"
            },
            {
                label: "[Image 2]",
                url: "https://assets.leetcode.com/uploads/tree.png"
            }
        ]);
    });

    it("leaves text without images unchanged", () => {
        expect(extractImages("no images", BASE)).toEqual({
            text: "no images",
            images: []
        });
    });
});

describe("isAllowedImageUrl", () => {
    it("allows LeetCode hosts over https only", () => {
        expect(
            isAllowedImageUrl("https://assets.leetcode.com/uploads/a.png")
        ).toBe(true);
        expect(isAllowedImageUrl("https://leetcode.com/static/a.png")).toBe(
            true
        );
        expect(
            isAllowedImageUrl(
                "https://s3-lc-upload.s3.amazonaws.com/uploads/a.png"
            )
        ).toBe(true);
        expect(isAllowedImageUrl("http://assets.leetcode.com/a.png")).toBe(
            false
        );
        expect(isAllowedImageUrl("https://evil.com/a.png")).toBe(false);
        expect(isAllowedImageUrl("https://leetcode.com.evil.com/a.png")).toBe(
            false
        );
    });
});
