import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Credential, LeetCode } from "leetcode-query";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LeetCodeService } from "../../src/leetcode/leetcode-service.js";
import { createMcpServer } from "../../src/server.js";

describe("MCP server surface", () => {
    it("exposes exactly the four read-only tools", async () => {
        const credential = new Credential();
        const server = createMcpServer(
            new LeetCodeService(new LeetCode(credential), credential)
        );
        const [clientTransport, serverTransport] =
            InMemoryTransport.createLinkedPair();
        const client = new Client({ name: "test", version: "1.0.0" });
        await Promise.all([
            server.connect(serverTransport),
            client.connect(clientTransport)
        ]);

        const { tools } = await client.listTools();
        expect(tools.map((tool) => tool.name).sort()).toEqual([
            "get_daily_challenge",
            "get_problem",
            "get_problem_editorial",
            "search_problems"
        ]);
        await client.close();
    });
});

describe("read-only source", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
            const path = join(dir, name);
            if (statSync(path).isDirectory()) walk(path);
            else files.push(path);
        }
    };
    walk("src");

    it("contains no GraphQL mutations or submit/run endpoints", () => {
        for (const file of files) {
            const source = readFileSync(file, "utf-8");
            expect(source, file).not.toMatch(/\bmutation\b/i);
            expect(source, file).not.toMatch(/submit/i);
            expect(source, file).not.toMatch(/interpret_solution/i);
        }
    });

    it("never sends non-GET requests outside leetcode-query", () => {
        for (const file of files) {
            const source = readFileSync(file, "utf-8");
            expect(source, file).not.toMatch(/method\s*:/i);
        }
    });
});
