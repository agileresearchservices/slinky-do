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
npm test        # Run tests with Vitest
npm run test:watch  # Run tests in watch mode
```

## Architecture

Single TypeScript file MCP server (`src/index.ts`) using:
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `zod` - Parameter validation
- Stdio transport for Claude CLI integration

## MCP Tools

### Todo Management
| Tool | Description |
|------|-------------|
| `add_todo` | Append todo to `KMW/TODO.md` with optional tags |
| `list_todos` | List all todos with status, tags, and IDs (filter by status/tag) |
| `complete_todo` | Mark a todo as completed by ID or text match |

### Note Operations
| Tool | Description |
|------|-------------|
| `create_note` | Create note with frontmatter in vault (folder, properties, tags) |
| `get_note` | Read a specific note's content, frontmatter, and metadata |
| `update_note` | Update note content, tags, or properties (replace, append, merge) |
| `delete_note` | Archive or permanently delete a note |
| `move_note` | Move a note to a different folder |
| `daily_note` | Create or append to daily notes with optional sections |

### Search & Discovery
| Tool | Description |
|------|-------------|
| `search_notes` | Full-text search across vault content and filenames |
| `query_by_tags` | Find notes by tags with AND/OR logic |
| `get_vault_info` | Get real-time vault structure, tags, properties (dynamic scanning) |

### Vault Maintenance
| Tool | Description |
|------|-------------|
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
| `slinky-do` | Comprehensive Obsidian vault integration with 13 MCP tools: manage todos (add, list, complete), perform full CRUD operations on notes (create, read, update, delete, move, daily notes), search via full-text or tags, and auto-enrich vault metadata. Supports dynamic vault scanning, frontmatter management, and intelligent tagging across 142+ notes in multi-customer environments (Gartner, Nasuni, ThermoFisher, Lucille). |
| `memory` | Persistent knowledge graph across Claude CLI sessions. Store entities, relations, and observations that persist between conversations. Tools: create_entities, create_relations, add_observations, delete_entities, delete_observations, delete_relations, read_graph, search_nodes, open_nodes. |
| `git` | Comprehensive Git operations via MCP. Tools: git_add, git_branch, git_checkout, git_cherry_pick, git_clean, git_clone, git_commit, git_diff, git_fetch, git_init, git_log, git_merge, git_pull, git_push, git_rebase, git_remote, git_reset, git_show, git_stash, git_status, git_tag, git_worktree, git_wrapup_instructions. |

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
| `/web-designer` | UI design if adding a web interface |
| `/code-reviewer` | Comprehensive code review for logic, quality, performance, security, maintainability |
| `/resume-expert` | Resume writing, optimization, and ATS tailoring |
