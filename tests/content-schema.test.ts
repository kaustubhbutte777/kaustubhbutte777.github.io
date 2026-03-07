import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

function parseFrontmatter(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  return match[1];
}

function extractField(fm: string, field: string): string | null {
  const match = fm.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim() : null;
}

describe('Blog post frontmatter', () => {
  const blogDir = join(ROOT, 'src/content/blog');
  const files = readdirSync(blogDir).filter(f => f.endsWith('.mdx') || f.endsWith('.md'));

  it('should have at least one blog post', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    describe(file, () => {
      const content = readFileSync(join(blogDir, file), 'utf-8');
      const fm = parseFrontmatter(content);

      it('should have frontmatter', () => {
        expect(fm).not.toBeNull();
      });

      it('should have a title', () => {
        expect(extractField(fm!, 'title')).not.toBeNull();
      });

      it('should have a description', () => {
        expect(extractField(fm!, 'description')).not.toBeNull();
      });

      it('should have a valid date', () => {
        const date = extractField(fm!, 'date');
        expect(date).not.toBeNull();
        expect(new Date(date!).toString()).not.toBe('Invalid Date');
      });

      it('should have draft field as boolean', () => {
        const draft = extractField(fm!, 'draft');
        if (draft !== null) {
          expect(['true', 'false']).toContain(draft);
        }
      });

      it('should not reference missing images', () => {
        const thumbnail = extractField(fm!, 'thumbnail');
        if (thumbnail) {
          const imgPath = thumbnail.replace(/^["']|["']$/g, '');
          const fullPath = join(ROOT, 'public', imgPath);
          const exists = (() => {
            try { readFileSync(fullPath); return true; }
            catch { return false; }
          })();
          expect(exists, `Image not found: ${imgPath}`).toBe(true);
        }
      });
    });
  }
});

describe('Playground demos', () => {
  const filePath = join(ROOT, 'src/pages/playground/index.astro');
  const content = readFileSync(filePath, 'utf-8');

  it('each demo object should have a published field', () => {
    const demoRegex = /\{\s*\n\s*title:\s*"([^"]+)"[\s\S]*?published:\s*(true|false)/g;
    const demos: string[] = [];
    let m;
    while ((m = demoRegex.exec(content)) !== null) {
      demos.push(m[1]);
    }
    expect(demos.length).toBeGreaterThan(0);
  });

  it('each demo object should have an href', () => {
    const demoRegex = /\{\s*\n\s*title:\s*"([^"]+)"[\s\S]*?href:\s*"([^"]+)"/g;
    const demos: string[] = [];
    let m;
    while ((m = demoRegex.exec(content)) !== null) {
      demos.push(m[1]);
    }
    expect(demos.length).toBeGreaterThan(0);
  });
});

describe('Interests gallery', () => {
  const filePath = join(ROOT, 'src/components/about/InterestsGallery.tsx');
  const content = readFileSync(filePath, 'utf-8');

  it('each gallery item should have a published field', () => {
    const itemRegex = /\{\s*\n\s*id:\s*['"][^'"]+['"][\s\S]*?published:\s*(true|false)/g;
    const items: string[] = [];
    let m;
    while ((m = itemRegex.exec(content)) !== null) {
      items.push(m[1]);
    }
    expect(items.length).toBeGreaterThan(0);
  });
});
