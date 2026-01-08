#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

// Configuration
const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH ||
  "/Users/kevin/Library/Mobile Documents/iCloud~md~obsidian/Documents/KMW";
const TODO_FILE = path.join(VAULT_PATH, "KMW/TODO.md");
const DEFAULT_INBOX = "Inbox";

// Initialize MCP server
const server = new McpServer({
  name: "slinky-do",
  version: "1.0.0",
});

// Tool: add_todo
server.tool(
  "add_todo",
  "Add a todo item to TODO.md",
  {
    text: z.string().min(1).describe("The todo text"),
    tags: z.array(z.string()).optional().describe("Tags like #backlog, #waiting"),
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
      const newContent = content.trimEnd() + "\n" + todoItem + "\n";

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
  "Create a new markdown note with YAML frontmatter",
  {
    title: z.string().min(1).describe("Note title"),
    content: z.string().describe("Note body content"),
    folder: z.string().optional().describe("Target folder (defaults to Inbox)"),
    tags: z.array(z.string()).optional().describe("Tags for frontmatter"),
  },
  async ({ title, content, folder, tags }) => {
    try {
      const targetFolder = folder || DEFAULT_INBOX;
      const folderPath = path.join(VAULT_PATH, "KMW", targetFolder);

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
  "Search across the Obsidian vault for matching content",
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
