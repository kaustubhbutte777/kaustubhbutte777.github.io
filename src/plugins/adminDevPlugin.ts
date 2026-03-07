import type { Plugin } from 'vite';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { IncomingMessage } from 'node:http';

function parseBody(req: IncomingMessage): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function getBlogPosts(root: string) {
  const blogDir = join(root, 'src/content/blog');
  try {
    const files = readdirSync(blogDir).filter(f => f.endsWith('.mdx') || f.endsWith('.md'));
    return files.map(file => {
      const content = readFileSync(join(blogDir, file), 'utf-8');
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = fmMatch ? fmMatch[1] : '';

      const titleMatch = frontmatter.match(/^title:\s*["']?(.*?)["']?\s*$/m);
      const draftMatch = frontmatter.match(/^draft:\s*(true|false)\s*$/m);

      return {
        slug: file.replace(/\.(mdx?|md)$/, ''),
        title: titleMatch ? titleMatch[1] : file,
        draft: draftMatch ? draftMatch[1] === 'true' : false,
      };
    });
  } catch {
    return [];
  }
}

function getPlaygroundDemos(root: string) {
  const filePath = join(root, 'src/pages/playground/index.astro');
  try {
    const content = readFileSync(filePath, 'utf-8');

    const demos: { title: string; published: boolean }[] = [];
    // Match each demo object block by finding title and published fields
    const demoRegex = /\{\s*\n\s*title:\s*"([^"]+)"[\s\S]*?published:\s*(true|false)/g;
    let match;
    while ((match = demoRegex.exec(content)) !== null) {
      demos.push({
        title: match[1],
        published: match[2] === 'true',
      });
    }
    return demos;
  } catch {
    return [];
  }
}

function toggleBlogDraft(root: string, slug: string): boolean {
  const blogDir = join(root, 'src/content/blog');
  const extensions = ['.mdx', '.md'];

  for (const ext of extensions) {
    const filePath = join(blogDir, slug + ext);
    try {
      let content = readFileSync(filePath, 'utf-8');
      const draftMatch = content.match(/^(draft:\s*)(true|false)\s*$/m);

      if (draftMatch) {
        const newValue = draftMatch[2] === 'true' ? 'false' : 'true';
        content = content.replace(
          /^(draft:\s*)(true|false)\s*$/m,
          `$1${newValue}`
        );
      } else {
        // No draft field — insert before closing ---
        content = content.replace(
          /^(---\n[\s\S]*?)(---)$/m,
          `$1draft: true\n$2`
        );
      }

      writeFileSync(filePath, content, 'utf-8');
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

function togglePlaygroundPublished(root: string, title: string): boolean {
  const filePath = join(root, 'src/pages/playground/index.astro');
  try {
    let content = readFileSync(filePath, 'utf-8');

    // Escape special regex chars in title
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Find the demo block by title and toggle the published field within it
    const blockRegex = new RegExp(
      `(title:\\s*"${escapedTitle}"[\\s\\S]*?published:\\s*)(true|false)`,
    );
    const match = content.match(blockRegex);

    if (match) {
      const newValue = match[2] === 'true' ? 'false' : 'true';
      content = content.replace(blockRegex, `$1${newValue}`);
      writeFileSync(filePath, content, 'utf-8');
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function adminDevPlugin(): Plugin {
  let projectRoot = '';

  return {
    name: 'portfolio-admin-dev',

    configResolved(config) {
      projectRoot = config.root;
    },

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/admin')) return next();

        res.setHeader('Content-Type', 'application/json');

        // GET /api/admin/status
        if (req.method === 'GET' && req.url === '/api/admin/status') {
          const posts = getBlogPosts(projectRoot);
          const demos = getPlaygroundDemos(projectRoot);
          res.statusCode = 200;
          res.end(JSON.stringify({ posts, demos }));
          return;
        }

        // POST /api/admin/toggle-draft
        if (req.method === 'POST' && req.url === '/api/admin/toggle-draft') {
          const body = await parseBody(req);
          const slug = body.slug;
          if (!slug) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'slug is required' }));
            return;
          }
          const success = toggleBlogDraft(projectRoot, slug);
          res.statusCode = success ? 200 : 404;
          res.end(JSON.stringify({ success }));
          return;
        }

        // POST /api/admin/toggle-published
        if (req.method === 'POST' && req.url === '/api/admin/toggle-published') {
          const body = await parseBody(req);
          const title = body.title;
          if (!title) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'title is required' }));
            return;
          }
          const success = togglePlaygroundPublished(projectRoot, title);
          res.statusCode = success ? 200 : 404;
          res.end(JSON.stringify({ success }));
          return;
        }

        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'not found' }));
      });
    },
  };
}
