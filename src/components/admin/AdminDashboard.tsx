import { useState, useEffect, useCallback } from 'react';

const REPO_OWNER = 'kaustubhbutte777';
const REPO_NAME = 'kaustubhbutte777.github.io';
const BRANCH = 'main';

interface BlogPost {
  slug: string;
  title: string;
  draft: boolean;
  path: string;
  sha: string;
}

interface PlaygroundDemo {
  title: string;
  published: boolean;
}

interface PlaygroundFile {
  content: string;
  sha: string;
  demos: PlaygroundDemo[];
}

function getStoredToken(): string | null {
  try { return localStorage.getItem('gh_admin_token'); }
  catch { return null; }
}

function storeToken(token: string) {
  try { localStorage.setItem('gh_admin_token', token); }
  catch { /* ignore */ }
}

function clearToken() {
  try { localStorage.removeItem('gh_admin_token'); }
  catch { /* ignore */ }
}

async function ghFetch(path: string, token: string, options?: RequestInit) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error: ${res.status}`);
  }
  return res.json();
}

function parseFrontmatter(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { title: '', draft: false };
  const fm = match[1];
  const titleMatch = fm.match(/^title:\s*["']?(.*?)["']?\s*$/m);
  const draftMatch = fm.match(/^draft:\s*(true|false)\s*$/m);
  return {
    title: titleMatch ? titleMatch[1] : '',
    draft: draftMatch ? draftMatch[1] === 'true' : false,
  };
}

function toggleDraftInContent(content: string): string {
  const draftMatch = content.match(/^(draft:\s*)(true|false)\s*$/m);
  if (draftMatch) {
    const newVal = draftMatch[2] === 'true' ? 'false' : 'true';
    return content.replace(/^(draft:\s*)(true|false)\s*$/m, `$1${newVal}`);
  }
  // Insert draft: true before closing ---
  return content.replace(/^(---\n[\s\S]*?)(---)\s*$/m, '$1draft: true\n$2');
}

function parsePlaygroundDemos(content: string): PlaygroundDemo[] {
  const demos: PlaygroundDemo[] = [];
  const regex = /\{\s*\n\s*title:\s*"([^"]+)"[\s\S]*?published:\s*(true|false)/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    demos.push({ title: m[1], published: m[2] === 'true' });
  }
  return demos;
}

function togglePublishedInContent(content: string, title: string): string {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(title:\\s*"${escaped}"[\\s\\S]*?published:\\s*)(true|false)`);
  const match = content.match(regex);
  if (!match) return content;
  const newVal = match[2] === 'true' ? 'false' : 'true';
  return content.replace(regex, `$1${newVal}`);
}

