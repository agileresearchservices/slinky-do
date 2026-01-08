#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import * as yaml from "js-yaml";

// Configuration
const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH ||
  "/Users/kevin/Library/Mobile Documents/iCloud~md~obsidian/Documents/KMW";
const TODO_FILE = path.join(VAULT_PATH, "KMW/TODO.md");
const DEFAULT_INBOX = "Inbox";

// Types for vault enrichment
interface InferredMetadata {
  title: string;
  tags: Set<string>;
  customer?: string;
  project?: string;
  type?: string;
  status: string;
  date?: string;
}

// Types for dynamic vault info
interface VaultStats {
  totalNotes: number;
  folders: Map<string, number>;
  tags: Map<string, number>;
  properties: Set<string>;
}

// Types for todo items
interface TodoItem {
  id: number;
  text: string;
  completed: boolean;
  tags: string[];
  line: number;
}

// Vault enrichment helper functions
function inferMetadataFromPath(filePath: string, fileName: string): InferredMetadata {
  const metadata: InferredMetadata = {
    title: fileName.replace(/\.md$/, '').replace(/_/g, ' '),
    tags: new Set<string>(),
    status: 'active'
  };

  // Infer customer from path
  if (filePath.includes('Customers/Gartner')) {
    metadata.customer = 'gartner';
    metadata.tags.add('gartner');
  } else if (filePath.includes('Customers/Nasuni')) {
    metadata.customer = 'nasuni';
    metadata.tags.add('nasuni');
  } else if (filePath.includes('Customers/ThermoFisher')) {
    metadata.customer = 'thermofisher';
    metadata.tags.add('thermofisher');
  }

  // Infer project from path
  if (filePath.includes('Hyrule Project')) {
    metadata.project = 'hyrule';
    metadata.tags.add('hyrule');
  } else if (filePath.includes('Weekly Insights')) {
    metadata.project = 'weekly-insights';
  } else if (filePath.includes('Lucille')) {
    metadata.project = 'lucille';
    metadata.tags.add('lucille');
  }

  // Infer type from folder
  if (filePath.includes('Standups')) {
    metadata.type = 'standup';
    metadata.tags.add('standup');
  } else if (filePath.includes('Documentation') || filePath.includes('Docs')) {
    metadata.type = 'documentation';
    metadata.tags.add('docs');
  } else if (filePath.includes('Research')) {
    metadata.type = 'research';
    metadata.tags.add('research');
  } else if (filePath.includes('Governance')) {
    metadata.type = 'governance';
    metadata.tags.add('governance');
  } else if (filePath.includes('Working Sessions')) {
    metadata.type = 'working-session';
    metadata.tags.add('working-session');
  } else if (filePath.includes('Configs and Keys')) {
    metadata.type = 'config';
    metadata.tags.add('config');
  } else if (filePath.includes('Technical')) {
    metadata.type = 'technical';
    metadata.tags.add('technical');
  } else if (filePath.includes('Code references')) {
    metadata.type = 'code-reference';
    metadata.tags.add('code-ref');
  }

  // Extract date from filename (MMDDYYYY format)
  const dateMatch = fileName.match(/(\d{8})/);
  if (dateMatch) {
    const dateStr = dateMatch[1];
    // Assume MMDDYYYY format
    const month = dateStr.substring(0, 2);
    const day = dateStr.substring(2, 4);
    const year = dateStr.substring(4, 8);
    metadata.date = `${year}-${month}-${day}`;
  }

  return metadata;
}

function inferTagsFromContent(content: string, existingTags: Set<string>): string[] {
  const tags = new Set(existingTags);
  const contentLower = content.toLowerCase();

  // Technology tags
  if (contentLower.includes('opensearch')) tags.add('opensearch');
  if (contentLower.includes('lucille')) tags.add('lucille');
  if (contentLower.includes('kubernetes') || contentLower.includes('eks')) tags.add('kubernetes');
  if (contentLower.includes('aws') || contentLower.includes('sagemaker')) tags.add('aws');
  if (contentLower.includes('python')) tags.add('python');
  if (contentLower.includes('java')) tags.add('java');
  if (contentLower.includes('docker')) tags.add('docker');
  if (contentLower.includes('security') || contentLower.includes('cve-')) tags.add('security');
  if (contentLower.includes('architecture')) tags.add('architecture');
  if (contentLower.includes('hybrid') || contentLower.includes('bm25') || contentLower.includes('neural')) {
    tags.add('hybrid-search');
  }
  if (contentLower.includes('ltr') || contentLower.includes('learning to rank')) tags.add('ltr');
  if (contentLower.includes('relevancy') || contentLower.includes('relevance')) tags.add('relevancy');
  if (contentLower.includes('spellcheck') || contentLower.includes('fuzziness')) {
    tags.add('search-features');
  }

  return Array.from(tags).sort();
}

