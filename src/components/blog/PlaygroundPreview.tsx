import { useState } from 'react';
import { motion } from 'framer-motion';

interface PlaygroundPreviewProps {
  title: string;
  description: string;
  href: string;
  image?: string;
  category?: string;
}

export default function PlaygroundPreview({
  title,
  description,
  href,
  image,
  category = 'Algorithm Animation'
}: PlaygroundPreviewProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Use iframe for live preview if href is a local playground path
  const isLocal = href.startsWith('/');

  return (
    <motion.a
      href={href}
      className="block my-8 group not-prose"
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      <div className="glass rounded-2xl overflow-hidden border border-zinc-700/50 hover:border-emerald-500/30 transition-colors">
        {/* Live Preview via iframe */}
        <div className="relative h-56 md:h-72 overflow-hidden bg-zinc-900">
          {isLocal && !image ? (
            <>
              {!iframeLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                  <div className="w-6 h-6 border-2 border-zinc-600 border-t-emerald-400 rounded-full animate-spin" />
                </div>
              )}
              <iframe
                src={href}
                title={title}
                className={`w-full h-full border-0 pointer-events-none transition-opacity duration-500 ${iframeLoaded ? 'opacity-100' : 'opacity-0'}`}
                loading="lazy"
                onLoad={() => setIframeLoaded(true)}
                style={{ transform: 'scale(0.75)', transformOrigin: 'top left', width: '133.33%', height: '133.33%' }}
              />
            </>
          ) : image ? (
            <img
              src={image}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <svg className="w-16 h-16 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/90 via-transparent to-transparent pointer-events-none" />
          {/* Play overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 backdrop-blur-sm flex items-center justify-center border border-emerald-500/30">
              <svg className="w-6 h-6 text-emerald-400 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
              {category}
            </span>
            <span className="text-xs text-zinc-500">Click to explore</span>
          </div>

          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1 group-hover:text-emerald-400 transition-colors">
            {title}
          </h3>

          <p className="text-zinc-400 text-sm leading-relaxed mb-3">
            {description}
          </p>

          <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
            <span>Try it now</span>
            <svg
              className="w-4 h-4 transform group-hover:translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
        </div>
      </div>
    </motion.a>
  );
}
