import { describe, it, expect } from 'vitest';

describe('toggleDraftInContent', () => {
  function toggleDraftInContent(content: string): string {
    const draftMatch = content.match(/^(draft:\s*)(true|false)\s*$/m);
    if (draftMatch) {
      const newVal = draftMatch[2] === 'true' ? 'false' : 'true';
      return content.replace(/^(draft:\s*)(true|false)\s*$/m, `$1${newVal}`);
    }
    return content.replace(/^(---\n[\s\S]*?)(---)\s*$/m, '$1draft: true\n$2');
  }

  it('should toggle draft from true to false', () => {
    const input = '---\ntitle: "Test"\ndraft: true\n---\nContent';
    const result = toggleDraftInContent(input);
    expect(result).toContain('draft: false');
    expect(result).not.toContain('draft: true');
  });

  it('should toggle draft from false to true', () => {
    const input = '---\ntitle: "Test"\ndraft: false\n---\nContent';
    const result = toggleDraftInContent(input);
    expect(result).toContain('draft: true');
    expect(result).not.toContain('draft: false');
  });

  it('should add draft: true when no draft field exists', () => {
    const input = '---\ntitle: "Test"\n---\nContent';
    const result = toggleDraftInContent(input);
    expect(result).toContain('draft: true');
  });

  it('should preserve other frontmatter fields', () => {
    const input = '---\ntitle: "Test"\ndescription: "Desc"\ndraft: true\ntags: ["a"]\n---\nContent';
    const result = toggleDraftInContent(input);
    expect(result).toContain('title: "Test"');
    expect(result).toContain('description: "Desc"');
    expect(result).toContain('tags: ["a"]');
    expect(result).toContain('draft: false');
  });
});

describe('togglePublishedInContent', () => {
  function togglePublishedInContent(content: string, title: string): string {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(title:\\s*"${escaped}"[\\s\\S]*?published:\\s*)(true|false)`);
    const match = content.match(regex);
    if (!match) return content;
    const newVal = match[2] === 'true' ? 'false' : 'true';
    return content.replace(regex, `$1${newVal}`);
  }

  const sampleContent = `
const demos = [
  {
    title: "Raft Consensus",
    description: "Interactive raft demo",
    published: false,
  },
  {
    title: "Vector Clocks",
    description: "Vector clock viz",
    published: true,
  },
];`;

  it('should toggle published from false to true', () => {
    const result = togglePublishedInContent(sampleContent, 'Raft Consensus');
    expect(result).toMatch(/title:\s*"Raft Consensus"[\s\S]*?published:\s*true/);
  });

  it('should toggle published from true to false', () => {
    const result = togglePublishedInContent(sampleContent, 'Vector Clocks');
    expect(result).toMatch(/title:\s*"Vector Clocks"[\s\S]*?published:\s*false/);
  });

  it('should not modify other demos', () => {
    const result = togglePublishedInContent(sampleContent, 'Raft Consensus');
    expect(result).toMatch(/title:\s*"Vector Clocks"[\s\S]*?published:\s*true/);
  });

  it('should return content unchanged for unknown title', () => {
    const result = togglePublishedInContent(sampleContent, 'Nonexistent');
    expect(result).toBe(sampleContent);
  });
});
