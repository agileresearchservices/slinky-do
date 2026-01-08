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
| `add_todo` | Append todo to `KMW/TODO.md` with optional tags |
| `create_note` | Create note with frontmatter in vault (folder, properties, tags) |
| `search_notes` | Search vault content, filenames, and tags |
| `get_vault_info` | Get vault structure, tags, properties, and statistics |
| `enrich_vault` | Enrich all notes with intelligent frontmatter and tags |

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

## Available MCP Servers

| Server | Description |
|--------|-------------|
| `slinky-do` | Add todos, create notes, and search the Obsidian vault |

## Git Workflow

Always use `/document-commit` for any git-related activities (committing, pushing changes).

## Security Best Practices

**⚠️ WARNING - Sensitive Data in Vault Files:**

When reading files from the Obsidian vault, be aware that some notes may contain sensitive information:
- AWS credentials (access keys, secret keys)
- API keys and tokens
- Database passwords
- Private keys and certificates

**Claude's Response:**
1. **Always flag sensitive data** - If credentials, API keys, or passwords are discovered in files, immediately alert the user
2. **Recommend remediation** - Suggest rotating exposed credentials
3. **Never commit credentials** - Never include sensitive data in git commits
4. **Use secure storage** - Recommend AWS Secrets Manager, HashiCorp Vault, or similar for credential management
5. **Document the risk** - Help document which files contain sensitive data so they can be protected

**User Responsibility:**
- Keep credential files out of version control (.gitignore)
- Use environment variables or secret management tools instead of hardcoded values
- Regularly rotate credentials
- Use access controls to limit who can read credential files
- Monitor CloudTrail/audit logs for unauthorized access

## Available Skills

Use these slash commands for specialized assistance:

| Skill | Description |
|-------|-------------|
| `/mcp-expert` | **Recommended** - Expert in MCP server development, tool design, debugging, and deployment |
| `/document-commit` | Commit and push changes with clear messages |
| `/security-expert` | Security hardening and vulnerability scanning |
| `/langchain-expert` | LangChain/LangGraph integration if adding AI features |
| `/opensearch-expert` | OpenSearch integration if adding search backend |
| `/web-designer` | UI design if adding a web interface
