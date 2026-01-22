import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Point {
  x: number;
  y: number;
  id: number;
  type: 'driver' | 'rider';
}

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface QuadTreeNode {
  bounds: Bounds;
  points: Point[];
  children: QuadTreeNode[] | null;
  depth: number;
}

const MAX_POINTS = 4;
const MAX_DEPTH = 6;

function createNode(bounds: Bounds, depth: number): QuadTreeNode {
  return { bounds, points: [], children: null, depth };
}

function subdivide(node: QuadTreeNode): void {
  const { x, y, width, height } = node.bounds;
  const hw = width / 2;
  const hh = height / 2;

  node.children = [
    createNode({ x, y, width: hw, height: hh }, node.depth + 1),           // NW
    createNode({ x: x + hw, y, width: hw, height: hh }, node.depth + 1),   // NE
    createNode({ x, y: y + hh, width: hw, height: hh }, node.depth + 1),   // SW
    createNode({ x: x + hw, y: y + hh, width: hw, height: hh }, node.depth + 1), // SE
  ];
}

function containsPoint(bounds: Bounds, point: Point): boolean {
  return (
    point.x >= bounds.x &&
    point.x < bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y < bounds.y + bounds.height
  );
}

function insert(node: QuadTreeNode, point: Point): boolean {
  if (!containsPoint(node.bounds, point)) return false;

  if (node.children === null) {
    if (node.points.length < MAX_POINTS || node.depth >= MAX_DEPTH) {
      node.points.push(point);
      return true;
    }
    subdivide(node);
    // Move existing points to children
    for (const p of node.points) {
      for (const child of node.children!) {
        if (insert(child, p)) break;
      }
    }
    node.points = [];
  }

  for (const child of node.children!) {
    if (insert(child, point)) return true;
  }
  return false;
}

function intersects(bounds: Bounds, range: Bounds): boolean {
  return !(
    range.x > bounds.x + bounds.width ||
    range.x + range.width < bounds.x ||
    range.y > bounds.y + bounds.height ||
    range.y + range.height < bounds.y
  );
}

function queryRange(node: QuadTreeNode, range: Bounds, found: Point[], visited: QuadTreeNode[]): void {
  visited.push(node);

  if (!intersects(node.bounds, range)) return;

  for (const point of node.points) {
    if (containsPoint(range, point)) {
      found.push(point);
    }
  }

  if (node.children) {
    for (const child of node.children) {
      queryRange(child, range, found, visited);
    }
  }
}

