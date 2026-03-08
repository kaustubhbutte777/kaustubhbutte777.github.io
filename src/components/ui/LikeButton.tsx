import { useState, useEffect, useCallback } from 'react';

const UPSTASH_URL = import.meta.env.PUBLIC_UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = import.meta.env.PUBLIC_UPSTASH_REDIS_REST_TOKEN;

interface LikeButtonProps {
  slug: string;
  label?: string;
}

function getLikedSlugs(): Set<string> {
  try {
    const stored = localStorage.getItem('liked_slugs');
    return new Set(stored ? JSON.parse(stored) : []);
  } catch {
    return new Set();
  }
}

function setLikedSlug(slug: string, isLiked: boolean) {
  try {
    const liked = getLikedSlugs();
    if (isLiked) {
      liked.add(slug);
    } else {
      liked.delete(slug);
    }
    localStorage.setItem('liked_slugs', JSON.stringify([...liked]));
  } catch {
    /* ignore */
  }
}

async function redisCmd(cmd: string, key: string): Promise<number> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return 0;
  try {
    const res = await fetch(`${UPSTASH_URL}/${cmd}/${key}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
    const data = await res.json();
    return parseInt(data.result, 10) || 0;
  } catch {
    return 0;
  }
}

export default function LikeButton({ slug, label }: LikeButtonProps) {
  const [count, setCount] = useState<number | null>(null);
  const [liked, setLiked] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [busy, setBusy] = useState(false);

  const redisKey = `likes:${slug}`;

  useEffect(() => {
    setLiked(getLikedSlugs().has(slug));
    redisCmd('get', redisKey).then(setCount);
  }, [slug, redisKey]);

  const handleToggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setAnimating(true);

    const willLike = !liked;
    setLiked(willLike);
    setCount(prev => Math.max(0, (prev ?? 0) + (willLike ? 1 : -1)));
    setLikedSlug(slug, willLike);

    const newCount = await redisCmd(willLike ? 'incr' : 'decr', redisKey);
    if (newCount >= 0) {
      setCount(newCount);
    }

    setTimeout(() => setAnimating(false), 600);
    setBusy(false);
  }, [liked, busy, slug, redisKey]);

  return (
    <button
      onClick={handleToggle}
      disabled={busy}
      className={`group inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm
                  transition-all duration-300 select-none cursor-pointer
                  ${liked
                    ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/10'
                    : 'glass text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 border border-transparent'
                  }`}
      title={liked ? 'Unlike' : 'Like this'}
    >
      <svg
        className={`w-4 h-4 transition-transform duration-300 ${animating ? 'scale-125' : ''} ${liked ? 'fill-rose-400' : 'fill-none group-hover:fill-rose-400/30'}`}
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={liked ? 0 : 2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
      <span>
        {count !== null ? count : '\u00B7\u00B7\u00B7'}
        {label && <span className="ml-1 hidden sm:inline">{liked ? 'Liked' : label}</span>}
      </span>
    </button>
  );
}
