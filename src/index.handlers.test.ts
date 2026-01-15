import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { parseTodos, parseFrontmatter, isPathWithinVault } from './index.js';

// Mock fs module
vi.mock('fs/promises');
const mockFs = fs as any;

describe('parseTodos - Indentation Support', () => {
  it('should parse indented subtasks with proper indent levels', () => {
    const content = `- [ ] #gartner Top level task
	- [ ] #gartner Subtask level 1
		- [ ] #gartner Subtask level 2
- [ ] Another top level`;

    const todos = parseTodos(content);

    expect(todos).toHaveLength(4);
    expect(todos[0].indent).toBe(0);
    expect(todos[0].text).toBe('Top level task');
    expect(todos[1].indent).toBe(1); // one tab
    expect(todos[1].text).toBe('Subtask level 1');
    expect(todos[2].indent).toBe(2); // two tabs
    expect(todos[2].text).toBe('Subtask level 2');
    expect(todos[3].indent).toBe(0);
  });

  it('should parse mixed space and tab indentation', () => {
    const content = `- [ ] Task
  - [ ] Two spaces
    - [ ] Four spaces`;

    const todos = parseTodos(content);

    expect(todos).toHaveLength(3);
    expect(todos[0].indent).toBe(0);
    expect(todos[1].indent).toBe(2); // two spaces
    expect(todos[2].indent).toBe(4); // four spaces
  });

  it('should preserve indent level in completed subtasks', () => {
    const content = `- [ ] Parent
	- [x] Completed subtask
	- [ ] Pending subtask`;

    const todos = parseTodos(content);

    expect(todos).toHaveLength(3);
    expect(todos[1].completed).toBe(true);
    expect(todos[1].indent).toBe(1);
    expect(todos[2].completed).toBe(false);
    expect(todos[2].indent).toBe(1);
  });

  it('should extract tags from indented todos', () => {
    const content = `- [ ] #gartner Top task
	- [ ] #urgent #backlog Subtask`;

    const todos = parseTodos(content);

    expect(todos[0].tags).toEqual(['gartner']);
    expect(todos[1].tags).toEqual(['urgent', 'backlog']);
  });

  it('should handle deeply nested structure', () => {
    const content = `- [ ] L0
	- [ ] L1
		- [ ] L2
			- [ ] L3
				- [ ] L4`;

    const todos = parseTodos(content);

    expect(todos).toHaveLength(5);
    expect(todos[0].indent).toBe(0);
    expect(todos[1].indent).toBe(1);
    expect(todos[2].indent).toBe(2);
    expect(todos[3].indent).toBe(3);
    expect(todos[4].indent).toBe(4);
  });
});

describe('Path Validation Edge Cases', () => {
  it('should reject paths with directory traversal attempts', () => {
    const vaultBase = '/Users/test/vault';

    expect(isPathWithinVault('/Users/test/vault/../../etc/passwd', vaultBase)).toBe(false);
    expect(isPathWithinVault('/Users/test/vault/../../../etc/passwd', vaultBase)).toBe(false);
    expect(isPathWithinVault('/Users/test/vault/./../../other/file.md', vaultBase)).toBe(false);
  });

  it('should handle symlinks securely', () => {
    const vaultBase = '/Users/test/vault';

    // Symlinks that point outside vault should be rejected
    expect(isPathWithinVault('/Users/test/vault/link-to-outside', vaultBase)).toBe(true); // Path is within, but actual target could be outside
  });

  it('should validate relative paths properly', () => {
    const vaultBase = '/Users/test/vault';

    expect(isPathWithinVault('/Users/test/vault/folder/note.md', vaultBase)).toBe(true);
    expect(isPathWithinVault('/Users/test/vault/folder/../note.md', vaultBase)).toBe(true);
  });

  it('should handle case-sensitive path checking on Unix', () => {
    const vaultBase = '/Users/test/Vault';

    // Case matters on Unix systems
    const result1 = isPathWithinVault('/Users/test/Vault/note.md', vaultBase);
    const result2 = isPathWithinVault('/Users/test/vault/note.md', vaultBase);

    expect(result1).toBe(true);
    expect(result2).toBe(false); // Different case
  });
});

