#!/usr/bin/env node

/**
 * Theme Color Checker
 *
 * This script scans source files for hardcoded color classes that should use CSS variables.
 * Run before commits to ensure theme consistency.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Patterns to detect hardcoded colors that should use CSS variables
// Note: Patterns with /opacity (e.g., bg-white/10) are allowed for overlays
const FORBIDDEN_PATTERNS = [
  // Text colors that should use --text-primary, --text-secondary, --text-muted
  { pattern: /\btext-white\b(?!\/)/g, msg: 'text-white → text-[var(--text-primary)]' },
  { pattern: /\btext-black\b(?!\/)/g, msg: 'text-black → text-[var(--text-primary)]' },
  { pattern: /\btext-gray-[0-9]+\b(?!\/)/g, msg: 'text-gray-* → text-[var(--text-secondary)] or text-[var(--text-muted)]' },
  { pattern: /\btext-slate-[0-9]+\b(?!\/)/g, msg: 'text-slate-* → use CSS variable' },

  // Background colors (without opacity suffix - those are intentional overlays)
  { pattern: /\bbg-white\b(?!\/)/g, msg: 'bg-white → bg-[var(--bg-primary)]' },
  { pattern: /\bbg-black\b(?!\/)/g, msg: 'bg-black → bg-[var(--bg-primary)]' },
  { pattern: /\bbg-gray-[0-9]+\b(?!\/)/g, msg: 'bg-gray-* → bg-[var(--bg-secondary)]' },
  { pattern: /\bbg-slate-[0-9]+\b(?!\/)/g, msg: 'bg-slate-* → use CSS variable' },

  // Border colors (without opacity suffix)
  { pattern: /\bborder-white\b(?!\/)/g, msg: 'border-white → border-[var(--divider)]' },
  { pattern: /\bborder-black\b(?!\/)/g, msg: 'border-black → border-[var(--divider)]' },
  { pattern: /\bborder-gray-[0-9]+\b(?!\/)/g, msg: 'border-gray-* → border-[var(--divider)]' },
  { pattern: /\bborder-slate-[0-9]+\b(?!\/)/g, msg: 'border-slate-* → use CSS variable' },

  // Dividers
  { pattern: /\bdivide-gray-[0-9]+\b(?!\/)/g, msg: 'divide-gray-* → use CSS variable' },

  // SVG hardcoded colors (inline styles)
  { pattern: /\bfill="white"\b/g, msg: 'fill="white" → fill="var(--svg-fill)" or fill="var(--bg-primary)"' },
  { pattern: /\bfill="#fff(?:fff)?"\b/gi, msg: 'fill="#fff" → fill="var(--svg-fill)" or fill="var(--bg-primary)"' },
  { pattern: /\bstroke="white"\b/g, msg: 'stroke="white" → stroke="var(--svg-stroke)" or stroke="var(--bg-primary)"' },
  { pattern: /\bstroke="#fff(?:fff)?"\b/gi, msg: 'stroke="#fff" → stroke="var(--svg-stroke)" or stroke="var(--bg-primary)"' },
  { pattern: /\bstroke="rgba\(255,\s*255,\s*255/g, msg: 'stroke="rgba(255,255,255,*)" → stroke="var(--svg-stroke)"' },
  // Only flag neutral grays in SVG - accent colors like #10b981 (green) are intentional
  { pattern: /\bfill="#(?:666|888|999|aaa|bbb|ccc|ddd|eee)(?:[0-9a-f]{3})?"\b/gi, msg: 'fill="#gray" → fill="var(--svg-fill-muted)"' },
];

// Files/directories to scan
const SCAN_DIRS = ['src/components', 'src/pages', 'src/layouts'];
const EXTENSIONS = ['.tsx', '.jsx', '.astro', '.ts', '.js'];

// Files to ignore
const IGNORE_FILES = [
  'ThemeToggle.tsx', // Theme toggle intentionally uses specific colors
  'MetricsDashboard.tsx', // Recharts doesn't support CSS variables - needs React theme context
  'EytzingerLayout.tsx', // Uses text-white on colored backgrounds for status indicators
];

function getAllFiles(dir, files = []) {
  const fullDir = path.join(projectRoot, dir);
  if (!fs.existsSync(fullDir)) return files;

  const items = fs.readdirSync(fullDir);
  for (const item of items) {
    const fullPath = path.join(fullDir, item);
    const relativePath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(relativePath, files);
    } else if (EXTENSIONS.some(ext => item.endsWith(ext))) {
      if (!IGNORE_FILES.includes(item)) {
        files.push({ fullPath, relativePath });
      }
    }
  }
  return files;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const issues = [];

  lines.forEach((line, index) => {
    // Skip comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      return;
    }

    for (const { pattern, msg } of FORBIDDEN_PATTERNS) {
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;
      const match = pattern.exec(line);
      if (match) {
        issues.push({
          line: index + 1,
          match: match[0],
          suggestion: msg,
          content: line.trim().substring(0, 100),
        });
      }
    }
  });

  return issues;
}

function main() {
  console.log('🎨 Checking for hardcoded theme colors...\n');

  let allIssues = [];

  for (const dir of SCAN_DIRS) {
    const files = getAllFiles(dir);
    for (const { fullPath, relativePath } of files) {
      const issues = checkFile(fullPath);
      if (issues.length > 0) {
        allIssues.push({ file: relativePath, issues });
      }
    }
  }

  if (allIssues.length === 0) {
    console.log('✅ No hardcoded theme colors found!\n');
    console.log('All color classes are using CSS variables properly.');
    process.exit(0);
  }

  const totalIssues = allIssues.reduce((sum, f) => sum + f.issues.length, 0);
  console.log(`❌ Found ${totalIssues} hardcoded color(s) in ${allIssues.length} file(s):\n`);

  for (const { file, issues } of allIssues) {
    console.log(`📁 ${file}`);
    for (const issue of issues) {
      console.log(`   Line ${issue.line}: ${issue.match}`);
      console.log(`   └─ ${issue.content}`);
    }
    console.log('');
  }

  console.log('💡 Replace hardcoded colors with CSS variables:');
  console.log('   text-white      →  text-[var(--text-primary)]');
  console.log('   text-gray-400   →  text-[var(--text-secondary)]');
  console.log('   text-gray-500   →  text-[var(--text-muted)]');
  console.log('   bg-gray-800     →  bg-[var(--bg-secondary)]');
  console.log('   border-gray-700 →  border-[var(--divider)]');
  console.log('');

  process.exit(1);
}

main();
