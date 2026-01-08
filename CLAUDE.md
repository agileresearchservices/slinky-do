# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

slinky-do - MCP server for Obsidian vault integration. Enables adding todos and notes to a local Obsidian vault from Claude CLI.

## Build Commands

```bash
npm install     # Install dependencies
npm run build   # Compile TypeScript to dist/
npm run dev     # Watch mode for development
npm start       # Run the compiled server
```

## Architecture

Single TypeScript file MCP server (`src/index.ts`) using:
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `zod` - Parameter validation
- Stdio transport for Claude CLI integration

## MCP Tools

| Tool | Description |
|------|-------------|
| `add_todo` | Append todo to `KMW/TODO.md` |
| `create_note` | Create note with frontmatter in `KMW/Inbox/` |
| `search_notes` | Search vault content and filenames |

## Configuration

Set `OBSIDIAN_VAULT_PATH` environment variable to override default vault location.

Default: `/Users/kevin/Library/Mobile Documents/iCloud~md~obsidian/Documents/KMW`

## Claude CLI Integration

```bash
claude mcp add -s user slinky-do -- node /Users/kevin/github/personal/slinky-do/dist/index.js
```

Verify with:
```bash
claude mcp list
```

## Claude Desktop Integration

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "slinky-do": {
      "command": "node",
      "args": ["/Users/kevin/github/personal/slinky-do/dist/index.js"],
      "env": {
        "OBSIDIAN_VAULT_PATH": "/Users/kevin/Library/Mobile Documents/iCloud~md~obsidian/Documents/KMW"
      }
    }
  }
}
```

Restart Claude Desktop after saving.