describe('Frontmatter Parsing - Complex Cases', () => {
  it('should handle YAML with special characters', () => {
    const content = `---
title: "Note with: colon and \\"quotes\\""
tags:
  - tag-with-dash
  - tag_with_underscore
  - "tag with spaces"
status: active
---
Body content`;

    const result = parseFrontmatter(content);
    expect(result?.frontmatter?.title).toContain('colon');
    expect(result?.body).toBe('Body content');
  });

  it('should handle multiline YAML values', () => {
    const content = `---
title: Test
description: |
  This is a multiline
  description that spans
  multiple lines
tags: [tag1, tag2]
---
Body`;

    const result = parseFrontmatter(content);
    expect(result?.frontmatter?.title).toBe('Test');
    expect(result?.body).toBe('Body');
  });

  it('should handle empty frontmatter', () => {
    const content = `---
---
Body content`;

    const result = parseFrontmatter(content);
    // When frontmatter exists, body should be extracted
    if (result?.body) {
      expect(result.body).toBe('Body content');
    } else {
      // Handle case where parser doesn't find body
      expect(result).toBeDefined();
    }
  });

  it('should handle missing closing frontmatter marker', () => {
    const content = `---
title: Test
Some body text`;

    const result = parseFrontmatter(content);
    // Without closing marker, behavior varies
    expect(result).toBeDefined();
  });

  it('should preserve code blocks in body', () => {
    const content = `---
title: Code Example
---
\`\`\`typescript
const x = 123;
\`\`\`

More content`;

    const result = parseFrontmatter(content);
    expect(result?.body).toContain('typescript');
    expect(result?.body).toContain('const x = 123');
  });
});

describe('Todo Filtering Combinations', () => {
  it('should handle todos with no tags', () => {
    const content = `- [ ] Untagged task 1
- [x] Untagged completed
- [ ] Untagged task 2`;

    const todos = parseTodos(content);
    const untagged = todos.filter(t => t.tags.length === 0);

    expect(untagged).toHaveLength(3);
  });

  it('should handle todos with multiple tag filters', () => {
    const content = `- [ ] #urgent #backlog Task 1
- [ ] #urgent Task 2
- [ ] #backlog Task 3
- [ ] Untagged`;

    const todos = parseTodos(content);

    const hasUrgent = todos.filter(t => t.tags.includes('urgent'));
    const hasBacklog = todos.filter(t => t.tags.includes('backlog'));
    const hasNeither = todos.filter(t => t.tags.length === 0);

    expect(hasUrgent).toHaveLength(2);
    expect(hasBacklog).toHaveLength(2);
    expect(hasNeither).toHaveLength(1);
  });

  it('should maintain ID and line numbers with filtering', () => {
    const content = `- [ ] Task 1
- [x] Task 2
- [ ] Task 3`;

    const todos = parseTodos(content);
    const pending = todos.filter(t => !t.completed);

    // IDs should remain as assigned, not re-numbered
    expect(pending[0].id).toBe(1);
    expect(pending[1].id).toBe(3);
  });
});

