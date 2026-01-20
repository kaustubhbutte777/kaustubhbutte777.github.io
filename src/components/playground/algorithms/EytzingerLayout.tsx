import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchStep {
  index: number;
  value: number;
  comparison: 'less' | 'greater' | 'equal';
  direction: 'left' | 'right' | 'found';
  cacheHit: boolean;
  cacheLine: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  linesLoaded: Set<number>;
}

// Simulate cache behavior
const CACHE_LINE_SIZE = 4; // Elements per cache line (simplified for visualization)

function getCacheLine(index: number): number {
  return Math.floor(index / CACHE_LINE_SIZE);
}

function simulateCacheAccess(
  index: number,
  loadedLines: Set<number>
): { hit: boolean; line: number } {
  const line = getCacheLine(index);
  const hit = loadedLines.has(line);
  if (!hit) {
    loadedLines.add(line);
  }
  return { hit, line };
}

// Convert sorted array to Eytzinger layout
function buildEytzinger(sorted: number[]): number[] {
  const n = sorted.length;
  const eytzinger = new Array(n + 1).fill(0); // 1-indexed
  let sortedIdx = 0;

  function fill(k: number) {
    if (k <= n) {
      fill(2 * k); // left child
      eytzinger[k] = sorted[sortedIdx++];
      fill(2 * k + 1); // right child
    }
  }

  fill(1);
  return eytzinger;
}

// Binary search on Eytzinger layout with cache simulation
function eytzingerSearch(arr: number[], target: number): { steps: SearchStep[]; stats: CacheStats } {
  const steps: SearchStep[] = [];
  const loadedLines = new Set<number>();
  let hits = 0;
  let misses = 0;
  let k = 1;
  const n = arr.length - 1;

  while (k <= n) {
    const value = arr[k];
    const { hit, line } = simulateCacheAccess(k, loadedLines);
    if (hit) hits++;
    else misses++;

    let comparison: 'less' | 'greater' | 'equal';
    let direction: 'left' | 'right' | 'found';

    if (target === value) {
      comparison = 'equal';
      direction = 'found';
      steps.push({ index: k, value, comparison, direction, cacheHit: hit, cacheLine: line });
      break;
    } else if (target < value) {
      comparison = 'less';
      direction = 'left';
      steps.push({ index: k, value, comparison, direction, cacheHit: hit, cacheLine: line });
      k = 2 * k; // go left
    } else {
      comparison = 'greater';
      direction = 'right';
      steps.push({ index: k, value, comparison, direction, cacheHit: hit, cacheLine: line });
      k = 2 * k + 1; // go right
    }
  }

  return { steps, stats: { hits, misses, linesLoaded: loadedLines } };
}

// Standard binary search with cache simulation
function standardBinarySearch(arr: number[], target: number): { steps: SearchStep[]; stats: CacheStats } {
  const steps: SearchStep[] = [];
  const loadedLines = new Set<number>();
  let hits = 0;
  let misses = 0;
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const value = arr[mid];
    const { hit, line } = simulateCacheAccess(mid, loadedLines);
    if (hit) hits++;
    else misses++;

    let comparison: 'less' | 'greater' | 'equal';
    let direction: 'left' | 'right' | 'found';

    if (target === value) {
      comparison = 'equal';
      direction = 'found';
      steps.push({ index: mid, value, comparison, direction, cacheHit: hit, cacheLine: line });
      break;
    } else if (target < value) {
      comparison = 'less';
      direction = 'left';
      steps.push({ index: mid, value, comparison, direction, cacheHit: hit, cacheLine: line });
      right = mid - 1;
    } else {
      comparison = 'greater';
      direction = 'right';
      steps.push({ index: mid, value, comparison, direction, cacheHit: hit, cacheLine: line });
      left = mid + 1;
    }
  }

  return { steps, stats: { hits, misses, linesLoaded: loadedLines } };
}

// Calculate tree depth
function getTreeDepth(n: number): number {
  return Math.floor(Math.log2(n)) + 1;
}

// Get nodes at each level
function getNodesAtLevel(level: number, n: number): number[] {
  const start = Math.pow(2, level);
  const end = Math.min(Math.pow(2, level + 1) - 1, n);
  const nodes: number[] = [];
  for (let i = start; i <= end; i++) {
    nodes.push(i);
  }
  return nodes;
}

