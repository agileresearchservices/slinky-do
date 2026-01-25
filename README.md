# slinky-do

An MCP (Model Context Protocol) server for Obsidian vault integration. Enables adding todos, managing notes, and searching your vault from Claude CLI or Claude Desktop.

## Features

- **Todo Management** - Add, list, and complete todos with tag support
- **Full Note CRUD** - Create, read, update, delete, move, and rename notes
- **Daily Notes** - Automatic daily note creation with section support
- **Full-text Search** - Search across content, filenames, and tags
- **Tag Queries** - Find notes by tags with AND/OR logic
- **Backlinks** - Discover notes that link to a specific note
- **Vault Validation** - Detect and fix broken wikilinks
- **Intelligent Enrichment** - Auto-generate frontmatter from folder structure and content
- **Wikilink Management** - Automatically update links when renaming/moving notes

## Installation

```bash
git clone https://github.com/agileresearchservices/slinky-do.git
cd slinky-do
npm install
npm run build
```

## Configuration

Set the `OBSIDIAN_VAULT_PATH` environment variable to point to your vault:

```bash
export OBSIDIAN_VAULT_PATH="/path/to/your/obsidian/vault"
```

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SLINKY_TODO_FILE` | Relative path to TODO file | `KMW/TODO.md` |
| `SLINKY_INBOX_FOLDER` | Default folder for new notes | `Inbox` |
| `SLINKY_ARCHIVE_FOLDER` | Folder for archived notes | `Archive` |
| `SLINKY_DAILY_FOLDER` | Folder for daily notes | `Daily` |
| `SLINKY_CACHE_TTL_MS` | Vault stats cache TTL (ms) | `30000` |

## Integration

### Claude CLI

Add the MCP server to Claude CLI:

```bash
claude mcp add -s user slinky-do -- node /path/to/slinky-do/dist/index.js
```

With custom vault path:

```bash
claude mcp add -s user slinky-do -e OBSIDIAN_VAULT_PATH="/path/to/vault" -- node /path/to/slinky-do/dist/index.js
```

Verify installation:

```bash
claude mcp list
```

### Claude Desktop

Edit the config file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "slinky-do": {
      "command": "node",
      "args": ["/path/to/slinky-do/dist/index.js"],
      "env": {
        "OBSIDIAN_VAULT_PATH": "/path/to/your/obsidian/vault"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

## MCP Tools

### Todo Management

| Tool | Description |
|------|-------------|
| `add_todo` | Add a todo item with optional tags (#backlog, #waiting, etc.) |
| `list_todos` | List todos with status, tags, and IDs; filter by status or tag |
| `complete_todo` | Mark a todo as completed by ID or text match |

### Note Operations

| Tool | Description |
|------|-------------|
| `create_note` | Create a note with YAML frontmatter (title, date, tags) |
| `get_note` | Read a note's content, frontmatter, and metadata |
| `update_note` | Update content, append text, or modify frontmatter |
| `delete_note` | Archive (default) or permanently delete a note |
| `move_note` | Move a note to a different folder |
| `rename_note` | Rename a note and update wikilinks across the vault |
| `daily_note` | Create or append to daily notes with optional sections |

### Search & Discovery

| Tool | Description |
|------|-------------|
| `search_notes` | Full-text search across content and filenames |
| `query_by_tags` | Find notes by tags with AND/OR logic |
| `get_recent_notes` | List recently modified notes |
| `get_backlinks` | Find notes linking to a specific note |
| `get_vault_info` | Get vault structure, tags, properties, and statistics |

### Vault Maintenance

| Tool | Description |
|------|-------------|
| `enrich_vault` | Auto-generate frontmatter from paths and content |
| `validate_vault` | Detect and optionally fix broken wikilinks |

## Development

```bash
npm install       # Install dependencies
npm run build     # Compile TypeScript
npm run dev       # Watch mode for development
npm start         # Run the compiled server
npm test          # Run tests
npm run test:watch  # Run tests in watch mode
```

## Architecture

Single TypeScript file MCP server using:
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `zod` - Parameter validation
- `js-yaml` - YAML frontmatter parsing
- Stdio transport for Claude integration

## Testing

Tests are written with Vitest:

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

## License

ISC
