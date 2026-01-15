import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';

// Mock fs module
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
    stat: vi.fn(),
    readdir: vi.fn(),
    rename: vi.fn(),
    unlink: vi.fn(),
  },
}));

describe('Integration Tests - File Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseTodos with file operations', () => {
    it('should handle large todo files', async () => {
      // Generate a large todo file with 1000 items
      let largeContent = '';
      for (let i = 1; i <= 1000; i++) {
        largeContent += `- [ ] #task Todo item ${i}\n`;
      }

      // Import parseTodos from the module
      const { parseTodos } = await import('./index.js');
      const todos = parseTodos(largeContent);

      expect(todos).toHaveLength(1000);
      expect(todos[0].id).toBe(1);
      expect(todos[999].id).toBe(1000);
      expect(todos.every(t => t.tags.includes('task'))).toBe(true);
    });

    it('should handle mixed content with non-todo lines', async () => {
      const content = `## Header
Some description text here

- [ ] First real todo
Not a todo line
- [ ] #important Second todo

Another paragraph
- [x] Completed todo`;

      const { parseTodos } = await import('./index.js');
      const todos = parseTodos(content);

      expect(todos).toHaveLength(3);
      expect(todos.filter(t => !t.completed)).toHaveLength(2);
      expect(todos.filter(t => t.completed)).toHaveLength(1);
    });
  });

  describe('Frontmatter handling with edge cases', () => {
    it('should handle YAML with arrays', async () => {
      const { parseFrontmatter } = await import('./index.js');

      const content = `---
title: Test Note
tags:
  - tag-with-dash
  - tag_with_underscore
---
Body`;

      const result = parseFrontmatter(content);
      expect(result?.frontmatter?.title).toBe('Test Note');
      expect(result?.frontmatter?.tags).toHaveLength(2);
    });

    it('should preserve whitespace in body content', async () => {
      const { parseFrontmatter } = await import('./index.js');
      
      const content = `---
title: "Test"
---
First line
  Indented line
    More indent

Last line with trailing spaces   `;

      const result = parseFrontmatter(content);
      expect(result?.body).toContain('First line');
      expect(result?.body).toContain('Indented line');
    });
  });

  describe('Tag inference at scale', () => {
    it('should handle documents with many technology mentions', async () => {
      const { inferTagsFromContent } = await import('./index.js');
      
      const content = `
This project uses:
- OpenSearch for search infrastructure
- Kubernetes for orchestration on EKS
- Python and Java for services
- Docker containers
- AWS for cloud infrastructure
- LTR for learning to rank
- BM25 and neural networks for hybrid search
- CVE scanning for security
      `;

      const tags = inferTagsFromContent(content, new Set());
      
      expect(tags).toContain('opensearch');
      expect(tags).toContain('kubernetes');
      expect(tags).toContain('python');
      expect(tags).toContain('java');
      expect(tags).toContain('docker');
      expect(tags).toContain('aws');
      expect(tags).toContain('ltr');
      expect(tags).toContain('hybrid-search');
      expect(tags).toContain('security');
    });
  });

  describe('Path validation at scale', () => {
    it('should validate many paths efficiently', async () => {
      const { isPathWithinVault } = await import('./index.js');
      
      const vaultBase = '/Users/test/vault';
      const validPaths = [
        '/Users/test/vault/note.md',
        '/Users/test/vault/folder/note.md',
        '/Users/test/vault/deep/nested/path/note.md',
      ];
      const invalidPaths = [
        '/Users/test/other/note.md',
        '/Users/different/vault/note.md',
        '/etc/passwd',
      ];

      for (const path of validPaths) {
        expect(isPathWithinVault(path, vaultBase)).toBe(true);
      }

      for (const path of invalidPaths) {
        expect(isPathWithinVault(path, vaultBase)).toBe(false);
      }
    });
  });

  describe('Metadata inference combinations', () => {
    it('should handle all customer/project combinations', async () => {
      const { inferMetadataFromPath } = await import('./index.js');

      const testCases = [
        { path: 'Customers/Gartner/note.md', customer: 'gartner' },
        { path: 'Customers/Nasuni/Hyrule Project/note.md', customer: 'nasuni', project: 'hyrule' },
        { path: 'Customers/ThermoFisher/note.md', customer: 'thermofisher' },
        { path: 'Lucille/note.md', project: 'lucille' },
      ];

      for (const testCase of testCases) {
        const metadata = inferMetadataFromPath(testCase.path, 'note.md');
        if (testCase.customer) {
          expect(metadata.customer).toBe(testCase.customer);
        }
        if (testCase.project) {
          expect(metadata.project).toBe(testCase.project);
        }
      }
    });
  });
});
