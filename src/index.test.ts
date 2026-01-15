import { describe, it, expect } from 'vitest';
import {
  parseTodos,
  parseFrontmatter,
  fixMalformedDate,
  isPathWithinVault,
  getTimeAgo,
  getNoteNameFromPath,
  extractWikilinks,
} from './index.js';

// Tests for parseTodos

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

// Tests for parseFrontmatter

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
    // js-yaml parses dates as Date objects
    expect(result?.frontmatter.date).toBeInstanceOf(Date);
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

  it('should handle frontmatter with no body content', () => {
    const content = `---
title: Empty Note
---
`;
    const result = parseFrontmatter(content);

    expect(result).not.toBeNull();
    expect(result?.frontmatter.title).toBe('Empty Note');
    expect(result?.body.trim()).toBe('');
  });
});

// Tests for fixMalformedDate

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

// Tests for isPathWithinVault

describe('isPathWithinVault', () => {
  const vaultBase = '/Users/kevin/vault/KMW';

  it('should accept paths within the vault', () => {
    expect(isPathWithinVault('/Users/kevin/vault/KMW/notes.md', vaultBase)).toBe(true);
    expect(isPathWithinVault('/Users/kevin/vault/KMW/Customers/Gartner/file.md', vaultBase)).toBe(true);
  });

  it('should accept the vault base path itself', () => {
    expect(isPathWithinVault('/Users/kevin/vault/KMW', vaultBase)).toBe(true);
  });

  it('should reject paths outside the vault', () => {
    expect(isPathWithinVault('/Users/kevin/vault/other/file.md', vaultBase)).toBe(false);
    expect(isPathWithinVault('/etc/passwd', vaultBase)).toBe(false);
  });

  it('should reject path traversal attempts', () => {
    expect(isPathWithinVault('/Users/kevin/vault/KMW/../../../etc/passwd', vaultBase)).toBe(false);
  });

  it('should reject paths that start with vault name but are different', () => {
    // This is the security fix - KMW-evil should not pass
    expect(isPathWithinVault('/Users/kevin/vault/KMW-evil/file.md', vaultBase)).toBe(false);
  });
});

// Tests for filename generation

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

// Tests for getTimeAgo

describe('getTimeAgo', () => {
  it('should return "just now" for very recent times', () => {
    const now = new Date();
    expect(getTimeAgo(now)).toBe('just now');
  });

  it('should return minutes ago', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(getTimeAgo(fiveMinutesAgo)).toBe('5 minutes ago');
  });

  it('should return singular minute', () => {
    const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);
    expect(getTimeAgo(oneMinuteAgo)).toBe('1 minute ago');
  });

  it('should return hours ago', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(getTimeAgo(threeHoursAgo)).toBe('3 hours ago');
  });

  it('should return yesterday', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(getTimeAgo(yesterday)).toBe('yesterday');
  });

  it('should return days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(getTimeAgo(threeDaysAgo)).toBe('3 days ago');
  });

  it('should return weeks ago', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    expect(getTimeAgo(twoWeeksAgo)).toBe('2 weeks ago');
  });
});

// Tests for getNoteNameFromPath

describe('getNoteNameFromPath', () => {
  it('should extract note name from simple filename', () => {
    expect(getNoteNameFromPath('my-note.md')).toBe('my-note');
  });

  it('should extract note name from path with folders', () => {
    expect(getNoteNameFromPath('Customers/Gartner/meeting-notes.md')).toBe('meeting-notes');
  });

  it('should handle path without extension', () => {
    expect(getNoteNameFromPath('my-note')).toBe('my-note');
  });

  it('should handle nested paths', () => {
    expect(getNoteNameFromPath('a/b/c/deep-note.md')).toBe('deep-note');
  });
});

// Tests for extractWikilinks

describe('extractWikilinks', () => {
  it('should extract simple wikilinks', () => {
    const content = 'Check out [[my-note]] for more info.';
    expect(extractWikilinks(content)).toEqual(['my-note']);
  });

  it('should extract multiple wikilinks', () => {
    const content = 'See [[note-1]] and [[note-2]] and [[note-3]].';
    expect(extractWikilinks(content)).toEqual(['note-1', 'note-2', 'note-3']);
  });

  it('should handle wikilinks with aliases', () => {
    const content = 'Check out [[my-note|My Custom Title]] for info.';
    expect(extractWikilinks(content)).toEqual(['my-note']);
  });

  it('should handle wikilinks with paths', () => {
    const content = 'See [[Customers/Gartner/meeting]] for details.';
    expect(extractWikilinks(content)).toEqual(['Customers/Gartner/meeting']);
  });

  it('should return empty array when no wikilinks', () => {
    const content = 'Just plain text with no links.';
    expect(extractWikilinks(content)).toEqual([]);
  });

  it('should handle mixed wikilinks with and without aliases', () => {
    const content = '[[note-1]] and [[note-2|Alias]] and [[folder/note-3]]';
    expect(extractWikilinks(content)).toEqual(['note-1', 'note-2', 'folder/note-3']);
  });
});