// Calculate node position in the tree
function getNodePosition(nodeIdx: number, treeDepth: number, svgWidth: number): { x: number; y: number } {
  const level = Math.floor(Math.log2(nodeIdx));
  const positionInLevel = nodeIdx - Math.pow(2, level);
  const nodesAtThisLevel = Math.pow(2, level);

  // Calculate x position: divide the width evenly for nodes at this level
  const spacing = svgWidth / nodesAtThisLevel;
  const x = spacing * positionInLevel + spacing / 2;

  // Calculate y position based on level
  const y = level * 80 + 40;

  return { x, y };
}

// Tree Visualization Component
function TreeVisualization({
  arraySize,
  treeDepth,
  eytzingerArray,
  searchSteps,
  currentStep,
}: {
  arraySize: number;
  treeDepth: number;
  eytzingerArray: number[];
  searchSteps: SearchStep[];
  currentStep: number;
}) {
  const svgWidth = Math.max(800, Math.pow(2, treeDepth - 1) * 100);
  const svgHeight = treeDepth * 80 + 60;

  // Pre-calculate all node positions
  const nodePositions = useMemo(() => {
    const positions: Record<number, { x: number; y: number }> = {};
    for (let i = 1; i <= arraySize; i++) {
      positions[i] = getNodePosition(i, treeDepth, svgWidth);
    }
    return positions;
  }, [arraySize, treeDepth, svgWidth]);

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="w-full min-w-[600px]"
      style={{ maxHeight: '350px' }}
    >
      {/* Draw edges first (so they appear behind nodes) */}
      {Array.from({ length: arraySize }, (_, i) => i + 1).map((nodeIdx) => {
        const pos = nodePositions[nodeIdx];
        const leftChild = 2 * nodeIdx;
        const rightChild = 2 * nodeIdx + 1;

        return (
          <g key={`edges-${nodeIdx}`}>
            {leftChild <= arraySize && nodePositions[leftChild] && (
              <line
                x1={pos.x}
                y1={pos.y + 20}
                x2={nodePositions[leftChild].x}
                y2={nodePositions[leftChild].y - 20}
                stroke="var(--svg-stroke)"
                strokeWidth="1.5"
              />
            )}
            {rightChild <= arraySize && nodePositions[rightChild] && (
              <line
                x1={pos.x}
                y1={pos.y + 20}
                x2={nodePositions[rightChild].x}
                y2={nodePositions[rightChild].y - 20}
                stroke="var(--svg-stroke)"
                strokeWidth="1.5"
              />
            )}
          </g>
        );
      })}

      {/* Draw nodes */}
      {Array.from({ length: arraySize }, (_, i) => i + 1).map((nodeIdx) => {
        const pos = nodePositions[nodeIdx];
        const value = eytzingerArray[nodeIdx];
        const isVisited = searchSteps.slice(0, currentStep + 1).some((s) => s.index === nodeIdx);
        const isCurrent = searchSteps[currentStep]?.index === nodeIdx;
        const isFound = searchSteps[currentStep]?.direction === 'found' && isCurrent;

        return (
          <g key={nodeIdx}>
            <motion.circle
              cx={pos.x}
              cy={pos.y}
              r={18}
              fill={isFound ? '#22c55e' : isCurrent ? '#3b82f6' : isVisited ? '#6366f1' : 'var(--glass-bg)'}
              stroke={isVisited ? '#818cf8' : 'var(--svg-stroke)'}
              strokeWidth="2"
              initial={false}
              animate={{
                scale: isCurrent ? 1.2 : 1,
              }}
              transition={{ duration: 0.3 }}
            />
            <text
              x={pos.x}
              y={pos.y + 5}
              textAnchor="middle"
              className="text-sm font-semibold"
              fill={isVisited ? 'white' : 'var(--text-primary)'}
            >
              {value}
            </text>
            <text
              x={pos.x}
              y={pos.y + 35}
              textAnchor="middle"
              className="text-xs"
              fill="var(--text-muted)"
            >
              [{nodeIdx}]
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function EytzingerLayout() {
  const [arraySize, setArraySize] = useState(15);
  const [searchTarget, setSearchTarget] = useState(7);
  const [isSearching, setIsSearching] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [searchSteps, setSearchSteps] = useState<SearchStep[]>([]);
  const [standardSteps, setStandardSteps] = useState<SearchStep[]>([]);
  const [eytzingerStats, setEytzingerStats] = useState<CacheStats | null>(null);
  const [standardStats, setStandardStats] = useState<CacheStats | null>(null);
  const [showComparison, setShowComparison] = useState(true);

  // Generate sorted array
  const sortedArray = useMemo(() => {
    return Array.from({ length: arraySize }, (_, i) => i + 1);
  }, [arraySize]);

  // Build Eytzinger layout
  const eytzingerArray = useMemo(() => {
    return buildEytzinger(sortedArray);
  }, [sortedArray]);

  const treeDepth = useMemo(() => getTreeDepth(arraySize), [arraySize]);

  // Calculate total cache lines for each array
  const totalCacheLines = Math.ceil((arraySize + 1) / CACHE_LINE_SIZE);

  const runSearch = useCallback(() => {
    const eResult = eytzingerSearch(eytzingerArray, searchTarget);
    const sResult = standardBinarySearch(sortedArray, searchTarget);
    setSearchSteps(eResult.steps);
    setStandardSteps(sResult.steps);
    setEytzingerStats(eResult.stats);
    setStandardStats(sResult.stats);
    setIsSearching(true);
    setCurrentStep(0);

    // Animate through steps
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step >= Math.max(eResult.steps.length, sResult.steps.length)) {
        clearInterval(interval);
      } else {
        setCurrentStep(step);
      }
    }, 800);
  }, [eytzingerArray, sortedArray, searchTarget]);

  const reset = useCallback(() => {
    setIsSearching(false);
    setCurrentStep(-1);
    setSearchSteps([]);
    setStandardSteps([]);
    setEytzingerStats(null);
    setStandardStats(null);
  }, []);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="glass-strong rounded-xl p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm text-[var(--text-secondary)]">Array Size:</label>
            <select
              value={arraySize}
              onChange={(e) => {
                setArraySize(Number(e.target.value));
                reset();
              }}
              className="px-3 py-1.5 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-primary)]"
            >
              {[7, 15, 31, 63, 127].map((size) => (
                <option key={size} value={size}>
                  {size} elements ({Math.floor(Math.log2(size)) + 1} levels)
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-[var(--text-secondary)]">Search for:</label>
            <input
              type="number"
              min={1}
              max={arraySize}
              value={searchTarget}
              onChange={(e) => {
                setSearchTarget(Number(e.target.value));
                reset();
              }}
              className="w-20 px-3 py-1.5 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-primary)]"
            />
          </div>

          <button
            onClick={isSearching ? reset : runSearch}
            className="px-4 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
          >
            {isSearching ? 'Reset' : 'Search'}
          </button>

          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={showComparison}
              onChange={(e) => setShowComparison(e.target.checked)}
              className="rounded"
            />
            Show comparison
          </label>
        </div>
      </div>

      {/* Explanation */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">How Eytzinger Layout Works</h3>
        <div className="text-sm text-[var(--text-secondary)] space-y-2">
          <p>
            The Eytzinger layout arranges a sorted array as an implicit binary search tree in BFS order.
            This improves cache performance because elements accessed together are stored near each other.
          </p>
          <div className="flex flex-wrap gap-4 mt-3 font-mono text-xs">
            <span className="px-2 py-1 rounded bg-zinc-700/30">Root at index 1</span>
            <span className="px-2 py-1 rounded bg-zinc-700/30">Left child = 2k</span>
            <span className="px-2 py-1 rounded bg-zinc-700/30">Right child = 2k + 1</span>
            <span className="px-2 py-1 rounded bg-zinc-700/30">Parent = k/2</span>
          </div>
        </div>
      </div>

      {/* Tree Visualization */}
      <div className="glass-strong rounded-xl p-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Eytzinger Tree Structure</h3>
        <div className="overflow-x-auto">
          <TreeVisualization
            arraySize={arraySize}
            treeDepth={treeDepth}
            eytzingerArray={eytzingerArray}
            searchSteps={searchSteps}
            currentStep={currentStep}
          />
        </div>
      </div>

      {/* Cache Statistics */}
      <AnimatePresence>
        {isSearching && eytzingerStats && standardStats && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid md:grid-cols-2 gap-4"
          >
            {/* Eytzinger Cache Stats */}
            <div className="glass-strong rounded-xl p-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Eytzinger Cache Performance</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{eytzingerStats.hits}</div>
                  <div className="text-xs text-[var(--text-muted)]">Cache Hits</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">{eytzingerStats.misses}</div>
                  <div className="text-xs text-[var(--text-muted)]">Cache Misses</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{eytzingerStats.linesLoaded.size}</div>
                  <div className="text-xs text-[var(--text-muted)]">Lines Loaded</div>
                </div>
              </div>
              <div className="text-sm text-[var(--text-secondary)]">
                Hit Rate: <span className="font-mono text-green-400">
                  {eytzingerStats.hits + eytzingerStats.misses > 0
                    ? ((eytzingerStats.hits / (eytzingerStats.hits + eytzingerStats.misses)) * 100).toFixed(0)
                    : 0}%
                </span>
              </div>
            </div>

            {/* Standard Cache Stats */}
            {showComparison && (
              <div className="glass-strong rounded-xl p-4">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Standard Cache Performance</h3>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">{standardStats.hits}</div>
                    <div className="text-xs text-[var(--text-muted)]">Cache Hits</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-400">{standardStats.misses}</div>
                    <div className="text-xs text-[var(--text-muted)]">Cache Misses</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">{standardStats.linesLoaded.size}</div>
                    <div className="text-xs text-[var(--text-muted)]">Lines Loaded</div>
                  </div>
                </div>
                <div className="text-sm text-[var(--text-secondary)]">
                  Hit Rate: <span className="font-mono text-green-400">
                    {standardStats.hits + standardStats.misses > 0
                      ? ((standardStats.hits / (standardStats.hits + standardStats.misses)) * 100).toFixed(0)
                      : 0}%
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Memory Layout with Cache Lines */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Eytzinger Memory Layout */}
        <div className="glass-strong rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Eytzinger Memory Layout</h3>
            <span className="text-xs text-[var(--text-muted)]">{CACHE_LINE_SIZE} elements per cache line</span>
          </div>
          <div className="space-y-2">
            {Array.from({ length: totalCacheLines }).map((_, lineIdx) => {
              const startIdx = lineIdx * CACHE_LINE_SIZE;
              const endIdx = Math.min(startIdx + CACHE_LINE_SIZE, arraySize + 1);
              const elementsInLine = eytzingerArray.slice(startIdx, endIdx);
              const isLineLoaded = eytzingerStats?.linesLoaded.has(lineIdx);
              const hasCurrentAccess = searchSteps.slice(0, currentStep + 1).some(
                (s) => getCacheLine(s.index) === lineIdx
              );

              return (
                <div key={lineIdx} className="flex items-center gap-2">
                  <div className={`w-16 text-xs font-mono px-2 py-1 rounded ${
                    isLineLoaded ? 'bg-blue-500/30 text-blue-300' : 'bg-zinc-800/50 text-[var(--text-muted)]'
                  }`}>
                    {isLineLoaded ? 'CACHE' : 'DISK'}
                  </div>
                  <div className={`flex-1 flex gap-0.5 p-1 rounded ${
                    hasCurrentAccess ? 'bg-blue-500/10 ring-1 ring-blue-500/50' : 'bg-zinc-800/30'
                  }`}>
                    {elementsInLine.map((val, i) => {
                      const actualIdx = startIdx + i;
                      if (actualIdx === 0) return <div key={i} className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-muted)]">-</div>;
                      const isVisited = searchSteps.slice(0, currentStep + 1).some((s) => s.index === actualIdx);
                      const isCurrent = searchSteps[currentStep]?.index === actualIdx;
                      const step = searchSteps.find((s) => s.index === actualIdx);

                      return (
                        <motion.div
                          key={i}
                          className={`w-8 h-8 flex items-center justify-center text-xs font-mono rounded ${
                            isCurrent ? 'bg-blue-500 text-white' :
                            isVisited ? (step?.cacheHit ? 'bg-green-500/80 text-white' : 'bg-orange-500/80 text-white') :
                            'bg-zinc-700/30 text-[var(--text-primary)]'
                          }`}
                          initial={false}
                          animate={{ scale: isCurrent ? 1.15 : 1 }}
                          title={`Index ${actualIdx}: ${isVisited ? (step?.cacheHit ? 'Cache HIT' : 'Cache MISS') : ''}`}
                        >
                          {val}
                        </motion.div>
                      );
                    })}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] w-12">L{lineIdx}</div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-green-500/80"></span> Cache Hit
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-orange-500/80"></span> Cache Miss
            </span>
          </div>
        </div>

        {/* Standard Memory Layout */}
        {showComparison && (
          <div className="glass-strong rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Standard Memory Layout</h3>
              <span className="text-xs text-[var(--text-muted)]">{CACHE_LINE_SIZE} elements per cache line</span>
            </div>
            <div className="space-y-2">
              {Array.from({ length: Math.ceil(arraySize / CACHE_LINE_SIZE) }).map((_, lineIdx) => {
                const startIdx = lineIdx * CACHE_LINE_SIZE;
                const endIdx = Math.min(startIdx + CACHE_LINE_SIZE, arraySize);
                const elementsInLine = sortedArray.slice(startIdx, endIdx);
                const isLineLoaded = standardStats?.linesLoaded.has(lineIdx);
                const hasCurrentAccess = standardSteps.slice(0, currentStep + 1).some(
                  (s) => getCacheLine(s.index) === lineIdx
                );

                return (
                  <div key={lineIdx} className="flex items-center gap-2">
                    <div className={`w-16 text-xs font-mono px-2 py-1 rounded ${
                      isLineLoaded ? 'bg-blue-500/30 text-blue-300' : 'bg-zinc-800/50 text-[var(--text-muted)]'
                    }`}>
                      {isLineLoaded ? 'CACHE' : 'DISK'}
                    </div>
                    <div className={`flex-1 flex gap-0.5 p-1 rounded ${
                      hasCurrentAccess ? 'bg-blue-500/10 ring-1 ring-blue-500/50' : 'bg-zinc-800/30'
                    }`}>
                      {elementsInLine.map((val, i) => {
                        const actualIdx = startIdx + i;
                        const isVisited = standardSteps.slice(0, currentStep + 1).some((s) => s.index === actualIdx);
                        const isCurrent = standardSteps[currentStep]?.index === actualIdx;
                        const step = standardSteps.find((s) => s.index === actualIdx);

                        return (
                          <motion.div
                            key={i}
                            className={`w-8 h-8 flex items-center justify-center text-xs font-mono rounded ${
                              isCurrent ? 'bg-blue-500 text-white' :
                              isVisited ? (step?.cacheHit ? 'bg-green-500/80 text-white' : 'bg-orange-500/80 text-white') :
                              'bg-zinc-700/30 text-[var(--text-primary)]'
                            }`}
                            initial={false}
                            animate={{ scale: isCurrent ? 1.15 : 1 }}
                            title={`Index ${actualIdx}: ${isVisited ? (step?.cacheHit ? 'Cache HIT' : 'Cache MISS') : ''}`}
                          >
                            {val}
                          </motion.div>
                        );
                      })}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] w-12">L{lineIdx}</div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-green-500/80"></span> Cache Hit
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-orange-500/80"></span> Cache Miss
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Search Log */}
      <AnimatePresence>
        {isSearching && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-strong rounded-xl p-4"
          >
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Search Progress (with Cache Status)</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {/* Eytzinger search log */}
              <div>
                <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Eytzinger Search</h4>
                <div className="space-y-1 font-mono text-xs">
                  {searchSteps.slice(0, currentStep + 1).map((step, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`px-2 py-1 rounded flex items-center gap-2 ${step.direction === 'found' ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700/30 text-[var(--text-secondary)]'}`}
                    >
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${step.cacheHit ? 'bg-green-500/30 text-green-400' : 'bg-orange-500/30 text-orange-400'}`}>
                        {step.cacheHit ? 'HIT' : 'MISS'}
                      </span>
                      <span>
                        arr[{step.index}] = {step.value}
                        {step.direction === 'found' ? ' FOUND!' : step.direction === 'left' ? ' > go left' : ' < go right'}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Standard search log */}
              {showComparison && (
                <div>
                  <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Standard Binary Search</h4>
                  <div className="space-y-1 font-mono text-xs">
                    {standardSteps.slice(0, currentStep + 1).map((step, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`px-2 py-1 rounded flex items-center gap-2 ${step.direction === 'found' ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700/30 text-[var(--text-secondary)]'}`}
                      >
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${step.cacheHit ? 'bg-green-500/30 text-green-400' : 'bg-orange-500/30 text-orange-400'}`}>
                          {step.cacheHit ? 'HIT' : 'MISS'}
                        </span>
                        <span>
                          arr[{step.index}] = {step.value}
                          {step.direction === 'found' ? ' FOUND!' : step.direction === 'left' ? ' > go left' : ' < go right'}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cache Efficiency Explanation */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Why is Eytzinger Faster?</h3>
        <ul className="text-sm text-[var(--text-secondary)] space-y-2 list-disc list-inside">
          <li><strong>Cache locality:</strong> Elements near the root are accessed first and stored at the beginning of the array</li>
          <li><strong>Predictable access:</strong> Child indices (2k, 2k+1) are simple calculations, enabling prefetching</li>
          <li><strong>Fewer cache misses:</strong> Siblings are adjacent in memory, often in the same cache line</li>
          <li><strong>Branch-free variants:</strong> Can be implemented without branches for even better performance</li>
        </ul>
      </div>
    </div>
  );
}
