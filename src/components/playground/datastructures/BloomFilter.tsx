import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Simple hash functions for demonstration
function hash1(str: string, size: number): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % size;
}

function hash2(str: string, size: number): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % size;
}

function hash3(str: string, size: number): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 6) + (hash << 16) - hash);
  }
  return Math.abs(hash) % size;
}

interface QueryResult {
  item: string;
  positions: number[];
  result: 'probably_yes' | 'definitely_no';
  isFalsePositive?: boolean;
}

export default function BloomFilter() {
  const [filterSize, setFilterSize] = useState(32);
  const [bitArray, setBitArray] = useState<boolean[]>(() => new Array(32).fill(false));
  const [insertedItems, setInsertedItems] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [queryValue, setQueryValue] = useState('');
  const [lastQuery, setLastQuery] = useState<QueryResult | null>(null);
  const [highlightedBits, setHighlightedBits] = useState<number[]>([]);
  const [stats, setStats] = useState({ queries: 0, falsePositives: 0 });

  const hashFunctions = useMemo(() => [
    (s: string) => hash1(s, filterSize),
    (s: string) => hash2(s, filterSize),
    (s: string) => hash3(s, filterSize),
  ], [filterSize]);

  const getPositions = useCallback((item: string): number[] => {
    return hashFunctions.map(fn => fn(item));
  }, [hashFunctions]);

  const insertItem = useCallback(() => {
    if (!inputValue.trim()) return;
    const item = inputValue.trim().toLowerCase();

    if (insertedItems.includes(item)) {
      setInputValue('');
      return;
    }

    const positions = getPositions(item);
    setBitArray(prev => {
      const newArray = [...prev];
      positions.forEach(pos => {
        newArray[pos] = true;
      });
      return newArray;
    });
    setInsertedItems(prev => [...prev, item]);
    setHighlightedBits(positions);
    setInputValue('');

    setTimeout(() => setHighlightedBits([]), 1500);
  }, [inputValue, insertedItems, getPositions]);

  const queryItem = useCallback(() => {
    if (!queryValue.trim()) return;
    const item = queryValue.trim().toLowerCase();

    const positions = getPositions(item);
    const allBitsSet = positions.every(pos => bitArray[pos]);

    const isFalsePositive = allBitsSet && !insertedItems.includes(item);

    const result: QueryResult = {
      item,
      positions,
      result: allBitsSet ? 'probably_yes' : 'definitely_no',
      isFalsePositive
    };

    setLastQuery(result);
    setHighlightedBits(positions);
    setStats(prev => ({
      queries: prev.queries + 1,
      falsePositives: prev.falsePositives + (isFalsePositive ? 1 : 0)
    }));
    setQueryValue('');

    setTimeout(() => setHighlightedBits([]), 2000);
  }, [queryValue, bitArray, insertedItems, getPositions]);

  const resetFilter = () => {
    setBitArray(new Array(filterSize).fill(false));
    setInsertedItems([]);
    setLastQuery(null);
    setHighlightedBits([]);
    setStats({ queries: 0, falsePositives: 0 });
  };

  const resizeFilter = (newSize: number) => {
    setFilterSize(newSize);
    setBitArray(new Array(newSize).fill(false));
    setInsertedItems([]);
    setLastQuery(null);
    setHighlightedBits([]);
  };

  const fillRate = bitArray.filter(b => b).length / filterSize;
  const estimatedFalsePositiveRate = Math.pow(fillRate, 3) * 100;

  const presetWords = ['uber', 'lyft', 'driver', 'rider', 'trip', 'fare', 'pickup', 'dropoff'];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-strong rounded-xl p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Insert Item</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && insertItem()}
              placeholder="Enter a word..."
              className="flex-1 px-4 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-[var(--text-primary)] placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />
            <button
              onClick={insertItem}
              className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30 transition-all"
            >
              Insert
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {presetWords.filter(w => !insertedItems.includes(w)).slice(0, 4).map(word => (
              <button
                key={word}
                onClick={() => setInputValue(word)}
                className="px-2 py-1 text-xs rounded bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50"
              >
                {word}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-strong rounded-xl p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Query Item</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={queryValue}
              onChange={(e) => setQueryValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && queryItem()}
              placeholder="Check if exists..."
              className="flex-1 px-4 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-[var(--text-primary)] placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />
            <button
              onClick={queryItem}
              className="px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/30 transition-all"
            >
              Query
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-xs text-zinc-500">Try:</span>
            {['taxi', 'car', 'bus'].map(word => (
              <button
                key={word}
                onClick={() => setQueryValue(word)}
                className="px-2 py-1 text-xs rounded bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50"
              >
                {word}
              </button>
            ))}
            {insertedItems.slice(0, 2).map(word => (
              <button
                key={word}
                onClick={() => setQueryValue(word)}
                className="px-2 py-1 text-xs rounded bg-emerald-500/20 text-emerald-400"
              >
                {word}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Query Result */}
      <AnimatePresence>
        {lastQuery && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`glass-strong rounded-xl p-6 border ${
              lastQuery.result === 'definitely_no'
                ? 'border-red-500/50'
                : lastQuery.isFalsePositive
                ? 'border-yellow-500/50'
                : 'border-emerald-500/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[var(--text-muted)]">Query: </span>
                <span className="font-mono text-[var(--text-primary)]">"{lastQuery.item}"</span>
                <span className="text-[var(--text-muted)] mx-2">→</span>
                <span className="text-[var(--text-muted)]">Hash positions: </span>
                <span className="font-mono text-blue-400">[{lastQuery.positions.join(', ')}]</span>
              </div>
              <div className={`px-4 py-2 rounded-lg font-medium ${
                lastQuery.result === 'definitely_no'
                  ? 'bg-red-500/20 text-red-400'
                  : lastQuery.isFalsePositive
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {lastQuery.result === 'definitely_no' && 'Definitely NOT in set'}
                {lastQuery.result === 'probably_yes' && !lastQuery.isFalsePositive && 'Probably in set ✓'}
                {lastQuery.result === 'probably_yes' && lastQuery.isFalsePositive && 'FALSE POSITIVE!'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bit Array Visualization */}
      <div className="glass-strong rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Bit Array ({filterSize} bits)
          </h3>
          <div className="flex items-center gap-4">
            <select
              value={filterSize}
              onChange={(e) => resizeFilter(Number(e.target.value))}
              className="px-3 py-1 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-sm text-[var(--text-primary)]"
            >
              <option value={16}>16 bits</option>
              <option value={32}>32 bits</option>
              <option value={64}>64 bits</option>
            </select>
            <button
              onClick={resetFilter}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 justify-center">
          {bitArray.map((bit, index) => (
            <motion.div
              key={index}
              animate={{
                scale: highlightedBits.includes(index) ? 1.2 : 1,
                backgroundColor: bit
                  ? highlightedBits.includes(index)
                    ? '#22c55e'
                    : '#3b82f6'
                  : highlightedBits.includes(index)
                  ? '#ef4444'
                  : '#27272a'
              }}
              className="w-8 h-8 rounded flex items-center justify-center text-xs font-mono"
              style={{ color: bit ? '#fff' : '#71717a' }}
            >
              {index}
            </motion.div>
          ))}
        </div>

        <div className="flex justify-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span className="text-zinc-400">Set (1)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-zinc-700" />
            <span className="text-zinc-400">Unset (0)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <span className="text-zinc-400">Just hashed</span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Inserted Items */}
        <div className="glass-strong rounded-xl p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Inserted Items ({insertedItems.length})
          </h3>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {insertedItems.map((item, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm"
              >
                {item}
              </span>
            ))}
            {insertedItems.length === 0 && (
              <span className="text-zinc-500 text-sm">No items inserted yet</span>
            )}
          </div>
        </div>

        {/* Statistics */}
        <div className="glass-strong rounded-xl p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Statistics</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-zinc-400">Fill Rate</span>
              <span className="text-[var(--text-primary)] font-mono">
                {(fillRate * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${fillRate * 100}%` }}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Est. False Positive Rate</span>
              <span className="text-yellow-400 font-mono">
                ~{estimatedFalsePositiveRate.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Total Queries</span>
              <span className="text-[var(--text-primary)] font-mono">{stats.queries}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">False Positives</span>
              <span className="text-red-400 font-mono">{stats.falsePositives}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">How Bloom Filters Work</h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="p-4 rounded-lg bg-zinc-800/30">
            <div className="font-mono text-emerald-400 mb-2">Insert</div>
            <p className="text-[var(--text-secondary)]">
              Hash the item with k hash functions. Set those k bit positions to 1.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-zinc-800/30">
            <div className="font-mono text-emerald-400 mb-2">Query</div>
            <p className="text-[var(--text-secondary)]">
              Hash and check k positions. If ANY is 0 → definitely not in set. If ALL are 1 → probably in set.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-zinc-800/30">
            <div className="font-mono text-emerald-400 mb-2">Trade-off</div>
            <p className="text-[var(--text-secondary)]">
              Space-efficient but allows false positives. No false negatives. Cannot delete items.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