export default function QuadtreeIndex() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [tree, setTree] = useState<QuadTreeNode | null>(null);
  const [queryRect, setQueryRect] = useState<Bounds | null>(null);
  const [queryResults, setQueryResults] = useState<Point[]>([]);
  const [visitedNodes, setVisitedNodes] = useState<QuadTreeNode[]>([]);
  const [isQuerying, setIsQuerying] = useState(false);
  const [mode, setMode] = useState<'driver' | 'rider' | 'query'>('driver');
  const [stats, setStats] = useState({ totalNodes: 0, nodesVisited: 0 });

  const canvasSize = 500;

  const countNodes = useCallback((node: QuadTreeNode): number => {
    let count = 1;
    if (node.children) {
      for (const child of node.children) {
        count += countNodes(child);
      }
    }
    return count;
  }, []);

  const rebuildTree = useCallback((pts: Point[]) => {
    const root = createNode({ x: 0, y: 0, width: canvasSize, height: canvasSize }, 0);
    for (const p of pts) {
      insert(root, p);
    }
    setTree(root);
    setStats(prev => ({ ...prev, totalNodes: countNodes(root) }));
  }, [countNodes]);

  useEffect(() => {
    // Initialize with some random drivers
    const initialPoints: Point[] = [];
    for (let i = 0; i < 30; i++) {
      initialPoints.push({
        x: Math.random() * canvasSize,
        y: Math.random() * canvasSize,
        id: i,
        type: 'driver'
      });
    }
    setPoints(initialPoints);
    rebuildTree(initialPoints);
  }, [rebuildTree]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (mode === 'query') {
      // Create a query rectangle around the click point
      const querySize = 80;
      const range: Bounds = {
        x: x - querySize / 2,
        y: y - querySize / 2,
        width: querySize,
        height: querySize
      };
      setQueryRect(range);
      setIsQuerying(true);

      if (tree) {
        const found: Point[] = [];
        const visited: QuadTreeNode[] = [];
        queryRange(tree, range, found, visited);
        setQueryResults(found);
        setVisitedNodes(visited);
        setStats(prev => ({ ...prev, nodesVisited: visited.length }));
      }
    } else {
      const newPoint: Point = {
        x,
        y,
        id: points.length,
        type: mode
      };
      const newPoints = [...points, newPoint];
      setPoints(newPoints);
      rebuildTree(newPoints);
      setQueryRect(null);
      setQueryResults([]);
      setVisitedNodes([]);
      setIsQuerying(false);
    }
  };

  const clearAll = () => {
    setPoints([]);
    setTree(createNode({ x: 0, y: 0, width: canvasSize, height: canvasSize }, 0));
    setQueryRect(null);
    setQueryResults([]);
    setVisitedNodes([]);
    setIsQuerying(false);
    setStats({ totalNodes: 1, nodesVisited: 0 });
  };

  const addRandomDrivers = () => {
    const newPoints: Point[] = [...points];
    for (let i = 0; i < 10; i++) {
      newPoints.push({
        x: Math.random() * canvasSize,
        y: Math.random() * canvasSize,
        id: newPoints.length,
        type: 'driver'
      });
    }
    setPoints(newPoints);
    rebuildTree(newPoints);
  };

  // Draw the quadtree
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !tree) return;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    // Draw grid background
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Draw quadtree partitions
    const drawNode = (node: QuadTreeNode) => {
      const isVisited = visitedNodes.includes(node);

      if (isVisited && isQuerying) {
        ctx.fillStyle = 'rgba(234, 179, 8, 0.1)';
        ctx.fillRect(node.bounds.x, node.bounds.y, node.bounds.width, node.bounds.height);
      }

      ctx.strokeStyle = isVisited && isQuerying ? 'rgba(234, 179, 8, 0.5)' : 'rgba(113, 113, 122, 0.3)';
      ctx.lineWidth = isVisited && isQuerying ? 2 : 1;
      ctx.strokeRect(node.bounds.x, node.bounds.y, node.bounds.width, node.bounds.height);

      if (node.children) {
        for (const child of node.children) {
          drawNode(child);
        }
      }
    };
    drawNode(tree);

    // Draw query rectangle
    if (queryRect) {
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(queryRect.x, queryRect.y, queryRect.width, queryRect.height);
      ctx.setLineDash([]);
    }

    // Draw points
    for (const point of points) {
      const isResult = queryResults.some(p => p.id === point.id);

      ctx.beginPath();
      if (point.type === 'driver') {
        // Driver icon (car-like)
        ctx.fillStyle = isResult ? '#22c55e' : '#3b82f6';
        ctx.arc(point.x, point.y, isResult ? 8 : 6, 0, Math.PI * 2);
        ctx.fill();
        if (isResult) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      } else {
        // Rider icon (person-like)
        ctx.fillStyle = isResult ? '#22c55e' : '#f97316';
        ctx.arc(point.x, point.y, isResult ? 8 : 6, 0, Math.PI * 2);
        ctx.fill();
        if (isResult) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }
  }, [tree, points, queryRect, queryResults, visitedNodes, isQuerying]);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="glass-strong rounded-xl p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex gap-2">
            {(['driver', 'rider', 'query'] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  if (m !== 'query') {
                    setQueryRect(null);
                    setQueryResults([]);
                    setVisitedNodes([]);
                    setIsQuerying(false);
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === m
                    ? m === 'driver'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                      : m === 'rider'
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                      : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                    : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50'
                }`}
              >
                {m === 'driver' ? 'Add Driver' : m === 'rider' ? 'Add Rider' : 'Range Query'}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={addRandomDrivers}
              className="px-4 py-2 rounded-lg text-sm bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50 transition-all"
            >
              +10 Random Drivers
            </button>
            <button
              onClick={clearAll}
              className="px-4 py-2 rounded-lg text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
            >
              Clear All
            </button>
          </div>
        </div>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          {mode === 'query'
            ? 'Click on the map to find all drivers/riders in an 80x80 area'
            : `Click on the map to add a ${mode}`}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Canvas */}
        <div className="lg:col-span-2 glass-strong rounded-xl p-6">
          <canvas
            ref={canvasRef}
            width={canvasSize}
            height={canvasSize}
            onClick={handleCanvasClick}
            className="w-full max-w-[500px] mx-auto rounded-lg cursor-crosshair"
            style={{ aspectRatio: '1' }}
          />
          <div className="flex justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-zinc-400">Driver</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-zinc-400">Rider</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-zinc-400">Query Result</span>
            </div>
          </div>
        </div>

        {/* Stats & Results */}
        <div className="space-y-4">
          <div className="glass-strong rounded-xl p-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Statistics</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-zinc-400">Total Points</span>
                <span className="text-[var(--text-primary)] font-mono">{points.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Drivers</span>
                <span className="text-blue-400 font-mono">{points.filter(p => p.type === 'driver').length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Riders</span>
                <span className="text-orange-400 font-mono">{points.filter(p => p.type === 'rider').length}</span>
              </div>
              <div className="border-t border-zinc-700/50 pt-3">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Tree Nodes</span>
                  <span className="text-[var(--text-primary)] font-mono">{stats.totalNodes}</span>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-zinc-400">Nodes Visited</span>
                  <span className="text-yellow-400 font-mono">{stats.nodesVisited}</span>
                </div>
                {stats.nodesVisited > 0 && (
                  <div className="mt-2 text-xs text-emerald-400">
                    Efficiency: {((1 - stats.nodesVisited / stats.totalNodes) * 100).toFixed(0)}% nodes pruned
                  </div>
                )}
              </div>
            </div>
          </div>

          <AnimatePresence>
            {queryResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="glass-strong rounded-xl p-6"
              >
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                  Query Results ({queryResults.length})
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {queryResults.map((point) => (
                    <div
                      key={point.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/30"
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          point.type === 'driver' ? 'bg-blue-500' : 'bg-orange-500'
                        }`}
                      />
                      <span className="text-sm text-zinc-300 capitalize">{point.type}</span>
                      <span className="text-xs text-zinc-500 font-mono">
                        ({point.x.toFixed(0)}, {point.y.toFixed(0)})
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Explanation */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">How Quadtrees Work</h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="p-4 rounded-lg bg-zinc-800/30">
            <div className="font-mono text-emerald-400 mb-2">Spatial Partitioning</div>
            <p className="text-[var(--text-secondary)]">
              Space is recursively divided into 4 quadrants. Each node holds up to 4 points before splitting.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-zinc-800/30">
            <div className="font-mono text-emerald-400 mb-2">O(log n) Queries</div>
            <p className="text-[var(--text-secondary)]">
              Range queries prune entire branches that don't intersect, avoiding O(n) full scans.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-zinc-800/30">
            <div className="font-mono text-emerald-400 mb-2">Uber Use Case</div>
            <p className="text-[var(--text-secondary)]">
              Find nearby drivers for a rider request. Geospatial indexes enable fast location-based matching.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
