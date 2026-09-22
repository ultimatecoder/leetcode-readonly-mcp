import { describe, expect, it } from "vitest";
import { parseCompanyTagStats } from "../../src/leetcode/leetcode-service.js";

describe("parseCompanyTagStats", () => {
    it("returns null for undefined, null, empty string, and 'not json'", () => {
        expect(parseCompanyTagStats(undefined)).toBeNull();
        expect(parseCompanyTagStats(null)).toBeNull();
        expect(parseCompanyTagStats("")).toBeNull();
        expect(parseCompanyTagStats("not json")).toBeNull();
    });

    it("returns null for a JSON array string", () => {
        expect(parseCompanyTagStats("[1,2]")).toBeNull();
    });

    it("parses JSON.stringify correctly with type coercion", () => {
        const input = JSON.stringify({
            "three-months": [
                { name: "Google", slug: "google", timesEncountered: 5 }
            ],
            "six-months": [{ name: "Meta", slug: "facebook", count: 2 }]
        });
        const result = parseCompanyTagStats(input as unknown);
        expect(result).toEqual({
            "three-months": [
                { name: "Google", slug: "google", timesEncountered: 5 }
            ],
            "six-months": [
                { name: "Meta", slug: "facebook", timesEncountered: 2 }
            ]
        });
    });

    it("drops entries without a name and skips timeframes whose value is not an array", () => {
        const input = JSON.stringify({
            a: [{ slug: "x" }, { name: "Amazon" }],
            b: "oops"
        });
        const result = parseCompanyTagStats(input as unknown);
        expect(result).toEqual({
            a: [
                { name: "Amazon", slug: undefined, timesEncountered: undefined }
            ]
        });
    });
});