function parseFrontmatter(content: string): { frontmatter: any; body: string } | null {
  if (!content.startsWith('---')) {
    return null;
  }

  const match = content.match(/^---\n(.*?)\n---\n(.*)$/s);
  if (!match) {
    return null;
  }

  try {
    const frontmatter = yaml.load(match[1]) || {};
    const body = match[2];
    return { frontmatter, body };
  } catch {
    return null;
  }
}

function mergeFrontmatter(existing: any, inferred: InferredMetadata): any {
  const merged = { ...existing };

  // Only add fields that don't exist
  if (!merged.title) merged.title = inferred.title;
  if (!merged.date && inferred.date) merged.date = inferred.date;
  if (!merged.customer && inferred.customer) merged.customer = inferred.customer;
  if (!merged.project && inferred.project) merged.project = inferred.project;
  if (!merged.type && inferred.type) merged.type = inferred.type;
  if (!merged.status) merged.status = inferred.status;

  // Merge tags (combine existing with inferred)
  const existingTags = new Set(merged.tags || []);
  const inferredTags = new Set(inferred.tags);
  merged.tags = Array.from(new Set([...existingTags, ...inferredTags])).sort();

  return merged;
}

function fixMalformedDate(date: string, fileName: string): string {
  // Check if date looks malformed (starts with 0 and is in YYYY-MM-DD format)
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && date.startsWith('0')) {
    // Try to extract correct date from filename
    const dateMatch = fileName.match(/(\d{8})/);
    if (dateMatch) {
      const dateStr = dateMatch[1];
      const month = dateStr.substring(0, 2);
      const day = dateStr.substring(2, 4);
      const year = dateStr.substring(4, 8);
      const correctedDate = `${year}-${month}-${day}`;
      if (correctedDate !== date) {
        return correctedDate;
      }
    }
  }
  return date;
}

// Dynamic vault scanning function
async function scanVault(vaultPath: string): Promise<VaultStats> {
  const stats: VaultStats = {
    totalNotes: 0,
    folders: new Map<string, number>(),
    tags: new Map<string, number>(),
    properties: new Set<string>(),
  };

  async function scanDir(dir: string, depth: number = 0): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(vaultPath, fullPath);

      if (entry.isDirectory()) {
        // Track folder at first two levels
        if (depth < 2) {
          stats.folders.set(relativePath, 0);
        }
        await scanDir(fullPath, depth + 1);
      } else if (entry.name.endsWith('.md')) {
        stats.totalNotes++;

        // Count notes per folder (top level)
        const topFolder = relativePath.split(path.sep)[0];
        stats.folders.set(topFolder, (stats.folders.get(topFolder) || 0) + 1);

        // Parse frontmatter for tags and properties
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          const parsed = parseFrontmatter(content);
          if (parsed?.frontmatter) {
            // Track properties used
            Object.keys(parsed.frontmatter).forEach(key => stats.properties.add(key));

            // Count tags
            const tags = parsed.frontmatter.tags;
            if (Array.isArray(tags)) {
              tags.forEach((tag: string) => {
                stats.tags.set(tag, (stats.tags.get(tag) || 0) + 1);
              });
            }
          }
        } catch {
          // Skip files that can't be read
        }
      }
    }
  }

  await scanDir(vaultPath, 0);
  return stats;
}

