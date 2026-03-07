import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

describe('Home page should not have hardcoded content', () => {
  const content = readFileSync(join(ROOT, 'src/pages/index.astro'), 'utf-8');

  it('should use getCollection for blog posts, not hardcoded titles', () => {
    // Check that blog posts come from the content collection
    expect(content).toContain("getCollection('blog'");
    // Ensure no hardcoded post titles (these were the old fake ones)
    expect(content).not.toMatch(/Getting Started with Distributed Systems/);
    expect(content).not.toMatch(/Understanding Database Internals/);
  });

  it('should not hardcode specific demo names with tags in the playground section', () => {
    // The playground section should be a generic CTA, not listing specific demos
    // Check there are no hardcoded tag pills for specific demos
    const playgroundSection = content.match(/Interactive Playground[\s\S]*$/)?.[0] || '';
    expect(playgroundSection).not.toMatch(/>Raft<\/span>/);
    expect(playgroundSection).not.toMatch(/>B\+ Tree<\/span>/);
    expect(playgroundSection).not.toMatch(/>LSM Tree<\/span>/);
    expect(playgroundSection).not.toMatch(/>WAL<\/span>/);
  });

  it('should have a fallback when no blog posts exist', () => {
    // There should be an else branch or conditional rendering for empty posts
    expect(content).toMatch(/recentPosts\.length\s*(>|===|==)\s*0|recentPosts\.length\s*<\s*1|: \(/);
  });
});

describe('Pages should respect content gating', () => {
  it('blog pages should filter by draft status', () => {
    const blogIndex = readFileSync(join(ROOT, 'src/pages/blog/index.astro'), 'utf-8');
    expect(blogIndex).toMatch(/data\.draft\s*!==\s*true|import\.meta\.env\.DEV/);
  });

  it('home page should filter blog posts by draft status', () => {
    const home = readFileSync(join(ROOT, 'src/pages/index.astro'), 'utf-8');
    expect(home).toMatch(/data\.draft\s*!==\s*true|import\.meta\.env\.DEV/);
  });

  it('playground index should filter by published status', () => {
    const playground = readFileSync(join(ROOT, 'src/pages/playground/index.astro'), 'utf-8');
    expect(playground).toMatch(/\.published|import\.meta\.env\.DEV/);
  });
});
