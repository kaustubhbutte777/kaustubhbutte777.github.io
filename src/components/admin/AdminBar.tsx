import { useState, useEffect, useCallback } from 'react';

interface BlogPost {
  slug: string;
  title: string;
  draft: boolean;
}

interface PlaygroundDemo {
  title: string;
  published: boolean;
}

interface InterestItem {
  title: string;
  published: boolean;
}

interface AdminStatus {
  posts: BlogPost[];
  demos: PlaygroundDemo[];
  interests: InterestItem[];
}

export default function AdminBar() {
  if (!import.meta.env.DEV) return null;

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/status');
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error('Admin: failed to fetch status', err);
    }
  }, []);

  useEffect(() => {
    if (open && !status) fetchStatus();
  }, [open, status, fetchStatus]);

  const toggleDraft = async (slug: string) => {
    setToggling(`blog-${slug}`);
    try {
      await fetch('/api/admin/toggle-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      // Refetch status after toggle
      await fetchStatus();
    } catch (err) {
      console.error('Admin: failed to toggle draft', err);
    }
    setToggling(null);
  };

  const togglePublished = async (title: string) => {
    setToggling(`demo-${title}`);
    try {
      await fetch('/api/admin/toggle-published', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      await fetchStatus();
    } catch (err) {
      console.error('Admin: failed to toggle published', err);
    }
    setToggling(null);
  };

  const toggleInterest = async (title: string) => {
    setToggling(`interest-${title}`);
    try {
      await fetch('/api/admin/toggle-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      await fetchStatus();
    } catch (err) {
      console.error('Admin: failed to toggle interest', err);
    }
    setToggling(null);
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999]">
      {/* Collapsed: floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium
                     bg-amber-500/15 text-amber-400 border border-amber-500/30
                     hover:bg-amber-500/25 transition-all shadow-lg backdrop-blur-md"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Dev Admin
        </button>
      )}

      {/* Expanded: admin panel */}
      {open && (
        <div className="rounded-2xl p-5 w-[380px] max-h-[75vh] overflow-y-auto shadow-2xl
                        bg-zinc-900/95 border border-amber-500/20 backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <h3 className="text-base font-bold text-amber-400">Dev Admin</h3>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {!status ? (
            <p className="text-sm text-zinc-500">Loading...</p>
          ) : (
            <>
              {/* Blog Posts */}
              <div className="mb-5">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                  Blog Posts ({status.posts.length})
                </h4>
                {status.posts.length === 0 ? (
                  <p className="text-xs text-zinc-600">No blog posts found</p>
                ) : (
                  <div className="space-y-1.5">
                    {status.posts.map(post => (
                      <div
                        key={post.slug}
                        className="flex items-center justify-between py-2 px-3 rounded-lg
                                   bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
                      >
                        <span className="text-sm text-zinc-300 truncate flex-1 mr-3" title={post.title}>
                          {post.title}
                        </span>
                        <button
                          onClick={() => toggleDraft(post.slug)}
                          disabled={toggling === `blog-${post.slug}`}
                          className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors
                            ${toggling === `blog-${post.slug}` ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                            ${post.draft
                              ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                            }`}
                        >
                          {toggling === `blog-${post.slug}` ? '...' : post.draft ? 'Draft' : 'Live'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Playground Demos */}
              <div>
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                  Playground Demos ({status.demos.length})
                </h4>
                {status.demos.length === 0 ? (
                  <p className="text-xs text-zinc-600">No demos found</p>
                ) : (
                  <div className="space-y-1.5">
                    {status.demos.map(demo => (
                      <div
                        key={demo.title}
                        className="flex items-center justify-between py-2 px-3 rounded-lg
                                   bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
                      >
                        <span className="text-sm text-zinc-300 truncate flex-1 mr-3" title={demo.title}>
                          {demo.title}
                        </span>
                        <button
                          onClick={() => togglePublished(demo.title)}
                          disabled={toggling === `demo-${demo.title}`}
                          className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors
                            ${toggling === `demo-${demo.title}` ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                            ${demo.published
                              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                            }`}
                        >
                          {toggling === `demo-${demo.title}` ? '...' : demo.published ? 'Live' : 'Hidden'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Interests Gallery */}
              <div className="mt-5">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                  Beyond Code ({status.interests?.length || 0})
                </h4>
                {!status.interests || status.interests.length === 0 ? (
                  <p className="text-xs text-zinc-600">No interests found</p>
                ) : (
                  <div className="space-y-1.5">
                    {status.interests.map(item => (
                      <div
                        key={item.title}
                        className="flex items-center justify-between py-2 px-3 rounded-lg
                                   bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
                      >
                        <span className="text-sm text-zinc-300 truncate flex-1 mr-3" title={item.title}>
                          {item.title}
                        </span>
                        <button
                          onClick={() => toggleInterest(item.title)}
                          disabled={toggling === `interest-${item.title}`}
                          className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors
                            ${toggling === `interest-${item.title}` ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                            ${item.published
                              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                            }`}
                        >
                          {toggling === `interest-${item.title}` ? '...' : item.published ? 'Live' : 'Hidden'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Hint */}
              <p className="text-[10px] text-zinc-600 mt-4 text-center">
                Toggling modifies source files. HMR will reload the page.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
