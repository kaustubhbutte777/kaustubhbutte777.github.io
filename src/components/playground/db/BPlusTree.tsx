import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BPlusNode {
  id: string;
  keys: number[];
  children: BPlusNode[];
  isLeaf: boolean;
  next?: BPlusNode; // For leaf node linked list
}

const MAX_KEYS = 3; // Order of the tree (max keys per node)

export default function BPlusTree() {
  const [root, setRoot] = useState<BPlusNode | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [searchValue, setSearchValue] = useState<number | null>(null);
  const [highlightPath, setHighlightPath] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    setLog(prev => [msg, ...prev].slice(0, 10));
  }, []);

  // Create a new leaf node
  const createLeafNode = (keys: number[] = []): BPlusNode => ({
    id: `leaf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    keys,
    children: [],
    isLeaf: true,
  });

  // Create a new internal node
  const createInternalNode = (keys: number[] = [], children: BPlusNode[] = []): BPlusNode => ({
    id: `internal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    keys,
    children,
    isLeaf: false,
  });

  // Insert a key into the B+ tree
  const insert = useCallback((key: number) => {
    if (root === null) {
      setRoot(createLeafNode([key]));
      addLog(`Created root with key ${key}`);
      return;
    }

    const insertRecursive = (node: BPlusNode, key: number): { newNode: BPlusNode | null; promotedKey: number | null } => {
      if (node.isLeaf) {
        // Insert into leaf
        const newKeys = [...node.keys, key].sort((a, b) => a - b);

        if (newKeys.length <= MAX_KEYS) {
          node.keys = newKeys;
          return { newNode: null, promotedKey: null };
        } else {
          // Split the leaf
          const mid = Math.ceil(newKeys.length / 2);
          const leftKeys = newKeys.slice(0, mid);
          const rightKeys = newKeys.slice(mid);

          node.keys = leftKeys;
          const newLeaf = createLeafNode(rightKeys);
          newLeaf.next = node.next;
          node.next = newLeaf;

          addLog(`Split leaf node, promoted key ${rightKeys[0]}`);
          return { newNode: newLeaf, promotedKey: rightKeys[0] };
        }
      } else {
        // Find child to insert into
        let childIndex = node.keys.findIndex(k => key < k);
        if (childIndex === -1) childIndex = node.keys.length;

        const result = insertRecursive(node.children[childIndex], key);

        if (result.newNode && result.promotedKey !== null) {
          // Insert promoted key and new child
          const newKeys = [...node.keys];
          const newChildren = [...node.children];

          newKeys.splice(childIndex, 0, result.promotedKey);
          newChildren.splice(childIndex + 1, 0, result.newNode);

          if (newKeys.length <= MAX_KEYS) {
            node.keys = newKeys;
            node.children = newChildren;
            return { newNode: null, promotedKey: null };
          } else {
            // Split internal node
            const mid = Math.floor(newKeys.length / 2);
            const leftKeys = newKeys.slice(0, mid);
            const rightKeys = newKeys.slice(mid + 1);
            const promotedKey = newKeys[mid];

            node.keys = leftKeys;
            node.children = newChildren.slice(0, mid + 1);

            const newInternal = createInternalNode(rightKeys, newChildren.slice(mid + 1));

            addLog(`Split internal node, promoted key ${promotedKey}`);
            return { newNode: newInternal, promotedKey };
          }
        }

        return { newNode: null, promotedKey: null };
      }
    };

    const result = insertRecursive(root, key);

    if (result.newNode && result.promotedKey !== null) {
      // Create new root
      const newRoot = createInternalNode([result.promotedKey], [root, result.newNode]);
      setRoot(newRoot);
      addLog(`Created new root with key ${result.promotedKey}`);
    } else {
      setRoot({ ...root });
    }

    addLog(`Inserted key ${key}`);
  }, [root, addLog]);

  // Search for a key
  const search = useCallback((key: number) => {
    setSearchValue(key);
    const path: string[] = [];

    const searchRecursive = (node: BPlusNode | null): boolean => {
      if (!node) return false;

      path.push(node.id);

      if (node.isLeaf) {
        const found = node.keys.includes(key);
        addLog(found ? `Found ${key} in leaf` : `Key ${key} not found`);
        return found;
      }

      let childIndex = node.keys.findIndex(k => key < k);
      if (childIndex === -1) childIndex = node.keys.length;

      return searchRecursive(node.children[childIndex]);
    };

    searchRecursive(root);
    setHighlightPath(path);

    setTimeout(() => {
      setSearchValue(null);
      setHighlightPath([]);
    }, 2000);
  }, [root, addLog]);

  // Handle insert form
  const handleInsert = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(inputValue);
    if (!isNaN(num)) {
      insert(num);
      setInputValue('');
    }
  };

  // Insert sample data
  const insertSampleData = () => {
    const samples = [10, 20, 5, 15, 25, 30, 35, 40, 12, 18];
    samples.forEach((n, i) => {
      setTimeout(() => insert(n), i * 300);
    });
  };

  // Reset tree
  const reset = () => {
    setRoot(null);
    setLog([]);
    setSearchValue(null);
    setHighlightPath([]);
  };

  // Calculate tree depth for rendering
  const getTreeDepth = (node: BPlusNode | null): number => {
    if (!node) return 0;
    if (node.isLeaf) return 1;
    return 1 + Math.max(...node.children.map(getTreeDepth));
  };

  // Render tree recursively
  const renderTree = (node: BPlusNode | null, level: number, position: number, totalWidth: number) => {
    if (!node) return null;

    const nodeWidth = 100;
    const isHighlighted = highlightPath.includes(node.id);
    const depth = getTreeDepth(root);
    const y = level * 80 + 20;

    return (
      <g key={node.id}>
        {/* Node */}
        <motion.g
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{
            opacity: 1,
            scale: 1,
            filter: isHighlighted ? 'drop-shadow(0 0 10px #6366f1)' : 'none'
          }}
          transition={{ duration: 0.3 }}
        >
          <rect
            x={position - nodeWidth / 2}
            y={y}
            width={nodeWidth}
            height={35}
            rx="6"
            fill={node.isLeaf ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)'}
            stroke={isHighlighted ? '#6366f1' : node.isLeaf ? '#10b981' : '#6366f1'}
            strokeWidth={isHighlighted ? 2 : 1}
          />

          {/* Keys */}
          {node.keys.map((key, i) => (
            <g key={`${node.id}-key-${i}`}>
              {i > 0 && (
                <line
                  x1={position - nodeWidth / 2 + (i * nodeWidth) / node.keys.length}
                  y1={y}
                  x2={position - nodeWidth / 2 + (i * nodeWidth) / node.keys.length}
                  y2={y + 35}
                  stroke="rgba(255,255,255,0.2)"
                />
              )}
              <text
                x={position - nodeWidth / 2 + ((i + 0.5) * nodeWidth) / node.keys.length}
                y={y + 22}
                textAnchor="middle"
                fill={searchValue === key ? '#f59e0b' : 'white'}
                fontSize="12"
                fontWeight={searchValue === key ? 'bold' : 'normal'}
              >
                {key}
              </text>
            </g>
          ))}

          {/* Leaf indicator */}
          {node.isLeaf && (
            <text
              x={position}
              y={y + 50}
              textAnchor="middle"
              fill="#10b981"
              fontSize="8"
            >
              leaf
            </text>
          )}
        </motion.g>

        {/* Children */}
        {!node.isLeaf && node.children.map((child, i) => {
          const childSpacing = totalWidth / Math.pow(2, level + 1);
          const childPosition = position - (totalWidth / Math.pow(2, level + 1)) * (node.children.length - 1) / 2 + i * childSpacing;

          return (
            <g key={child.id}>
              {/* Connection line */}
              <line
                x1={position}
                y1={y + 35}
                x2={childPosition}
                y2={(level + 1) * 80 + 20}
                stroke={highlightPath.includes(child.id) ? '#6366f1' : 'rgba(255,255,255,0.2)'}
                strokeWidth={highlightPath.includes(child.id) ? 2 : 1}
              />
              {renderTree(child, level + 1, childPosition, totalWidth / 2)}
            </g>
          );
        })}

        {/* Leaf links */}
        {node.isLeaf && node.next && (
          <line
            x1={position + nodeWidth / 2}
            y1={y + 17}
            x2={position + nodeWidth / 2 + 20}
            y2={y + 17}
            stroke="#10b981"
            strokeWidth="1"
            strokeDasharray="3 3"
            markerEnd="url(#arrowhead)"
          />
        )}
      </g>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">B+ Tree</h2>
        <p className="text-gray-400 text-sm">
          Self-balancing tree used in database indexes
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap justify-center gap-3">
        <form onSubmit={handleInsert} className="flex gap-2">
          <input
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter key"
            className="glass px-3 py-2 rounded-lg text-white text-sm w-24 bg-transparent"
          />
          <button type="submit" className="btn-primary text-sm">
            Insert
          </button>
        </form>
        <button
          onClick={() => inputValue && search(parseInt(inputValue))}
          className="btn-glass text-sm"
          disabled={!inputValue}
        >
          Search
        </button>
        <button onClick={insertSampleData} className="btn-glass text-sm">
          Load Sample Data
        </button>
        <button onClick={reset} className="btn-glass text-sm text-red-400">
          Reset
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Tree Visualization */}
        <div className="lg:col-span-2 glass-strong p-6 rounded-2xl overflow-x-auto overflow-y-hidden">
          <div className="min-w-[800px]">
          <svg viewBox="0 0 800 400" className="w-full" style={{ minHeight: 350 }}>
            <defs>
              <marker
                id="arrowhead"
                markerWidth="6"
                markerHeight="6"
                refX="6"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L6,3 L0,6 Z" fill="#10b981" />
              </marker>
            </defs>

            {root ? (
              renderTree(root, 0, 400, 700)
            ) : (
              <text x="400" y="150" textAnchor="middle" fill="#666" fontSize="14">
                Insert keys to build the tree
              </text>
            )}
          </svg>
          </div>
        </div>

        {/* Info Panel */}
        <div className="space-y-4">
          {/* Stats */}
          <div className="glass p-4 rounded-xl">
            <h3 className="text-sm font-medium text-white mb-3">Tree Properties</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Order (max keys)</span>
                <span className="text-white">{MAX_KEYS}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Depth</span>
                <span className="text-white">{getTreeDepth(root)}</span>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="glass p-4 rounded-xl">
            <h3 className="text-sm font-medium text-white mb-3">Legend</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border border-indigo-500 bg-indigo-500/20" />
                <span className="text-gray-400">Internal Node</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border border-green-500 bg-green-500/20" />
                <span className="text-gray-400">Leaf Node</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-green-500" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #10b981, #10b981 3px, transparent 3px, transparent 6px)' }} />
                <span className="text-gray-400">Leaf Links</span>
              </div>
            </div>
          </div>

          {/* Activity Log */}
          <div className="glass p-4 rounded-xl">
            <h3 className="text-sm font-medium text-white mb-2">Activity</h3>
            <div className="space-y-1 font-mono text-xs max-h-32 overflow-y-auto">
              {log.map((entry, i) => (
                <div key={i} className="text-gray-400">{entry}</div>
              ))}
              {log.length === 0 && (
                <span className="text-gray-600">Insert keys to see activity</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="glass p-4 rounded-xl text-sm text-gray-400">
        <h3 className="font-medium text-white mb-2">How B+ Trees Work:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li><span className="text-indigo-400">Internal nodes</span> store keys and pointers to children</li>
          <li><span className="text-green-400">Leaf nodes</span> store actual data and are linked for range queries</li>
          <li>All leaves are at the same depth (balanced)</li>
          <li>When a node overflows, it splits and promotes a key to parent</li>
          <li>Used in MySQL/InnoDB, PostgreSQL, and most database indexes</li>
        </ul>
      </div>
    </div>
  );
}