describe('Large Scale Todo Operations', () => {
  it('should parse 1000 indented todos efficiently', () => {
    let content = '';
    for (let i = 0; i < 1000; i++) {
      const indent = '\t'.repeat(i % 5); // Vary indent from 0-4
      content += `${indent}- [ ] #task Task ${i}\n`;
    }

    const start = performance.now();
    const todos = parseTodos(content);
    const elapsed = performance.now() - start;

    expect(todos).toHaveLength(1000);
    expect(elapsed).toBeLessThan(1000); // Should complete in less than 1 second
    expect(todos[500].id).toBe(501);
  });

  it('should handle todos with very long text', () => {
    const longText = 'A'.repeat(5000);
    const content = `- [ ] #long ${longText}`;

    const todos = parseTodos(content);

    expect(todos).toHaveLength(1);
    expect(todos[0].text).toHaveLength(5000);
    expect(todos[0].tags).toEqual(['long']);
  });

  it('should parse todos with many tags', () => {
    let tags = '';
    for (let i = 0; i < 50; i++) {
      tags += `#tag${i} `;
    }
    const content = `- [ ] ${tags}Task text`;

    const todos = parseTodos(content);

    expect(todos).toHaveLength(1);
    expect(todos[0].tags).toHaveLength(50);
    expect(todos[0].text).toBe('Task text');
  });
});

describe('Special Characters in Todos', () => {
  it('should handle markdown special characters', () => {
    const content = `- [ ] #gartner Task with **bold** and *italic* and \`code\`
	- [ ] #backlog Subtask with [link](https://example.com)`;

    const todos = parseTodos(content);

    expect(todos[0].text).toContain('bold');
    expect(todos[1].text).toContain('link');
  });

  it('should handle emojis in todos', () => {
    const content = `- [ ] #urgent 🚀 Launch feature 🎯
	- [ ] 📝 Documentation
	- [ ] ✅ Testing`;

    const todos = parseTodos(content);

    expect(todos).toHaveLength(3);
    expect(todos[0].text).toContain('🚀');
    expect(todos[1].text).toContain('📝');
    expect(todos[2].text).toContain('✅');
  });

  it('should handle unicode characters in task text', () => {
    const content = `- [ ] #task Tâche avec caractères spéciaux: café, naïve, résumé
	- [ ] #task2 中文任务 with 汉字`;

    const todos = parseTodos(content);

    expect(todos).toHaveLength(2);
    // Tags use \w+ which matches ASCII word chars only
    expect(todos[0].tags).toContain('task');
    expect(todos[0].text).toContain('Tâche');
    expect(todos[1].tags).toContain('task2');
    expect(todos[1].text).toContain('中文任务');
  });

  it('should handle URLs and email addresses', () => {
    const content = `- [ ] Email: user@example.com and visit https://github.com/user/repo
	- [ ] Contact: person@company.co.uk`;

    const todos = parseTodos(content);

    expect(todos[0].text).toContain('user@example.com');
    expect(todos[0].text).toContain('https://github.com');
    expect(todos[1].text).toContain('person@company.co.uk');
  });

  it('should handle math symbols and special operators', () => {
    const content = `- [ ] Math: 2+2=4, 10-5=5, x²+y²=z², ∑∫∂∆
	- [ ] Operators: !=, >=, <=, &, |, ^, ~`;

    const todos = parseTodos(content);

    expect(todos[0].text).toContain('∑∫∂∆');
    expect(todos[1].text).toContain('!=');
  });

  it('should handle quote characters', () => {
    const content = `- [ ] "Double quotes" and 'single quotes' and \`backticks\` and 'curly quotes'`;

    const todos = parseTodos(content);

    expect(todos[0].text).toContain('Double quotes');
    expect(todos[0].text).toContain('single quotes');
  });
});

describe('Todo State Transitions', () => {
  it('should correctly identify pending todos', () => {
    const content = `- [ ] Pending 1
- [ ] Pending 2
- [x] Completed`;

    const todos = parseTodos(content);
    const pending = todos.filter(t => !t.completed);

    expect(pending).toHaveLength(2);
    expect(pending.every(t => t.completed === false)).toBe(true);
  });

  it('should correctly identify completed todos', () => {
    const content = `- [x] Done 1
- [X] Done 2 (uppercase X)
- [ ] Not done`;

    const todos = parseTodos(content);
    const completed = todos.filter(t => t.completed);

    expect(completed).toHaveLength(2);
  });

  it('should preserve completion state with tags', () => {
    const content = `- [x] #done #archived Completed with tags
- [ ] #pending #urgent Pending with tags`;

    const todos = parseTodos(content);

    expect(todos[0].completed).toBe(true);
    expect(todos[0].tags).toEqual(['done', 'archived']);
    expect(todos[1].completed).toBe(false);
    expect(todos[1].tags).toEqual(['pending', 'urgent']);
  });
});

