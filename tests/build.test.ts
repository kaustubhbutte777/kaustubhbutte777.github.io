import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

describe('Astro build', () => {
  it('should complete without errors', () => {
    const result = execSync('npx astro build', {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 120_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    expect(result).toContain('Complete!');
  }, 120_000);
});
