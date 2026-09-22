#!/usr/bin/env node
// Live smoke test: starts the built server over stdio and calls every tool.
// Usage: npm run build && node scripts/smoke.mjs [--full]
// Set LEETCODE_SESSION in your shell to test premium content. It is passed to the
// server process only and never printed.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const full = process.argv.includes("--full");

const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["build/index.js"],
    env: { ...process.env },
    stderr: "inherit"
});
const client = new Client({ name: "smoke", version: "1.0.0" });
await client.connect(transport);

const { tools } = await client.listTools();
console.log("tools:", tools.map((t) => t.name).join(", "));
console.log("session set:", process.env.LEETCODE_SESSION ? "yes" : "no");

async function call(name, args) {
    const started = Date.now();
    const result = await client.callTool({ name, arguments: args });
    const texts = result.content.filter((c) => c.type === "text");
    const images = result.content.filter((c) => c.type === "image");
    const imageBytes = images.reduce(
        (sum, c) => sum + (c.data.length * 3) / 4,
        0
    );
    const totalBytes = Buffer.byteLength(JSON.stringify(result));
    const text = texts.map((c) => c.text).join("\n");
    console.log(
        `\n=== ${name} ${JSON.stringify(args)} (${Date.now() - started} ms)` +
            `${result.isError ? " ERROR" : ""}\n` +
            `text chars: ${text.length}, images: ${images.length}, ` +
            `image KB: ${(imageBytes / 1024).toFixed(0)}, result KB: ${(totalBytes / 1024).toFixed(0)}`
    );
    const fences = [...text.matchAll(/^```(\w+)/gm)].map((m) => m[1]);
    console.log("code fences:", fences.join(", ") || "none");
    const failed = texts.filter((c) => c.text.includes("could not be"));
    if (failed.length) {
        console.log(
            "fetch failures:\n" + failed.map((c) => "  " + c.text).join("\n")
        );
    }
    console.log(
        full ? text : text.slice(0, 1200) + (text.length > 1200 ? "\n..." : "")
    );
    return result;
}

await call("get_daily_challenge", {});
await call("search_problems", { searchKeywords: "lru cache", limit: 3 });
await call("get_problem", { titleSlug: "rotate-image" });
await call("get_problem_editorial", { titleSlug: "two-sum" });
await call("get_problem_editorial", { titleSlug: "lru-cache" });
await call("get_problem_editorial", {
    titleSlug: "lru-cache",
    lang: "python3"
});
await call("get_problem_editorial", { titleSlug: "lru-cache", lang: "all" });

await client.close();
