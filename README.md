# leetcode-readonly-mcp

A **read-only** [Model Context Protocol](https://modelcontextprotocol.io) server that downloads LeetCode (leetcode.com) content for your LLM: problem descriptions, examples, hints, company tags, and the official editorial with its solution code, images, and slideshows.

It is meant for discussing DSA problems with an assistant such as Claude desktop. With a premium account, you also get premium editorials and company tags.

> Forked from [jinzcdev/leetcode-mcp-server](https://github.com/jinzcdev/leetcode-mcp-server). See [Credits](#credits).

## Read-only by design

This server only **downloads** data. It has no feature that writes to LeetCode:

- No code submission, no "run code", no notes, and no profile or account changes.
- Every LeetCode request is a GraphQL **query** (through [leetcode-query](https://github.com/JacobLinCool/LeetCode-Query)) or a GET for static images and slideshow data.
- Images are only downloaded from LeetCode hosts.
- Tests fail if the source contains a GraphQL mutation or submit/run endpoints.

It runs locally over stdio. Your session cookie never leaves your machine, except in requests to leetcode.com.

## Tools

| Tool                    | Input                                                                 | Returns                                                                                                                                                                                                                                                |
| ----------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `get_problem`           | `titleSlug`                                                           | Markdown with description, examples, constraints, hints, topics, similar questions, company tags (premium), and code stubs. Also returns description images.                                                                                           |
| `get_problem_editorial` | `titleSlug`, `lang` (default `java`)                                  | Official editorial as Markdown. Solution code comes in the chosen language: any LeetCode langSlug such as `python3`, `cpp`, or `golang`, or `all`. Also returns editorial images and every slideshow frame. Premium editorials need a premium session. |
| `search_problems`       | `searchKeywords`, `tags`, `difficulty`, `category`, `limit`, `offset` | Matching problems (id, title, slug, difficulty, premium flag, topics).                                                                                                                                                                                 |
| `get_daily_challenge`   | –                                                                     | Today's daily challenge (date, title, slug, difficulty).                                                                                                                                                                                               |

Images are returned as MCP image content, downscaled to at most 800px wide (JPEG), so the model can look at them. The text marks where each image belongs with `[Image N]` or `[Slide K, frame M]`. Editorial videos are not included; the editorial reports whether a video exists.

## Setup

Requirements: Node.js 20.9 or newer.

### 1. Get your LeetCode session cookie (optional, needed for premium)

Free problems and free editorials work without it. For premium editorials and company tags:

1. Sign in at https://leetcode.com with your premium account.
2. Open DevTools and go to **Application** (Chrome) or **Storage** (Firefox), then **Cookies** > `https://leetcode.com`.
3. Copy the value of `LEETCODE_SESSION`.

> **Security:** `LEETCODE_SESSION` gives full access to your LeetCode account. Treat it like a password: do not commit it or share your config file. This server only reads with it.

The cookie expires after some time, or when you sign out. When premium content stops appearing, copy a fresh one.

### 2. Add the server to Claude desktop

Edit `claude_desktop_config.json`:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "leetcode": {
      "command": "npx",
      "args": ["-y", "github:ultimatecoder/leetcode-readonly-mcp"],
      "env": {
        "LEETCODE_SESSION": "<your LEETCODE_SESSION cookie>"
      }
    }
  }
}
```

Restart Claude desktop. The first start takes a little longer, because npx downloads and builds the server.

If Claude desktop cannot find `npx`, use its absolute path as `command`. Find it with `which npx` (for example `/opt/homebrew/bin/npx`).

### Other MCP clients

Any stdio MCP client works. Use the same command: `npx -y github:ultimatecoder/leetcode-readonly-mcp`, with `LEETCODE_SESSION` in the environment.

## Development

```bash
git clone https://github.com/ultimatecoder/leetcode-readonly-mcp.git
cd leetcode-readonly-mcp
npm install
npm run build
npm test
```

Live smoke test against leetcode.com. It calls every tool and prints sizes and a preview. Export `LEETCODE_SESSION` first to include premium content:

```bash
node scripts/smoke.mjs
```

Inspect the server with the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node build/index.js
```

## Credits

- [jinzcdev/leetcode-mcp-server](https://github.com/jinzcdev/leetcode-mcp-server) by jinzc (MIT). This project is a fork of it. Its project structure, problem, search, and daily challenge tools, and search query are reused here, with every write feature removed.
- [leetcode-query](https://github.com/JacobLinCool/LeetCode-Query) by JacobLinCool (MIT). It is the LeetCode GraphQL client used for all queries.
- [RSSHub](https://github.com/DIYgod/RSSHub). Its LeetCode route showed the `allPlaygroundCodes` query for editorial code. Only the approach was used; no RSSHub code (AGPL-3.0) is included.

## License

[MIT](LICENSE). The original copyright of jinzc is retained.