// Parse TODO.md into structured items
function parseTodos(content: string): TodoItem[] {
  const todos: TodoItem[] = [];
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // Match: - [ ] or - [x] followed by optional tags and text
    const match = line.match(/^-\s*\[([ xX])\]\s*(.*)$/);
    if (match) {
      const completed = match[1].toLowerCase() === 'x';
      const rest = match[2];

      // Extract tags (words starting with #)
      const tagMatches = rest.match(/#\w+/g) || [];
      const tags = tagMatches.map(t => t.substring(1)); // Remove # prefix

      // Get text without tags
      const text = rest.replace(/#\w+\s*/g, '').trim();

      todos.push({
        id: todos.length + 1,
        text,
        completed,
        tags,
        line: index + 1, // 1-indexed line number
      });
    }
  });

  return todos;
}

// Initialize MCP server
const server = new McpServer({
  name: "slinky-do",
  version: "1.0.0",
  description: "Obsidian vault integration for KMW vault. Manages todos, creates notes with structured frontmatter (customer, project, type, status, tags), and searches 142+ notes across Customers (Gartner, Nasuni, ThermoFisher), Lucille project, and more. Use get_vault_info to explore vault structure and tagging system.",
});

// Tool: add_todo
server.tool(
  "add_todo",
  "Add a todo item to TODO.md. Common tags: #backlog, #waiting. Use tags to categorize and prioritize todos.",
  {
    text: z.string().min(1).describe("The todo text"),
    tags: z.array(z.string()).optional().describe("Tags like #backlog, #waiting to categorize and prioritize todos"),
  },
  async ({ text, tags }) => {
    try {
      // Read existing content
      let content = "";
      try {
        content = await fs.readFile(TODO_FILE, "utf-8");
      } catch {
        // File doesn't exist, start fresh
        content = "";
      }

      // Format the todo item
      const tagString = tags && tags.length > 0 ? " " + tags.join(" ") : "";
      const todoItem = `- [ ]${tagString} ${text}`;

      // Append to file
      const newContent = content.trim()
        ? content.trimEnd() + "\n" + todoItem + "\n"
        : todoItem + "\n";

      // Ensure directory exists
      await fs.mkdir(path.dirname(TODO_FILE), { recursive: true });
      await fs.writeFile(TODO_FILE, newContent, "utf-8");

      return {
        content: [
          {
            type: "text" as const,
            text: `Added todo: ${todoItem}\nFile: ${TODO_FILE}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error adding todo: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: create_note
server.tool(
  "create_note",
  "Create a new markdown note with YAML frontmatter. Available folders: Customers/Gartner, Customers/Nasuni, Customers/ThermoFisher, Lucille, Inbox. Properties: title, date, customer, project, type, status, tags. Use get_vault_info to see available tags and property values.",
  {
    title: z.string().min(1).describe("Note title"),
    content: z.string().describe("Note body content"),
    folder: z.string().optional().describe("Target folder (defaults to Inbox). Options: Inbox, Lucille, Customers/Gartner, Customers/Nasuni, Customers/ThermoFisher, or subfolders like Customers/Gartner/Technical"),
    tags: z.array(z.string()).optional().describe("Tags for frontmatter. Common tags: gartner, nasuni, thermofisher, hyrule, lucille, opensearch, aws, kubernetes, java, python, hybrid-search, relevancy. Use get_vault_info for full list."),
  },
  async ({ title, content, folder, tags }) => {
    try {
      const targetFolder = folder || DEFAULT_INBOX;
      const folderPath = path.join(VAULT_PATH, "KMW", targetFolder);

      // Validate path stays within vault
      const resolvedFolder = path.resolve(folderPath);
      const vaultBase = path.resolve(VAULT_PATH, "KMW");
      if (!resolvedFolder.startsWith(vaultBase + path.sep) && resolvedFolder !== vaultBase) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Folder path must be within the vault",
            },
          ],
          isError: true,
        };
      }

      // Generate filename from title
      const filename = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") + ".md";

      const filepath = path.join(folderPath, filename);

      // Create frontmatter
      const date = new Date().toISOString();
      const tagsArray = tags || [];
      const frontmatter = `---
title: "${title}"
date: ${date}
tags: [${tagsArray.map(t => `"${t}"`).join(", ")}]
---`;

      // Create full note content
      const noteContent = `${frontmatter}\n\n${content}\n`;

      // Ensure directory exists
      await fs.mkdir(folderPath, { recursive: true });

      // Check if file already exists
      try {
        await fs.access(filepath);
        return {
          content: [
            {
              type: "text" as const,
              text: `Note already exists: ${filename}\nLocation: ${filepath}\nChoose a different title or delete the existing note.`,
            },
          ],
          isError: true,
        };
      } catch {
        // File doesn't exist - proceed with creation
      }

      // Write file
      await fs.writeFile(filepath, noteContent, "utf-8");

      return {
        content: [
          {
            type: "text" as const,
            text: `Created note: ${filename}\nLocation: ${filepath}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating note: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: search_notes
server.tool(
  "search_notes",
  "Search across the Obsidian vault for matching content, filenames, and tags. The vault uses a comprehensive tagging system - use get_vault_info to see available tags and search patterns.",
  {
    query: z.string().min(1).describe("Search query"),
    limit: z.number().int().positive().max(50).optional().describe("Max results (default 10)"),
  },
  async ({ query, limit }) => {
    try {
      const maxResults = limit || 10;
      const searchPath = path.join(VAULT_PATH, "KMW");
      const results: Array<{ file: string; title: string; excerpt: string }> = [];
      const queryLower = query.toLowerCase();

      // Recursive function to search files
      async function searchDir(dir: string): Promise<void> {
        if (results.length >= maxResults) return;

        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (results.length >= maxResults) return;

          const fullPath = path.join(dir, entry.name);

          // Skip .obsidian folder
          if (entry.name.startsWith(".")) continue;

          if (entry.isDirectory()) {
            await searchDir(fullPath);
          } else if (entry.name.endsWith(".md")) {
            const content = await fs.readFile(fullPath, "utf-8");
            const relativePath = path.relative(searchPath, fullPath);

            // Check if query matches filename or content
            const matchesFilename = entry.name.toLowerCase().includes(queryLower);
            const matchesContent = content.toLowerCase().includes(queryLower);

            if (matchesFilename || matchesContent) {
              // Extract title from frontmatter or use filename
              const frontmatterMatch = content.match(/^---\n[\s\S]*?title:\s*"?([^"\n]+)"?\n[\s\S]*?---/);
              const title = frontmatterMatch ? frontmatterMatch[1] : entry.name.replace(".md", "");

              // Create excerpt around the match
              let excerpt = "";
              if (matchesContent) {
                const index = content.toLowerCase().indexOf(queryLower);
                const start = Math.max(0, index - 50);
                const end = Math.min(content.length, index + query.length + 50);
                excerpt = (start > 0 ? "..." : "") +
                          content.substring(start, end).replace(/\n/g, " ") +
                          (end < content.length ? "..." : "");
              } else {
                excerpt = content.substring(0, 100).replace(/\n/g, " ") + "...";
              }

              results.push({
                file: relativePath,
                title,
                excerpt,
              });
            }
          }
        }
      }

      await searchDir(searchPath);

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No notes found matching "${query}"`,
            },
          ],
        };
      }

      const resultText = results
        .map((r, i) => `${i + 1}. **${r.title}**\n   File: ${r.file}\n   ${r.excerpt}`)
        .join("\n\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${results.length} note(s) matching "${query}":\n\n${resultText}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error searching notes: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: get_vault_info (dynamic scanning)
server.tool(
  "get_vault_info",
  "Get real-time information about the vault structure, available tags, properties, and statistics by scanning the actual vault",
  {
    section: z.enum(["all", "tags", "properties", "folders", "stats"]).optional()
      .describe("Which section to return (defaults to 'all')")
  },
  async ({ section }) => {
    try {
      const infoSection = section || "all";
      const searchPath = path.join(VAULT_PATH, "KMW");

      // Scan the vault dynamically
      const stats = await scanVault(searchPath);

      let responseText = "";

      if (infoSection === "all" || infoSection === "folders") {
        responseText += "## Vault Structure\n\n";
        responseText += `Root: ${searchPath}\n`;
        responseText += `Total Notes: ${stats.totalNotes}\n\n`;

        responseText += "**Folders (with note counts):**\n";
        const sortedFolders = Array.from(stats.folders.entries())
          .filter(([_, count]) => count > 0)
          .sort((a, b) => b[1] - a[1]);
        sortedFolders.forEach(([folder, count]) => {
          responseText += `- ${folder}: ${count} notes\n`;
        });
        responseText += "\n";
      }

      if (infoSection === "all" || infoSection === "properties") {
        responseText += "## Properties Used\n\n";
        const sortedProps = Array.from(stats.properties).sort();
        sortedProps.forEach(prop => {
          responseText += `- ${prop}\n`;
        });
        responseText += "\n";
      }

      if (infoSection === "all" || infoSection === "tags") {
        responseText += "## Tags (by frequency)\n\n";
        const sortedTags = Array.from(stats.tags.entries())
          .sort((a, b) => b[1] - a[1]);

        // Group by count ranges
        const highFreq = sortedTags.filter(([_, c]) => c >= 20);
        const medFreq = sortedTags.filter(([_, c]) => c >= 5 && c < 20);
        const lowFreq = sortedTags.filter(([_, c]) => c < 5);

        if (highFreq.length > 0) {
          responseText += "**High frequency (20+):**\n";
          highFreq.forEach(([tag, count]) => {
            responseText += `- ${tag} (${count})\n`;
          });
          responseText += "\n";
        }

        if (medFreq.length > 0) {
          responseText += "**Medium frequency (5-19):**\n";
          medFreq.forEach(([tag, count]) => {
            responseText += `- ${tag} (${count})\n`;
          });
          responseText += "\n";
        }

        if (lowFreq.length > 0) {
          responseText += "**Low frequency (<5):**\n";
          lowFreq.forEach(([tag, count]) => {
            responseText += `- ${tag} (${count})\n`;
          });
          responseText += "\n";
        }
      }

      if (infoSection === "stats") {
        responseText += "## Vault Statistics\n\n";
        responseText += `- Total notes: ${stats.totalNotes}\n`;
        responseText += `- Unique tags: ${stats.tags.size}\n`;
        responseText += `- Properties tracked: ${stats.properties.size}\n`;
        responseText += `- Top-level folders: ${stats.folders.size}\n`;

        // Top 5 tags
        const topTags = Array.from(stats.tags.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        responseText += `\n**Top 5 Tags:**\n`;
        topTags.forEach(([tag, count]) => {
          responseText += `- ${tag}: ${count} notes\n`;
        });
      }

      return {
        content: [{
          type: "text" as const,
          text: responseText.trim()
        }]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error getting vault info: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: enrich_vault
server.tool(
  "enrich_vault",
  "Enrich all markdown files in the vault with intelligent YAML frontmatter, metadata, and tags inferred from folder structure and content. Merges with existing frontmatter without overwriting user edits.",
  {},
  async () => {
    try {
      const searchPath = path.join(VAULT_PATH, "KMW");
      let processed = 0;
      let enhanced = 0;
      let datesFixed = 0;
      const errors: string[] = [];

      // Recursive function to process files
      async function processDir(dir: string): Promise<void> {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // Skip .obsidian folder
          if (entry.name.startsWith('.')) continue;

          if (entry.isDirectory()) {
            await processDir(fullPath);
          } else if (entry.name.endsWith('.md')) {
            try {
              // Read file content
              const content = await fs.readFile(fullPath, 'utf-8');
              const relativePath = path.relative(searchPath, fullPath);

              // Infer metadata from path
              const inferred = inferMetadataFromPath(relativePath, entry.name);

              // Parse existing frontmatter
              const parsed = parseFrontmatter(content);
              const existingFm = parsed?.frontmatter || {};
              const body = parsed?.body || content;

              // Infer tags from content
              const contentTags = inferTagsFromContent(body, inferred.tags);
              inferred.tags = new Set(contentTags);

              // Merge frontmatter
              let mergedFm = mergeFrontmatter(existingFm, inferred);

              // Fix malformed dates
              if (mergedFm.date) {
                const originalDate = mergedFm.date;
                mergedFm.date = fixMalformedDate(mergedFm.date, entry.name);
                if (mergedFm.date !== originalDate) {
                  datesFixed++;
                }
              }

              // Generate YAML frontmatter
              const yamlStr = yaml.dump(mergedFm, { sortKeys: true, lineWidth: -1 });
              const newContent = `---\n${yamlStr}---\n\n${body}`;

              // Write file
              await fs.writeFile(fullPath, newContent, 'utf-8');

              processed++;
              if (!parsed) {
                enhanced++; // File didn't have frontmatter before
              }
            } catch (error) {
              errors.push(`${entry.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
        }
      }

      await processDir(searchPath);

      let summary = `## Vault Enrichment Complete\n\n`;
      summary += `- **Processed**: ${processed} markdown files\n`;
      summary += `- **Enhanced**: ${enhanced} files (added frontmatter)\n`;
      summary += `- **Dates Fixed**: ${datesFixed} malformed dates corrected\n`;

      if (errors.length > 0) {
        summary += `\n## Errors (${errors.length})\n\n`;
        summary += errors.slice(0, 10).map(e => `- ${e}`).join('\n');
        if (errors.length > 10) {
          summary += `\n- ... and ${errors.length - 10} more`;
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: summary
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: `Error enriching vault: ${error instanceof Error ? error.message : "Unknown error"}`
        }],
        isError: true
      };
    }
  }
);

// Tool: get_note
server.tool(
  "get_note",
  "Read a specific note from the vault, returning its content, frontmatter, and metadata",
  {
    path: z.string().min(1).describe("Relative path to the note within KMW folder (e.g., 'Inbox/my-note.md' or 'Customers/Gartner/Technical/config.md')"),
  },
  async ({ path: notePath }) => {
    try {
      const searchPath = path.join(VAULT_PATH, "KMW");
      const fullPath = path.join(searchPath, notePath);

      // Validate path stays within vault
      const resolvedPath = path.resolve(fullPath);
      if (!resolvedPath.startsWith(path.resolve(searchPath))) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: Path must be within the vault",
          }],
          isError: true,
        };
      }

      // Read file
      const content = await fs.readFile(fullPath, 'utf-8');
      const parsed = parseFrontmatter(content);

      // Get file stats
      const stats = await fs.stat(fullPath);

      let responseText = `## ${notePath}\n\n`;

      if (parsed?.frontmatter) {
        responseText += "### Frontmatter\n\n```yaml\n";
        responseText += yaml.dump(parsed.frontmatter, { sortKeys: true });
        responseText += "```\n\n";
        responseText += "### Content\n\n";
        responseText += parsed.body;
      } else {
        responseText += "### Content\n\n";
        responseText += content;
      }

      responseText += `\n\n---\n*Modified: ${stats.mtime.toISOString()}*`;

      return {
        content: [{
          type: "text" as const,
          text: responseText
        }]
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (message.includes('ENOENT')) {
        return {
          content: [{
            type: "text" as const,
            text: `Note not found: ${notePath}\n\nUse search_notes to find available notes.`,
          }],
          isError: true,
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: `Error reading note: ${message}`,
        }],
        isError: true,
      };
    }
  }
);

