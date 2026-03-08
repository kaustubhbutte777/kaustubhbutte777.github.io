import { useState, useEffect } from 'react';

const UPSTASH_URL = import.meta.env.PUBLIC_UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = import.meta.env.PUBLIC_UPSTASH_REDIS_REST_TOKEN;

interface ViewCounterProps {
  slug: string;
}

export default function ViewCounter({ slug }: ViewCounterProps) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return;

    const key = encodeURIComponent(`views:${slug}`);
    const sessionKey = `viewed:${slug}`;

    // Only increment once per session
    const alreadyViewed = sessionStorage.getItem(sessionKey);
    const cmd = alreadyViewed ? 'get' : 'incr';

    fetch(`${UPSTASH_URL}/${cmd}/${key}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    })
      .then(res => res.json())
      .then(data => {
        const val = parseInt(data.result, 10) || 0;
        setCount(val);
        if (!alreadyViewed) {
          sessionStorage.setItem(sessionKey, '1');
        }
      })
      .catch(() => {});
  }, [slug]);

  if (count === null) return null;

  return (
    <span className="inline-flex items-center gap-1 text-[var(--text-muted)]">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
      {count} {count === 1 ? 'view' : 'views'}
    </span>
  );
}
