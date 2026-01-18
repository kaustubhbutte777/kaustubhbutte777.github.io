import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Node {
  id: string;
  position: number; // 0-360 degrees
  color: string;
  virtualNodes: number[];
}

interface DataKey {
  id: string;
  hash: number;
  assignedNode: string | null;
}

const COLORS = [
  '#525252', '#6b6b6b', '#737373', '#10b981', '#f59e0b', '#ef4444'
];

const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash % 360);
};

export default function ConsistentHashRing() {
  const [nodes, setNodes] = useState<Node[]>([
    { id: 'Node-A', position: 45, color: COLORS[0], virtualNodes: [45, 135, 225] },
    { id: 'Node-B', position: 120, color: COLORS[1], virtualNodes: [120, 210, 300] },
    { id: 'Node-C', position: 270, color: COLORS[2], virtualNodes: [270, 30, 180] },
  ]);

  const [dataKeys, setDataKeys] = useState<DataKey[]>([]);
  const [nextKeyId, setNextKeyId] = useState(1);
  const [showVirtualNodes, setShowVirtualNodes] = useState(true);
  const [log, setLog] = useState<string[]>([]);

  // Get all positions on the ring (nodes + virtual nodes)
  const allPositions = useMemo(() => {
    const positions: { position: number; nodeId: string; isVirtual: boolean }[] = [];
    nodes.forEach(node => {
      positions.push({ position: node.position, nodeId: node.id, isVirtual: false });
      if (showVirtualNodes) {
        node.virtualNodes.forEach(vPos => {
          if (vPos !== node.position) {
            positions.push({ position: vPos, nodeId: node.id, isVirtual: true });
          }
        });
      }
    });
    return positions.sort((a, b) => a.position - b.position);
  }, [nodes, showVirtualNodes]);

  // Find which node a key belongs to
  const findNodeForKey = (keyHash: number): string | null => {
    if (allPositions.length === 0) return null;

    // Find the first node position >= key hash (clockwise)
    for (const pos of allPositions) {
      if (pos.position >= keyHash) {
        return pos.nodeId;
      }
    }
    // Wrap around to first node
    return allPositions[0].nodeId;
  };

  const addLog = (msg: string) => {
    setLog(prev => [msg, ...prev].slice(0, 8));
  };

  const addKey = () => {
    const keyName = `key-${nextKeyId}`;
    const hash = hashString(keyName);
    const assignedNode = findNodeForKey(hash);

    setDataKeys(prev => [...prev, { id: keyName, hash, assignedNode }]);
    setNextKeyId(prev => prev + 1);
    addLog(`Added ${keyName} (hash: ${hash}°) → ${assignedNode}`);
  };

  const addNode = () => {
    const newId = `Node-${String.fromCharCode(65 + nodes.length)}`;
    const newPosition = Math.floor(Math.random() * 360);
    const virtualPositions = [
      newPosition,
      (newPosition + 120) % 360,
      (newPosition + 240) % 360,
    ];

    setNodes(prev => [...prev, {
      id: newId,
      position: newPosition,
      color: COLORS[nodes.length % COLORS.length],
      virtualNodes: virtualPositions
    }]);

    addLog(`Added ${newId} at ${newPosition}°`);

    // Reassign affected keys
    setTimeout(() => {
      setDataKeys(prev => prev.map(key => ({
        ...key,
        assignedNode: findNodeForKey(key.hash)
      })));
    }, 100);
  };

  const removeNode = (nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    addLog(`Removed ${nodeId}`);

    // Reassign affected keys
    setTimeout(() => {
      setDataKeys(prev => prev.map(key => ({
        ...key,
        assignedNode: findNodeForKey(key.hash)
      })));
    }, 100);
  };

  const clear = () => {
    setDataKeys([]);
    setNextKeyId(1);
    setLog([]);
  };

  const getNodeColor = (nodeId: string): string => {
    return nodes.find(n => n.id === nodeId)?.color || '#666';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Consistent Hashing</h2>
        <p className="text-[var(--text-secondary)] text-sm">
          Keys are assigned to the next node clockwise on the ring
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap justify-center gap-3">
        <button onClick={addKey} className="btn-primary text-sm">
          Add Data Key
        </button>
        <button onClick={addNode} className="btn-glass text-sm" disabled={nodes.length >= 6}>
          Add Node
        </button>
        <button
          onClick={() => setShowVirtualNodes(!showVirtualNodes)}
          className={`btn-glass text-sm ${showVirtualNodes ? 'border-zinc-600' : ''}`}
        >
          {showVirtualNodes ? 'Hide' : 'Show'} Virtual Nodes
        </button>
        <button onClick={clear} className="btn-glass text-sm text-red-400">
          Clear Keys
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Ring Visualization */}
        <div className="glass-strong p-6 rounded-2xl">
          <div className="relative w-full aspect-square max-w-md mx-auto">
            {/* Ring */}
            <svg viewBox="0 0 400 400" className="w-full h-full">
              {/* Background ring */}
              <circle
                cx="200"
                cy="200"
                r="150"
                fill="none"
                stroke="var(--svg-stroke)"
                strokeWidth="30"
              />

              {/* Node segments */}
              {nodes.map((node, i) => {
                const positions = showVirtualNodes
                  ? node.virtualNodes
                  : [node.position];

                return positions.map((pos, j) => (
                  <g key={`${node.id}-${j}`}>
                    {/* Node marker */}
                    <circle
                      cx={200 + 150 * Math.cos((pos - 90) * Math.PI / 180)}
                      cy={200 + 150 * Math.sin((pos - 90) * Math.PI / 180)}
                      r={j === 0 ? 12 : 8}
                      fill={node.color}
                      stroke="var(--bg-primary)"
                      strokeWidth={j === 0 ? 2 : 1}
                      opacity={j === 0 ? 1 : 0.6}
                    />
                  </g>
                ));
              })}

              {/* Data keys */}
              <AnimatePresence>
                {dataKeys.map((key) => {
                  const angle = (key.hash - 90) * Math.PI / 180;
                  const x = 200 + 110 * Math.cos(angle);
                  const y = 200 + 110 * Math.sin(angle);

                  return (
                    <motion.g
                      key={key.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                    >
                      <circle
                        cx={x}
                        cy={y}
                        r="6"
                        fill={getNodeColor(key.assignedNode || '')}
                        stroke="var(--bg-primary)"
                        strokeWidth="1"
                      />
                    </motion.g>
                  );
                })}
              </AnimatePresence>

              {/* Center label */}
              <text x="200" y="195" textAnchor="middle" fill="var(--svg-fill)" fontSize="14">
                Hash Ring
              </text>
              <text x="200" y="215" textAnchor="middle" fill="var(--svg-fill-muted)" fontSize="12">
                0° - 360°
              </text>
            </svg>

            {/* Node labels */}
            {nodes.map((node) => {
              const angle = (node.position - 90) * Math.PI / 180;
              const x = 50 + 45 * Math.cos(angle);
              const y = 50 + 45 * Math.sin(angle);

              return (
                <div
                  key={node.id}
                  className="absolute text-xs font-mono"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: 'translate(-50%, -50%)',
                    color: node.color
                  }}
                >
                  {node.id}
                </div>
              );
            })}
          </div>
        </div>

        {/* Info Panel */}
        <div className="space-y-4">
          {/* Nodes */}
          <div className="glass p-4 rounded-xl">
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">Nodes</h3>
            <div className="space-y-2">
              {nodes.map(node => (
                <div key={node.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: node.color }}
                    />
                    <span className="text-sm text-[var(--text-primary)]">{node.id}</span>
                    <span className="text-xs text-[var(--text-muted)]">
                      ({node.position}°
                      {showVirtualNodes && ` + ${node.virtualNodes.length - 1} virtual`})
                    </span>
                  </div>
                  <button
                    onClick={() => removeNode(node.id)}
                    className="text-red-400 hover:text-red-300 text-xs"
                    disabled={nodes.length <= 2}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Keys */}
          <div className="glass p-4 rounded-xl">
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">
              Data Keys ({dataKeys.length})
            </h3>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {dataKeys.length === 0 ? (
                <span className="text-[var(--text-muted)] text-sm">No keys added yet</span>
              ) : (
                dataKeys.map(key => (
                  <div key={key.id} className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-secondary)]">{key.id}</span>
                    <span className="text-[var(--text-muted)]">{key.hash}°</span>
                    <span style={{ color: getNodeColor(key.assignedNode || '') }}>
                      → {key.assignedNode}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Activity Log */}
          <div className="glass p-4 rounded-xl">
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">Activity</h3>
            <div className="space-y-1 font-mono text-xs max-h-24 overflow-y-auto">
              {log.map((entry, i) => (
                <div key={i} className="text-[var(--text-secondary)]">{entry}</div>
              ))}
              {log.length === 0 && (
                <span className="text-[var(--text-muted)]">Add nodes and keys to see activity</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="glass p-4 rounded-xl text-sm text-[var(--text-secondary)]">
        <h3 className="font-medium text-[var(--text-primary)] mb-2">How Consistent Hashing Works:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>Nodes are placed on a hash ring (0° - 360°)</li>
          <li>Each key is hashed and assigned to the next node clockwise</li>
          <li><span className="text-zinc-500">Virtual nodes</span> improve distribution and reduce hotspots</li>
          <li>When a node is added/removed, only keys in that segment are affected</li>
        </ul>
      </div>
    </div>
  );
}