// Tool: list_todos
server.tool(
  "list_todos",
  "List all todo items from TODO.md with their status, tags, and IDs for use with complete_todo",
  {
    filter: z.enum(["all", "pending", "completed"]).optional()
      .describe("Filter todos by status (defaults to 'all')"),
    tag: z.string().optional()
      .describe("Filter by tag (without # prefix, e.g., 'backlog')"),
  },
  async ({ filter, tag }) => {
    try {
      const filterStatus = filter || "all";

      let content = "";
      try {
        content = await fs.readFile(TODO_FILE, "utf-8");
      } catch {
        return {
          content: [{
            type: "text" as const,
            text: "No TODO.md file found. Use add_todo to create your first todo.",
          }]
        };
      }

      let todos = parseTodos(content);

      // Apply filters
      if (filterStatus === "pending") {
        todos = todos.filter(t => !t.completed);
      } else if (filterStatus === "completed") {
        todos = todos.filter(t => t.completed);
      }

      if (tag) {
        todos = todos.filter(t => t.tags.includes(tag));
      }

      if (todos.length === 0) {
        let message = "No todos found";
        if (filterStatus !== "all" || tag) {
          message += ` matching filter: status=${filterStatus}`;
          if (tag) message += `, tag=${tag}`;
        }
        return {
          content: [{
            type: "text" as const,
            text: message,
          }]
        };
      }

      // Format output
      const pending = todos.filter(t => !t.completed);
      const completed = todos.filter(t => t.completed);

      let responseText = `## Todos (${todos.length} total)\n\n`;

      if (pending.length > 0 && filterStatus !== "completed") {
        responseText += `### Pending (${pending.length})\n\n`;
        pending.forEach(todo => {
          const tagStr = todo.tags.length > 0 ? ` [${todo.tags.map(t => `#${t}`).join(' ')}]` : '';
          responseText += `${todo.id}. [ ] ${todo.text}${tagStr}\n`;
        });
        responseText += "\n";
      }

      if (completed.length > 0 && filterStatus !== "pending") {
        responseText += `### Completed (${completed.length})\n\n`;
        completed.forEach(todo => {
          const tagStr = todo.tags.length > 0 ? ` [${todo.tags.map(t => `#${t}`).join(' ')}]` : '';
          responseText += `${todo.id}. [x] ${todo.text}${tagStr}\n`;
        });
      }

      responseText += `\n*Use complete_todo with the ID number to mark a todo as done.*`;

      return {
        content: [{
          type: "text" as const,
          text: responseText.trim()
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: `Error listing todos: ${error instanceof Error ? error.message : "Unknown error"}`,
        }],
        isError: true,
      };
    }
  }
);

