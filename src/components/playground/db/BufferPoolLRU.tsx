import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Page {
  id: number;
  accessCount: number;
  isHot: boolean;
  lastAccess: number;
}

const TOTAL_SLOTS = 16;
const HOT_RATIO = 5 / 8; // Top 5/8 is "new" sublist
const COLD_RATIO = 3 / 8; // Bottom 3/8 is "old" sublist

export default function BufferPoolLRU() {
  const [pages, setPages] = useState<Page[]>([]);
  const [nextPageId, setNextPageId] = useState(1);
  const [accessLog, setAccessLog] = useState<string[]>([]);
  const [isAutoRunning, setIsAutoRunning] = useState(false);

  const hotSlots = Math.floor(TOTAL_SLOTS * HOT_RATIO);
  const coldSlots = TOTAL_SLOTS - hotSlots;

  const addToLog = (message: string) => {
    setAccessLog(prev => [message, ...prev].slice(0, 10));
  };

  const accessPage = useCallback((pageId: number) => {
    setPages(prev => {
      const existingIndex = prev.findIndex(p => p.id === pageId);

      if (existingIndex !== -1) {
        // Page hit - move to front of hot list if accessed enough
        const page = prev[existingIndex];
        const newPages = prev.filter((_, i) => i !== existingIndex);
        const updatedPage = {
          ...page,
          accessCount: page.accessCount + 1,
          lastAccess: Date.now(),
          isHot: page.accessCount >= 1 // Promote after 2nd access
        };

        if (updatedPage.isHot) {
          addToLog(`Page ${pageId} promoted to HOT sublist`);
          return [updatedPage, ...newPages];
        } else {
          addToLog(`Page ${pageId} accessed in COLD sublist`);
          // Keep in cold area but refresh position
          const hotPages = newPages.filter(p => p.isHot);
          const coldPages = newPages.filter(p => !p.isHot);
          return [...hotPages, updatedPage, ...coldPages];
        }
      } else {
        // Page miss - insert at midpoint (head of cold list)
        addToLog(`Page ${pageId} loaded → COLD sublist (midpoint insertion)`);
        const newPage: Page = {
          id: pageId,
          accessCount: 0,
          isHot: false,
          lastAccess: Date.now()
        };

        const hotPages = prev.filter(p => p.isHot);
        const coldPages = prev.filter(p => !p.isHot);
        let allPages = [...hotPages, newPage, ...coldPages];

        // Evict if over capacity
        if (allPages.length > TOTAL_SLOTS) {
          const evicted = allPages[allPages.length - 1];
          addToLog(`Page ${evicted.id} evicted (LRU)`);
          allPages = allPages.slice(0, TOTAL_SLOTS);
        }

        return allPages;
      }
    });
  }, []);

  const loadNewPage = () => {
    accessPage(nextPageId);
    setNextPageId(prev => prev + 1);
  };

  const accessRandomPage = () => {
    if (pages.length === 0) return;
    const randomPage = pages[Math.floor(Math.random() * pages.length)];
    accessPage(randomPage.id);
  };

  const simulateTableScan = () => {
    addToLog('--- Starting Table Scan ---');
    let scanId = nextPageId;
    const scanPages = 8;

    for (let i = 0; i < scanPages; i++) {
      setTimeout(() => {
        accessPage(scanId + i);
      }, i * 300);
    }
    setNextPageId(prev => prev + scanPages);
  };

  const clear = () => {
    setPages([]);
    setNextPageId(1);
    setAccessLog([]);
  };

  const hotPages = pages.filter(p => p.isHot);
  const coldPages = pages.filter(p => !p.isHot);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">InnoDB Buffer Pool LRU</h2>
        <p className="text-gray-400 text-sm">
          Midpoint insertion strategy prevents table scans from flushing hot pages
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={loadNewPage}
          className="btn-primary text-sm"
        >
          Load New Page
        </button>
        <button
          onClick={accessRandomPage}
          className="btn-glass text-sm"
          disabled={pages.length === 0}
        >
          Access Random
        </button>
        <button
          onClick={simulateTableScan}
          className="btn-glass text-sm"
        >
          Simulate Table Scan
        </button>
        <button
          onClick={clear}
          className="btn-glass text-sm text-red-400"
        >
          Clear
        </button>
      </div>

      {/* Buffer Pool Visualization */}
      <div className="glass-strong p-6 rounded-2xl">
        <div className="flex gap-8">
          {/* Hot Sublist (New) */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm font-medium text-white">HOT Sublist (5/8)</span>
              <span className="text-xs text-gray-500">Frequently accessed</span>
            </div>
            <div className="grid grid-cols-5 gap-2 min-h-[120px]">
              <AnimatePresence mode="popLayout">
                {hotPages.map((page, i) => (
                  <motion.div
                    key={page.id}
                    layout
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    onClick={() => accessPage(page.id)}
                    className="aspect-square rounded-lg bg-green-500/20 border border-green-500/50
                               flex flex-col items-center justify-center cursor-pointer
                               hover:bg-green-500/30 transition-colors"
                  >
                    <span className="text-green-400 font-mono text-sm">P{page.id}</span>
                    <span className="text-xs text-gray-500">×{page.accessCount + 1}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {Array.from({ length: hotSlots - hotPages.length }).map((_, i) => (
                <div
                  key={`empty-hot-${i}`}
                  className="aspect-square rounded-lg border border-dashed border-gray-700
                             flex items-center justify-center"
                >
                  <span className="text-gray-700 text-xs">empty</span>
                </div>
              ))}
            </div>
          </div>

          {/* Midpoint Indicator */}
          <div className="flex flex-col items-center justify-center">
            <div className="w-px h-full bg-gradient-to-b from-green-500 via-yellow-500 to-red-500"></div>
            <span className="text-xs text-yellow-400 my-2 rotate-0">← Midpoint</span>
            <div className="w-px h-full bg-gradient-to-b from-yellow-500 to-red-500"></div>
          </div>

          {/* Cold Sublist (Old) */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-sm font-medium text-white">COLD Sublist (3/8)</span>
              <span className="text-xs text-gray-500">Recently loaded</span>
            </div>
            <div className="grid grid-cols-3 gap-2 min-h-[120px]">
              <AnimatePresence mode="popLayout">
                {coldPages.map((page, i) => (
                  <motion.div
                    key={page.id}
                    layout
                    initial={{ scale: 0, opacity: 0, x: -20 }}
                    animate={{ scale: 1, opacity: 1, x: 0 }}
                    exit={{ scale: 0, opacity: 0, x: 20 }}
                    onClick={() => accessPage(page.id)}
                    className="aspect-square rounded-lg bg-blue-500/20 border border-blue-500/50
                               flex flex-col items-center justify-center cursor-pointer
                               hover:bg-blue-500/30 transition-colors"
                  >
                    <span className="text-blue-400 font-mono text-sm">P{page.id}</span>
                    <span className="text-xs text-gray-500">×{page.accessCount + 1}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {Array.from({ length: coldSlots - coldPages.length }).map((_, i) => (
                <div
                  key={`empty-cold-${i}`}
                  className="aspect-square rounded-lg border border-dashed border-gray-700
                             flex items-center justify-center"
                >
                  <span className="text-gray-700 text-xs">empty</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Eviction Zone */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-xs text-gray-400">
              Pages at the tail of COLD sublist are evicted first (LRU)
            </span>
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="glass p-4 rounded-xl">
        <h3 className="text-sm font-medium text-white mb-2">Activity Log</h3>
        <div className="space-y-1 font-mono text-xs max-h-40 overflow-y-auto">
          <AnimatePresence>
            {accessLog.map((log, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`${
                  log.includes('promoted') ? 'text-green-400' :
                  log.includes('evicted') ? 'text-red-400' :
                  log.includes('Table Scan') ? 'text-yellow-400' :
                  'text-gray-400'
                }`}
              >
                {log}
              </motion.div>
            ))}
          </AnimatePresence>
          {accessLog.length === 0 && (
            <span className="text-gray-600">No activity yet. Load some pages!</span>
          )}
        </div>
      </div>

      {/* Explanation */}
      <div className="glass p-4 rounded-xl text-sm text-gray-400">
        <h3 className="font-medium text-white mb-2">How it works:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>New pages are inserted at the <span className="text-yellow-400">midpoint</span> (head of COLD sublist)</li>
          <li>Pages are promoted to HOT sublist after repeated access</li>
          <li>Table scans only affect the COLD sublist, preserving hot pages</li>
          <li>Eviction happens from the tail of the COLD sublist (true LRU)</li>
        </ul>
      </div>
    </div>
  );
}
