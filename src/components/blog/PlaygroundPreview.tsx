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
  category = 'Interactive Demo'
}: PlaygroundPreviewProps) {
  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block my-8 group"
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <div className="glass rounded-2xl overflow-hidden border border-zinc-700/50 hover:border-zinc-600/50 transition-colors">
        {/* Preview Image */}
        {image ? (
          <div className="relative h-48 md:h-64 overflow-hidden">
            <img
              src={image}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/80 to-transparent" />
          </div>
        ) : (
          <div className="relative h-48 md:h-64 bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
            <div className="text-6xl opacity-30">
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/80 to-transparent" />
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
              {category}
            </span>
            <span className="text-xs text-zinc-500">Click to explore</span>
          </div>

          <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2 group-hover:text-emerald-400 transition-colors">
            {title}
          </h3>

          <p className="text-zinc-400 text-sm leading-relaxed mb-4">
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