// Tool: complete_todo
server.tool(
  "complete_todo",
  "Mark a todo item as completed by its ID (from list_todos) or by matching text",
  {
    id: z.number().int().positive().optional()
      .describe("The todo ID from list_todos"),
    text: z.string().optional()
      .describe("Partial text match to find the todo (case-insensitive)"),
  },
  async ({ id, text }) => {
    try {
      if (!id && !text) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: Provide either 'id' or 'text' to identify the todo to complete",
          }],
          isError: true,
        };
      }

      let content = "";
      try {
        content = await fs.readFile(TODO_FILE, "utf-8");
      } catch {
        return {
          content: [{
            type: "text" as const,
            text: "No TODO.md file found.",
          }],
          isError: true,
        };
      }

      const todos = parseTodos(content);
      let targetTodo: TodoItem | undefined;

      if (id) {
        targetTodo = todos.find(t => t.id === id);
        if (!targetTodo) {
          return {
            content: [{
              type: "text" as const,
              text: `No todo found with ID ${id}. Use list_todos to see available todos.`,
            }],
            isError: true,
          };
        }
      } else if (text) {
        const textLower = text.toLowerCase();
        const matches = todos.filter(t => t.text.toLowerCase().includes(textLower));
        if (matches.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: `No todo found matching "${text}". Use list_todos to see available todos.`,
            }],
            isError: true,
          };
        }
        if (matches.length > 1) {
          const matchList = matches.map(t => `${t.id}. ${t.text}`).join('\n');
          return {
            content: [{
              type: "text" as const,
              text: `Multiple todos match "${text}":\n\n${matchList}\n\nUse the specific ID to complete one.`,
            }],
            isError: true,
          };
        }
        targetTodo = matches[0];
      }

      if (!targetTodo) {
        return {
          content: [{
            type: "text" as const,
            text: "Could not find the specified todo.",
          }],
          isError: true,
        };
      }

      if (targetTodo.completed) {
        return {
          content: [{
            type: "text" as const,
            text: `Todo is already completed: "${targetTodo.text}"`,
          }]
        };
      }

      // Update the file
      const lines = content.split('\n');
      const lineIndex = targetTodo.line - 1; // Convert to 0-indexed

      // Replace [ ] with [x]
      lines[lineIndex] = lines[lineIndex].replace(/\[\s\]/, '[x]');

      await fs.writeFile(TODO_FILE, lines.join('\n'), 'utf-8');

      return {
        content: [{
          type: "text" as const,
          text: `Completed todo #${targetTodo.id}: "${targetTodo.text}"`,
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: `Error completing todo: ${error instanceof Error ? error.message : "Unknown error"}`,
        }],
        isError: true,
      };
    }
  }
);

// Main function
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[slinky-do] MCP server running on stdio");
}

main().catch((error) => {
  console.error("[slinky-do] Fatal error:", error);
  process.exit(1);
});
