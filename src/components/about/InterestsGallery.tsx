import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface GalleryItem {
  id: string;
  title: string;
  description: string;
  image: string;
  category: string;
}

const galleryItems: GalleryItem[] = [
  {
    id: '1',
    title: 'Homemade Pizza',
    description: 'Weekend pizza making with sourdough crust and fresh toppings.',
    image: '/images/interests/pizza.jpg',
    category: 'Cooking'
  },
  {
    id: '2',
    title: 'South Indian Thali',
    description: 'Exploring the diverse flavors of South Indian cuisine.',
    image: '/images/interests/thali.jpg',
    category: 'Cooking'
  },
  {
    id: '3',
    title: 'Mechanical Keyboards',
    description: 'Custom mechanical keyboard builds with Cherry MX switches.',
    image: '/images/interests/keyboard.jpg',
    category: 'Tech'
  },
  {
    id: '4',
    title: 'Travel Photography',
    description: 'Capturing moments from travels around the world.',
    image: '/images/interests/travel.jpg',
    category: 'Photography'
  },
];

export default function InterestsGallery() {
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
  const [filter, setFilter] = useState<string>('All');

  const categories = ['All', ...new Set(galleryItems.map(item => item.category))];
  const filteredItems = filter === 'All'
    ? galleryItems
    : galleryItems.filter(item => item.category === filter);

  return (
    <div className="space-y-6">
      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setFilter(category)}
            className={`px-4 py-2 rounded-full text-sm transition-all ${
              filter === category
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredItems.map((item) => (
          <motion.div
            key={item.id}
            layoutId={item.id}
            onClick={() => setSelectedItem(item)}
            className="cursor-pointer group"
          >
            <div className="relative aspect-square rounded-xl overflow-hidden glass">
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-0 bg-zinc-700/50 flex items-center justify-center">
                <svg className="w-12 h-12 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{item.title}</p>
                <p className="text-xs text-zinc-300">{item.category}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {selectedItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            <motion.div
              layoutId={selectedItem.id}
              className="fixed inset-4 md:inset-12 lg:inset-24 z-50 glass-strong rounded-2xl overflow-hidden flex flex-col md:flex-row"
            >
              <div className="flex-1 bg-zinc-800/50 flex items-center justify-center p-8">
                <div className="w-full h-full rounded-xl bg-zinc-700/50 flex items-center justify-center">
                  <svg className="w-24 h-24 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div className="md:w-80 p-6 flex flex-col">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="self-end p-2 rounded-lg hover:bg-zinc-700/50 transition-colors mb-4"
                >
                  <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm w-fit mb-4">
                  {selectedItem.category}
                </span>
                <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
                  {selectedItem.title}
                </h2>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  {selectedItem.description}
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