export default function AdminDashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [playground, setPlayground] = useState<PlaygroundFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredToken();
    if (stored) setToken(stored);
  }, []);

  const fetchContent = useCallback(async (t: string) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch blog directory
      const blogFiles = await ghFetch(
        `/repos/${REPO_OWNER}/${REPO_NAME}/contents/src/content/blog?ref=${BRANCH}`,
        t
      );
      const mdxFiles = blogFiles.filter((f: any) =>
        f.name.endsWith('.mdx') || f.name.endsWith('.md')
      );

      const blogPosts: BlogPost[] = [];
      for (const file of mdxFiles) {
        const fileData = await ghFetch(
          `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${file.path}?ref=${BRANCH}`,
          t
        );
        const content = atob(fileData.content.replace(/\n/g, ''));
        const { title, draft } = parseFrontmatter(content);
        blogPosts.push({
          slug: file.name.replace(/\.(mdx?|md)$/, ''),
          title: title || file.name,
          draft,
          path: file.path,
          sha: fileData.sha,
        });
      }
      setPosts(blogPosts);

      // Fetch playground index
      const pgData = await ghFetch(
        `/repos/${REPO_OWNER}/${REPO_NAME}/contents/src/pages/playground/index.astro?ref=${BRANCH}`,
        t
      );
      const pgContent = atob(pgData.content.replace(/\n/g, ''));
      const demos = parsePlaygroundDemos(pgContent);
      setPlayground({ content: pgContent, sha: pgData.sha, demos });
    } catch (err: any) {
      setError(err.message || 'Failed to fetch content');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (token) fetchContent(token);
  }, [token, fetchContent]);

  const handleLogin = () => {
    if (!tokenInput.trim()) return;
    storeToken(tokenInput.trim());
    setToken(tokenInput.trim());
    setTokenInput('');
  };

  const handleLogout = () => {
    clearToken();
    setToken(null);
    setPosts([]);
    setPlayground(null);
  };

  const handleToggleDraft = async (post: BlogPost) => {
    if (!token) return;
    setToggling(`blog-${post.slug}`);
    setError(null);
    try {
      // Get latest file content
      const fileData = await ghFetch(
        `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${post.path}?ref=${BRANCH}`,
        token
      );
      const content = atob(fileData.content.replace(/\n/g, ''));
      const newContent = toggleDraftInContent(content);
      const newDraft = !post.draft;

      await ghFetch(
        `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${post.path}`,
        token,
        {
          method: 'PUT',
          body: JSON.stringify({
            message: `${newDraft ? 'Unpublish' : 'Publish'} blog post: ${post.title}`,
            content: btoa(unescape(encodeURIComponent(newContent))),
            sha: fileData.sha,
            branch: BRANCH,
          }),
        }
      );

      setLastAction(`${newDraft ? 'Unpublished' : 'Published'} "${post.title}" — deploying...`);
      await fetchContent(token);
    } catch (err: any) {
      setError(err.message);
    }
    setToggling(null);
  };

  const handleTogglePublished = async (demo: PlaygroundDemo) => {
    if (!token || !playground) return;
    setToggling(`demo-${demo.title}`);
    setError(null);
    try {
      // Get latest file
      const fileData = await ghFetch(
        `/repos/${REPO_OWNER}/${REPO_NAME}/contents/src/pages/playground/index.astro?ref=${BRANCH}`,
        token
      );
      const content = atob(fileData.content.replace(/\n/g, ''));
      const newContent = togglePublishedInContent(content, demo.title);
      const newPublished = !demo.published;

      await ghFetch(
        `/repos/${REPO_OWNER}/${REPO_NAME}/contents/src/pages/playground/index.astro`,
        token,
        {
          method: 'PUT',
          body: JSON.stringify({
            message: `${newPublished ? 'Publish' : 'Hide'} playground demo: ${demo.title}`,
            content: btoa(unescape(encodeURIComponent(newContent))),
            sha: fileData.sha,
            branch: BRANCH,
          }),
        }
      );

      setLastAction(`${newPublished ? 'Published' : 'Hidden'} "${demo.title}" — deploying...`);
      await fetchContent(token);
    } catch (err: any) {
      setError(err.message);
    }
    setToggling(null);
  };

  // Login screen
  if (!token) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <div className="glass-strong rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Admin Access</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            Enter your GitHub Personal Access Token with <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-xs">repo</code> scope
            to manage content.
          </p>
          <div className="space-y-4">
            <input
              type="password"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="ghp_xxxxxxxxxxxx"
              className="w-full px-4 py-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50
                         text-[var(--text-primary)] text-sm placeholder-zinc-600
                         focus:outline-none focus:border-amber-500/50"
            />
            <button
              onClick={handleLogin}
              className="w-full px-4 py-3 rounded-lg bg-amber-500/20 text-amber-400
                         font-medium hover:bg-amber-500/30 transition-colors"
            >
              Connect
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-4">
            Token is stored in your browser only.{' '}
            <a
              href="https://github.com/settings/tokens/new?scopes=repo&description=Portfolio+Admin"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-500 hover:underline"
            >
              Create a token
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Content Manager</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Toggle content visibility. Changes commit directly and trigger a deploy.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchContent(token)}
            disabled={loading}
            className="px-3 py-2 rounded-lg glass text-sm text-[var(--text-secondary)]
                       hover:text-[var(--text-primary)] transition-colors"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-red-400 transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}
      {lastAction && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center justify-between">
          <span>{lastAction}</span>
          <button onClick={() => setLastAction(null)} className="text-emerald-600 hover:text-emerald-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {loading && posts.length === 0 ? (
        <div className="text-center py-20 text-[var(--text-muted)]">Loading content from GitHub...</div>
      ) : (
        <>
          {/* Blog Posts */}
          <div className="glass-strong rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Blog Posts</h3>
              <span className="text-xs text-[var(--text-muted)]">({posts.length})</span>
            </div>

            {posts.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-4">No blog posts found.</p>
            ) : (
              <div className="space-y-2">
                {posts.map(post => {
                  const isToggling = toggling === `blog-${post.slug}`;
                  return (
                    <div
                      key={post.slug}
                      className="flex items-center justify-between py-3 px-4 rounded-xl
                                 bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                          {post.title}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">{post.path}</p>
                      </div>
                      <button
                        onClick={() => handleToggleDraft(post)}
                        disabled={isToggling}
                        className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all
                          ${isToggling ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:scale-105'}
                          ${post.draft
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                      >
                        {isToggling ? 'Saving...' : post.draft ? 'Draft' : 'Live'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Playground Demos */}
          <div className="glass-strong rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Playground Demos</h3>
              <span className="text-xs text-[var(--text-muted)]">({playground?.demos.length || 0})</span>
            </div>

            {!playground || playground.demos.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-4">No demos found.</p>
            ) : (
              <div className="space-y-2">
                {playground.demos.map(demo => {
                  const isToggling = toggling === `demo-${demo.title}`;
                  return (
                    <div
                      key={demo.title}
                      className="flex items-center justify-between py-3 px-4 rounded-xl
                                 bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors"
                    >
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate flex-1 mr-4">
                        {demo.title}
                      </p>
                      <button
                        onClick={() => handleTogglePublished(demo)}
                        disabled={isToggling}
                        className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all
                          ${isToggling ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:scale-105'}
                          ${demo.published
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                      >
                        {isToggling ? 'Saving...' : demo.published ? 'Live' : 'Hidden'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