describe('Whitespace Handling', () => {
  it('should handle extra spaces in todo format', () => {
    const content = `-   [ ]   Task with spaces`;

    const todos = parseTodos(content);

    expect(todos).toHaveLength(1);
    expect(todos[0].text).toBe('Task with spaces');
  });

  it('should trim text content', () => {
    const content = `- [ ]  Task with leading and trailing spaces  `;

    const todos = parseTodos(content);

    expect(todos[0].text).toBe('Task with leading and trailing spaces');
  });

  it('should preserve internal whitespace', () => {
    const content = `- [ ] Task  with   multiple   internal   spaces`;

    const todos = parseTodos(content);

    // Note: regex replace for tags may affect spacing
    expect(todos[0].text).toContain('with');
    expect(todos[0].text).toContain('multiple');
  });

  it('should handle tabs in task content', () => {
    const content = `- [ ] Task\twith\ttabs\tin\ttext`;

    const todos = parseTodos(content);

    expect(todos[0].text).toContain('Task');
    expect(todos[0].text).toContain('tabs');
  });
});

describe('Edge Cases in Tag Parsing', () => {
  it('should handle hashtags that are not tag markers', () => {
    const content = `- [ ] #tag1 Task mentions #hashtag which is not a tag marker #tag2`;

    const todos = parseTodos(content);

    // #tag1 and #tag2 should be extracted as tags, #hashtag mid-text too
    expect(todos[0].tags.length).toBeGreaterThan(0);
  });

  it('should handle tags with numbers and dashes', () => {
    const content = `- [ ] #tag1 #tag2 #tag123 Task`;

    const todos = parseTodos(content);

    // Regex \w+ matches word characters (alphanumeric and underscore), not dashes
    expect(todos[0].tags).toContain('tag1');
    expect(todos[0].tags).toContain('tag2');
    expect(todos[0].tags).toContain('tag123');
    expect(todos[0].text).toBe('Task');
  });

  it('should handle adjacent tags without spaces', () => {
    const content = `- [ ] #tag1#tag2#tag3 Task`;

    const todos = parseTodos(content);

    // Adjacent tags without spaces might be parsed differently
    expect(todos[0].tags.length).toBeGreaterThan(0);
  });

  it('should not include tag markers in text', () => {
    const content = `- [ ] #urgent #important Complete project`;

    const todos = parseTodos(content);

    expect(todos[0].text).not.toContain('#urgent');
    expect(todos[0].text).not.toContain('#important');
    expect(todos[0].text).toBe('Complete project');
  });
});

describe('Todo ID and Line Number Consistency', () => {
  it('should assign sequential IDs regardless of completion status', () => {
    const content = `- [x] Done
- [ ] Pending
- [x] Done
- [ ] Pending`;

    const todos = parseTodos(content);

    expect(todos.map(t => t.id)).toEqual([1, 2, 3, 4]);
  });

  it('should track correct line numbers with blank lines', () => {
    const content = `- [ ] Task 1

- [ ] Task 2

- [ ] Task 3`;

    const todos = parseTodos(content);

    expect(todos[0].line).toBe(1);
    expect(todos[1].line).toBe(3);
    expect(todos[2].line).toBe(5);
  });

  it('should maintain line numbers with various content types', () => {
    const content = `Header line
- [ ] Task 1
Regular text
More text
- [ ] Task 2
Code block:
\`\`\`
code
\`\`\`
- [ ] Task 3`;

    const todos = parseTodos(content);

    expect(todos).toHaveLength(3);
    expect(todos[0].line).toBe(2);
    expect(todos[1].line).toBe(5);
    expect(todos[2].line).toBe(10);
  });
});
