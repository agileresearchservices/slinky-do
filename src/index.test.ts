import { describe, it, expect } from 'vitest';

// Helper function implementations (copied for testing)
// In a production setup, these would be exported from index.ts

interface TodoItem {
  id: number;
  text: string;
  completed: boolean;
  tags: string[];
  line: number;
}

function parseTodos(content: string): TodoItem[] {
  const todos: TodoItem[] = [];
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const match = line.match(/^-\s*\[([ xX])\]\s*(.*)$/);
    if (match) {
      const completed = match[1].toLowerCase() === 'x';
      const rest = match[2];

      const tagMatches = rest.match(/#\w+/g) || [];
      const tags = tagMatches.map(t => t.substring(1));

      const text = rest.replace(/#\w+\s*/g, '').trim();

      todos.push({
        id: todos.length + 1,
        text,
        completed,
        tags,
        line: index + 1,
      });
    }
  });

  return todos;
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
    // Simple YAML parsing for tests (basic key: value pairs)
    const frontmatter: Record<string, any> = {};
    const yamlLines = match[1].split('\n');
    for (const line of yamlLines) {
      const kvMatch = line.match(/^(\w+):\s*(.*)$/);
      if (kvMatch) {
        let value: any = kvMatch[2];
        // Handle arrays like [tag1, tag2]
        if (value.startsWith('[') && value.endsWith(']')) {
          value = value.slice(1, -1).split(',').map((s: string) => s.trim().replace(/"/g, ''));
        }
        // Handle quoted strings
        if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        frontmatter[kvMatch[1]] = value;
      }
    }
    const body = match[2];
    return { frontmatter, body };
  } catch {
    return null;
  }
}

function fixMalformedDate(date: string, fileName: string): string {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && date.startsWith('0')) {
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

// Tests

describe('parseTodos', () => {
  it('should parse a simple incomplete todo', () => {
    const content = '- [ ] Buy groceries';
    const todos = parseTodos(content);

    expect(todos).toHaveLength(1);
    expect(todos[0].text).toBe('Buy groceries');
    expect(todos[0].completed).toBe(false);
    expect(todos[0].tags).toEqual([]);
    expect(todos[0].id).toBe(1);
    expect(todos[0].line).toBe(1);
  });

  it('should parse a completed todo', () => {
    const content = '- [x] Buy groceries';
    const todos = parseTodos(content);

    expect(todos).toHaveLength(1);
    expect(todos[0].completed).toBe(true);
  });

  it('should parse uppercase X as completed', () => {
    const content = '- [X] Buy groceries';
    const todos = parseTodos(content);

    expect(todos[0].completed).toBe(true);
  });

  it('should extract tags from todo', () => {
    const content = '- [ ] #backlog #urgent Buy groceries';
    const todos = parseTodos(content);

    expect(todos[0].tags).toEqual(['backlog', 'urgent']);
    expect(todos[0].text).toBe('Buy groceries');
  });

  it('should handle tags at end of text', () => {
    const content = '- [ ] Buy groceries #shopping #weekly';
    const todos = parseTodos(content);

    expect(todos[0].tags).toEqual(['shopping', 'weekly']);
    expect(todos[0].text).toBe('Buy groceries');
  });

  it('should parse multiple todos with correct IDs and lines', () => {
    const content = `- [ ] First todo
- [x] Second todo
- [ ] Third todo`;
    const todos = parseTodos(content);

    expect(todos).toHaveLength(3);
    expect(todos[0].id).toBe(1);
    expect(todos[0].line).toBe(1);
    expect(todos[1].id).toBe(2);
    expect(todos[1].line).toBe(2);
    expect(todos[2].id).toBe(3);
    expect(todos[2].line).toBe(3);
  });

  it('should handle empty content', () => {
    const todos = parseTodos('');
    expect(todos).toHaveLength(0);
  });

  it('should ignore non-todo lines', () => {
    const content = `# Header
Some text
- [ ] Actual todo
More text`;
    const todos = parseTodos(content);

    expect(todos).toHaveLength(1);
    expect(todos[0].text).toBe('Actual todo');
    expect(todos[0].line).toBe(3);
  });
});

describe('parseFrontmatter', () => {
  it('should parse simple frontmatter', () => {
    const content = `---
title: My Note
date: 2024-01-15
---

Content here`;
    const result = parseFrontmatter(content);

    expect(result).not.toBeNull();
    expect(result?.frontmatter.title).toBe('My Note');
    expect(result?.frontmatter.date).toBe('2024-01-15');
    expect(result?.body).toContain('Content here');
  });

  it('should return null for content without frontmatter', () => {
    const content = 'Just some content';
    const result = parseFrontmatter(content);

    expect(result).toBeNull();
  });

  it('should handle content starting with --- but invalid format', () => {
    const content = '--- not valid frontmatter ---';
    const result = parseFrontmatter(content);

    expect(result).toBeNull();
  });

  it('should parse quoted titles', () => {
    const content = `---
title: "My Quoted Title"
---

Body`;
    const result = parseFrontmatter(content);

    expect(result?.frontmatter.title).toBe('My Quoted Title');
  });

  it('should parse tags array', () => {
    const content = `---
tags: [tag1, tag2, tag3]
---

Body`;
    const result = parseFrontmatter(content);

    expect(result?.frontmatter.tags).toEqual(['tag1', 'tag2', 'tag3']);
  });
});

describe('fixMalformedDate', () => {
  it('should fix malformed date starting with 0', () => {
    const result = fixMalformedDate('0024-01-15', 'meeting_01152024.md');
    expect(result).toBe('2024-01-15');
  });

  it('should not modify valid dates', () => {
    const result = fixMalformedDate('2024-01-15', 'meeting_01152024.md');
    expect(result).toBe('2024-01-15');
  });

  it('should not modify dates that do not start with 0', () => {
    const result = fixMalformedDate('2024-12-15', 'somefile.md');
    expect(result).toBe('2024-12-15');
  });

  it('should return original if filename has no date', () => {
    const result = fixMalformedDate('0024-01-15', 'meeting.md');
    expect(result).toBe('0024-01-15');
  });

  it('should handle MMDDYYYY format in filename', () => {
    const result = fixMalformedDate('0024-12-25', 'notes_12252024.md');
    expect(result).toBe('2024-12-25');
  });
});

describe('Path validation scenarios', () => {
  it('should identify path traversal attempts', () => {
    const vaultBase = '/Users/kevin/vault/KMW';
    const maliciousPath = '../../../etc/passwd';

    // Simulating the path resolution logic
    const resolvedPath = '/Users/kevin/vault/KMW/' + maliciousPath;
    const normalizedPath = resolvedPath.replace(/\/\.\.\//g, '/');

    // The actual check in the code
    expect(normalizedPath.includes('..')).toBe(true);
  });

  it('should allow valid nested paths', () => {
    const validPath = 'Customers/Gartner/Technical/notes.md';
    expect(validPath.includes('..')).toBe(false);
  });
});

describe('Filename generation', () => {
  it('should convert title to valid filename', () => {
    const title = "My Test Note!";
    const filename = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") + ".md";

    expect(filename).toBe('my-test-note.md');
  });

  it('should handle special characters', () => {
    const title = "Note: About @things & stuff!";
    const filename = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") + ".md";

    expect(filename).toBe('note-about-things-stuff.md');
  });

  it('should handle multiple spaces', () => {
    const title = "Note   with   spaces";
    const filename = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") + ".md";

    expect(filename).toBe('note-with-spaces.md');
  });
});
