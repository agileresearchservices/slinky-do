import { describe, it, expect } from 'vitest';
import {
  parseTodos,
  parseFrontmatter,
  fixMalformedDate,
  isPathWithinVault,
  getTimeAgo,
  getNoteNameFromPath,
  extractWikilinks,
  inferMetadataFromPath,
  inferTagsFromContent,
  mergeFrontmatter,
} from './index.js';
import type { InferredMetadata } from './index.js';

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

  it('should handle todo with only tags (no text)', () => {
    const content = '- [ ] #urgent #important';
    const todos = parseTodos(content);

    expect(todos).toHaveLength(1);
    expect(todos[0].tags).toEqual(['urgent', 'important']);
    expect(todos[0].text).toBe('');
  });

  it('should handle todos with special characters in text', () => {
    const content = '- [ ] Fix bug: "undefined" error in API (critical!)';
    const todos = parseTodos(content);

    expect(todos).toHaveLength(1);
    expect(todos[0].text).toBe('Fix bug: "undefined" error in API (critical!)');
  });

  it('should handle duplicate tags', () => {
    const content = '- [ ] #urgent Task #urgent';
    const todos = parseTodos(content);

    expect(todos).toHaveLength(1);
    // Tags are extracted as-is, duplicates included
    expect(todos[0].tags).toContain('urgent');
  });

  it('should handle todo with mixed whitespace', () => {
    const content = '-  [x]   #tag    Some  task  ';
    const todos = parseTodos(content);

    expect(todos).toHaveLength(1);
    expect(todos[0].completed).toBe(true);
    expect(todos[0].tags).toEqual(['tag']);
  });

  it('should handle content with only whitespace', () => {
    const todos = parseTodos('   \n\n  \n');
    expect(todos).toHaveLength(0);
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

  it('should parse nested objects in frontmatter', () => {
    const content = `---
title: Note with nested
metadata:
  author: Kevin
  version: 1.0
---

Content`;
    const result = parseFrontmatter(content);

    expect(result?.frontmatter.metadata).toEqual({ author: 'Kevin', version: 1.0 });
  });

  it('should parse boolean values in frontmatter', () => {
    const content = `---
title: Note
published: true
draft: false
---

Content`;
    const result = parseFrontmatter(content);

    expect(result?.frontmatter.published).toBe(true);
    expect(result?.frontmatter.draft).toBe(false);
  });

  it('should parse numbers in frontmatter', () => {
    const content = `---
title: Note
count: 42
price: 19.99
---

Content`;
    const result = parseFrontmatter(content);

    expect(result?.frontmatter.count).toBe(42);
    expect(result?.frontmatter.price).toBe(19.99);
  });

  it('should handle minimal frontmatter with blank line', () => {
    const content = `---

---

Content here`;
    const result = parseFrontmatter(content);

    expect(result).not.toBeNull();
    expect(result?.frontmatter).toEqual({});
    expect(result?.body).toContain('Content here');
  });

  it('should return null for empty frontmatter without newline', () => {
    // Regex requires at least one newline between --- markers
    const content = `---
---

Content here`;
    const result = parseFrontmatter(content);

    expect(result).toBeNull();
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

  it('should return singular hour', () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
    expect(getTimeAgo(oneHourAgo)).toBe('1 hour ago');
  });

  it('should return singular week', () => {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    expect(getTimeAgo(oneWeekAgo)).toBe('1 week ago');
  });

  it('should return formatted date for months ago', () => {
    const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    // Returns toLocaleDateString, so just check it's not a relative time
    const result = getTimeAgo(twoMonthsAgo);
    expect(result).not.toContain('ago');
    expect(result).not.toBe('yesterday');
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

  it('should handle empty content', () => {
    expect(extractWikilinks('')).toEqual([]);
  });

  it('should handle wikilinks with spaces in name', () => {
    const content = 'See [[Meeting Notes]] for details.';
    expect(extractWikilinks(content)).toEqual(['Meeting Notes']);
  });

  it('should handle wikilinks on same line', () => {
    const content = '[[note-1]][[note-2]][[note-3]]';
    expect(extractWikilinks(content)).toEqual(['note-1', 'note-2', 'note-3']);
  });

  it('should handle wikilinks with special characters', () => {
    const content = 'See [[2024-01-15 Meeting]] and [[Q1 Report (Draft)]].';
    expect(extractWikilinks(content)).toEqual(['2024-01-15 Meeting', 'Q1 Report (Draft)']);
  });

  it('should handle incomplete wikilinks gracefully', () => {
    const content = 'Text with [[valid-link]] and incomplete [[ and [[';
    expect(extractWikilinks(content)).toEqual(['valid-link']);
  });
});

// Tests for inferMetadataFromPath

describe('inferMetadataFromPath', () => {
  it('should extract title from filename', () => {
    const result = inferMetadataFromPath('/vault/notes.md', 'notes.md');
    expect(result.title).toBe('notes');
  });

  it('should replace underscores with spaces in title', () => {
    const result = inferMetadataFromPath('/vault/my_test_note.md', 'my_test_note.md');
    expect(result.title).toBe('my test note');
  });

  it('should set default status to active', () => {
    const result = inferMetadataFromPath('/vault/notes.md', 'notes.md');
    expect(result.status).toBe('active');
  });

  it('should infer customer from Gartner path', () => {
    const result = inferMetadataFromPath('/vault/Customers/Gartner/meeting.md', 'meeting.md');
    expect(result.customer).toBe('gartner');
    expect(result.tags.has('gartner')).toBe(true);
  });

  it('should infer customer from Nasuni path', () => {
    const result = inferMetadataFromPath('/vault/Customers/Nasuni/notes.md', 'notes.md');
    expect(result.customer).toBe('nasuni');
    expect(result.tags.has('nasuni')).toBe(true);
  });

  it('should infer customer from ThermoFisher path', () => {
    const result = inferMetadataFromPath('/vault/Customers/ThermoFisher/doc.md', 'doc.md');
    expect(result.customer).toBe('thermofisher');
    expect(result.tags.has('thermofisher')).toBe(true);
  });

  it('should infer project from Hyrule Project path', () => {
    const result = inferMetadataFromPath('/vault/Hyrule Project/plan.md', 'plan.md');
    expect(result.project).toBe('hyrule');
    expect(result.tags.has('hyrule')).toBe(true);
  });

  it('should infer project from Weekly Insights path', () => {
    const result = inferMetadataFromPath('/vault/Weekly Insights/report.md', 'report.md');
    expect(result.project).toBe('weekly-insights');
  });

  it('should infer project from Lucille path', () => {
    const result = inferMetadataFromPath('/vault/Lucille/setup.md', 'setup.md');
    expect(result.project).toBe('lucille');
    expect(result.tags.has('lucille')).toBe(true);
  });

  it('should infer type from Standups path', () => {
    const result = inferMetadataFromPath('/vault/Standups/daily.md', 'daily.md');
    expect(result.type).toBe('standup');
    expect(result.tags.has('standup')).toBe(true);
  });

  it('should infer type from Documentation path', () => {
    const result = inferMetadataFromPath('/vault/Documentation/api.md', 'api.md');
    expect(result.type).toBe('documentation');
    expect(result.tags.has('docs')).toBe(true);
  });

  it('should infer type from Docs path', () => {
    const result = inferMetadataFromPath('/vault/Docs/guide.md', 'guide.md');
    expect(result.type).toBe('documentation');
    expect(result.tags.has('docs')).toBe(true);
  });

  it('should infer type from Research path', () => {
    const result = inferMetadataFromPath('/vault/Research/analysis.md', 'analysis.md');
    expect(result.type).toBe('research');
    expect(result.tags.has('research')).toBe(true);
  });

  it('should infer type from Governance path', () => {
    const result = inferMetadataFromPath('/vault/Governance/policy.md', 'policy.md');
    expect(result.type).toBe('governance');
    expect(result.tags.has('governance')).toBe(true);
  });

  it('should infer type from Working Sessions path', () => {
    const result = inferMetadataFromPath('/vault/Working Sessions/session.md', 'session.md');
    expect(result.type).toBe('working-session');
    expect(result.tags.has('working-session')).toBe(true);
  });

  it('should infer type from Configs and Keys path', () => {
    const result = inferMetadataFromPath('/vault/Configs and Keys/aws.md', 'aws.md');
    expect(result.type).toBe('config');
    expect(result.tags.has('config')).toBe(true);
  });

  it('should infer type from Technical path', () => {
    const result = inferMetadataFromPath('/vault/Technical/spec.md', 'spec.md');
    expect(result.type).toBe('technical');
    expect(result.tags.has('technical')).toBe(true);
  });

  it('should infer type from Code references path', () => {
    const result = inferMetadataFromPath('/vault/Code references/snippet.md', 'snippet.md');
    expect(result.type).toBe('code-reference');
    expect(result.tags.has('code-ref')).toBe(true);
  });

  it('should extract date from MMDDYYYY filename format', () => {
    const result = inferMetadataFromPath('/vault/meeting_01152024.md', 'meeting_01152024.md');
    expect(result.date).toBe('2024-01-15');
  });

  it('should extract date from filename with different formats', () => {
    const result = inferMetadataFromPath('/vault/notes12252024.md', 'notes12252024.md');
    expect(result.date).toBe('2024-12-25');
  });

  it('should not set date when filename has no 8-digit date', () => {
    const result = inferMetadataFromPath('/vault/notes.md', 'notes.md');
    expect(result.date).toBeUndefined();
  });

  it('should combine customer, project, and type from complex path', () => {
    const result = inferMetadataFromPath('/vault/Customers/Gartner/Standups/standup_01012024.md', 'standup_01012024.md');
    expect(result.customer).toBe('gartner');
    expect(result.type).toBe('standup');
    expect(result.date).toBe('2024-01-01');
    expect(result.tags.has('gartner')).toBe(true);
    expect(result.tags.has('standup')).toBe(true);
  });
});

// Tests for inferTagsFromContent

describe('inferTagsFromContent', () => {
  it('should preserve existing tags', () => {
    const existingTags = new Set(['existing-tag']);
    const result = inferTagsFromContent('Some content', existingTags);
    expect(result).toContain('existing-tag');
  });

  it('should detect opensearch tag', () => {
    const result = inferTagsFromContent('Using OpenSearch for search', new Set());
    expect(result).toContain('opensearch');
  });

  it('should detect lucille tag', () => {
    const result = inferTagsFromContent('Lucille framework setup', new Set());
    expect(result).toContain('lucille');
  });

  it('should detect kubernetes tag from kubernetes mention', () => {
    const result = inferTagsFromContent('Deploy to Kubernetes cluster', new Set());
    expect(result).toContain('kubernetes');
  });

  it('should detect kubernetes tag from eks mention', () => {
    const result = inferTagsFromContent('Running on EKS', new Set());
    expect(result).toContain('kubernetes');
  });

  it('should detect aws tag from aws mention', () => {
    const result = inferTagsFromContent('Deploy to AWS', new Set());
    expect(result).toContain('aws');
  });

  it('should detect aws tag from sagemaker mention', () => {
    const result = inferTagsFromContent('Train model in SageMaker', new Set());
    expect(result).toContain('aws');
  });

  it('should detect python tag', () => {
    const result = inferTagsFromContent('Written in Python', new Set());
    expect(result).toContain('python');
  });

  it('should detect java tag', () => {
    const result = inferTagsFromContent('Java application', new Set());
    expect(result).toContain('java');
  });

  it('should detect docker tag', () => {
    const result = inferTagsFromContent('Build Docker image', new Set());
    expect(result).toContain('docker');
  });

  it('should detect security tag from security mention', () => {
    const result = inferTagsFromContent('Security audit required', new Set());
    expect(result).toContain('security');
  });

  it('should detect security tag from CVE mention', () => {
    const result = inferTagsFromContent('CVE-2024-1234 vulnerability', new Set());
    expect(result).toContain('security');
  });

  it('should detect architecture tag', () => {
    const result = inferTagsFromContent('System architecture design', new Set());
    expect(result).toContain('architecture');
  });

  it('should detect hybrid-search tag from hybrid mention', () => {
    const result = inferTagsFromContent('Hybrid search implementation', new Set());
    expect(result).toContain('hybrid-search');
  });

  it('should detect hybrid-search tag from bm25 mention', () => {
    const result = inferTagsFromContent('BM25 scoring algorithm', new Set());
    expect(result).toContain('hybrid-search');
  });

  it('should detect hybrid-search tag from neural mention', () => {
    const result = inferTagsFromContent('Neural search ranking', new Set());
    expect(result).toContain('hybrid-search');
  });

  it('should detect ltr tag from ltr mention', () => {
    const result = inferTagsFromContent('LTR model training', new Set());
    expect(result).toContain('ltr');
  });

  it('should detect ltr tag from learning to rank mention', () => {
    const result = inferTagsFromContent('Learning to Rank implementation', new Set());
    expect(result).toContain('ltr');
  });

  it('should detect relevancy tag from relevancy mention', () => {
    const result = inferTagsFromContent('Improve relevancy scores', new Set());
    expect(result).toContain('relevancy');
  });

  it('should detect relevancy tag from relevance mention', () => {
    const result = inferTagsFromContent('Search relevance tuning', new Set());
    expect(result).toContain('relevancy');
  });

  it('should detect search-features tag from spellcheck mention', () => {
    const result = inferTagsFromContent('Enable spellcheck', new Set());
    expect(result).toContain('search-features');
  });

  it('should detect search-features tag from fuzziness mention', () => {
    const result = inferTagsFromContent('Configure fuzziness level', new Set());
    expect(result).toContain('search-features');
  });

  it('should be case insensitive', () => {
    const result = inferTagsFromContent('OPENSEARCH and KUBERNETES', new Set());
    expect(result).toContain('opensearch');
    expect(result).toContain('kubernetes');
  });

  it('should return sorted tags', () => {
    const result = inferTagsFromContent('Python on Kubernetes with Docker', new Set());
    const sortedResult = [...result].sort();
    expect(result).toEqual(sortedResult);
  });

  it('should detect multiple technologies', () => {
    const result = inferTagsFromContent('Python app on AWS EKS with Docker and OpenSearch', new Set());
    expect(result).toContain('python');
    expect(result).toContain('aws');
    expect(result).toContain('kubernetes');
    expect(result).toContain('docker');
    expect(result).toContain('opensearch');
  });
});

// Tests for mergeFrontmatter

describe('mergeFrontmatter', () => {
  const createInferredMetadata = (overrides: Partial<InferredMetadata> = {}): InferredMetadata => ({
    title: 'Inferred Title',
    tags: new Set(['inferred-tag']),
    status: 'active',
    ...overrides,
  });

  it('should add title when not present', () => {
    const existing = {};
    const inferred = createInferredMetadata({ title: 'New Title' });
    const result = mergeFrontmatter(existing, inferred);
    expect(result.title).toBe('New Title');
  });

  it('should not overwrite existing title', () => {
    const existing = { title: 'Existing Title' };
    const inferred = createInferredMetadata({ title: 'New Title' });
    const result = mergeFrontmatter(existing, inferred);
    expect(result.title).toBe('Existing Title');
  });

  it('should add date when not present', () => {
    const existing = {};
    const inferred = createInferredMetadata({ date: '2024-01-15' });
    const result = mergeFrontmatter(existing, inferred);
    expect(result.date).toBe('2024-01-15');
  });

  it('should not overwrite existing date', () => {
    const existing = { date: '2023-01-01' };
    const inferred = createInferredMetadata({ date: '2024-01-15' });
    const result = mergeFrontmatter(existing, inferred);
    expect(result.date).toBe('2023-01-01');
  });

  it('should add customer when not present', () => {
    const existing = {};
    const inferred = createInferredMetadata({ customer: 'gartner' });
    const result = mergeFrontmatter(existing, inferred);
    expect(result.customer).toBe('gartner');
  });

  it('should not overwrite existing customer', () => {
    const existing = { customer: 'nasuni' };
    const inferred = createInferredMetadata({ customer: 'gartner' });
    const result = mergeFrontmatter(existing, inferred);
    expect(result.customer).toBe('nasuni');
  });

  it('should add project when not present', () => {
    const existing = {};
    const inferred = createInferredMetadata({ project: 'hyrule' });
    const result = mergeFrontmatter(existing, inferred);
    expect(result.project).toBe('hyrule');
  });

  it('should not overwrite existing project', () => {
    const existing = { project: 'lucille' };
    const inferred = createInferredMetadata({ project: 'hyrule' });
    const result = mergeFrontmatter(existing, inferred);
    expect(result.project).toBe('lucille');
  });

  it('should add type when not present', () => {
    const existing = {};
    const inferred = createInferredMetadata({ type: 'standup' });
    const result = mergeFrontmatter(existing, inferred);
    expect(result.type).toBe('standup');
  });

  it('should not overwrite existing type', () => {
    const existing = { type: 'documentation' };
    const inferred = createInferredMetadata({ type: 'standup' });
    const result = mergeFrontmatter(existing, inferred);
    expect(result.type).toBe('documentation');
  });

  it('should add status when not present', () => {
    const existing = {};
    const inferred = createInferredMetadata({ status: 'active' });
    const result = mergeFrontmatter(existing, inferred);
    expect(result.status).toBe('active');
  });

  it('should not overwrite existing status', () => {
    const existing = { status: 'archived' };
    const inferred = createInferredMetadata({ status: 'active' });
    const result = mergeFrontmatter(existing, inferred);
    expect(result.status).toBe('archived');
  });

  it('should merge tags from both sources', () => {
    const existing = { tags: ['existing-tag-1', 'existing-tag-2'] };
    const inferred = createInferredMetadata({ tags: new Set(['inferred-tag-1', 'inferred-tag-2']) });
    const result = mergeFrontmatter(existing, inferred);
    expect(result.tags).toContain('existing-tag-1');
    expect(result.tags).toContain('existing-tag-2');
    expect(result.tags).toContain('inferred-tag-1');
    expect(result.tags).toContain('inferred-tag-2');
  });

  it('should deduplicate merged tags', () => {
    const existing = { tags: ['shared-tag', 'existing-tag'] };
    const inferred = createInferredMetadata({ tags: new Set(['shared-tag', 'inferred-tag']) });
    const result = mergeFrontmatter(existing, inferred);
    const sharedTagCount = result.tags.filter((t: string) => t === 'shared-tag').length;
    expect(sharedTagCount).toBe(1);
  });

  it('should sort merged tags', () => {
    const existing = { tags: ['zebra', 'banana'] };
    const inferred = createInferredMetadata({ tags: new Set(['apple', 'cherry']) });
    const result = mergeFrontmatter(existing, inferred);
    const sortedTags = [...result.tags].sort();
    expect(result.tags).toEqual(sortedTags);
  });

  it('should handle empty existing tags', () => {
    const existing = {};
    const inferred = createInferredMetadata({ tags: new Set(['tag1', 'tag2']) });
    const result = mergeFrontmatter(existing, inferred);
    expect(result.tags).toContain('tag1');
    expect(result.tags).toContain('tag2');
  });

  it('should handle empty inferred tags', () => {
    const existing = { tags: ['existing'] };
    const inferred = createInferredMetadata({ tags: new Set() });
    const result = mergeFrontmatter(existing, inferred);
    expect(result.tags).toContain('existing');
  });

  it('should preserve other existing properties', () => {
    const existing = { customField: 'custom value', anotherField: 123 };
    const inferred = createInferredMetadata();
    const result = mergeFrontmatter(existing, inferred);
    expect(result.customField).toBe('custom value');
    expect(result.anotherField).toBe(123);
  });
});
