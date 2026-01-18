import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type NodeState = 'follower' | 'candidate' | 'leader';

interface RaftNode {
  id: string;
  state: NodeState;
  term: number;
  votedFor: string | null;
  log: LogEntry[];
  commitIndex: number;
}

interface LogEntry {
  term: number;
  command: string;
}

interface Message {
  id: string;
  from: string;
  to: string;
  type: 'vote-request' | 'vote-response' | 'heartbeat' | 'append-entries';
  term: number;
}

const NODE_POSITIONS = [
  { x: 50, y: 20 },   // Top
  { x: 85, y: 50 },   // Right
  { x: 70, y: 85 },   // Bottom right
  { x: 30, y: 85 },   // Bottom left
  { x: 15, y: 50 },   // Left
];

const stateColors: Record<NodeState, string> = {
  follower: '#6b7280',
  candidate: '#f59e0b',
  leader: '#10b981',
};

export default function RaftConsensus() {
  const [nodes, setNodes] = useState<RaftNode[]>(() =>
    Array.from({ length: 5 }, (_, i) => ({
      id: `N${i + 1}`,
      state: 'follower' as NodeState,
      term: 0,
      votedFor: null,
      log: [],
      commitIndex: 0,
    }))
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(1);

  const addLog = useCallback((msg: string) => {
    setLog(prev => [msg, ...prev].slice(0, 10));
  }, []);

  const getLeader = useCallback(() => {
    return nodes.find(n => n.state === 'leader');
  }, [nodes]);

  // Start election from a node
  const startElection = useCallback((nodeId: string) => {
    setNodes(prev => {
      const newNodes = [...prev];
      const nodeIndex = newNodes.findIndex(n => n.id === nodeId);
      if (nodeIndex === -1) return prev;

      const node = { ...newNodes[nodeIndex] };
      node.state = 'candidate';
      node.term += 1;
      node.votedFor = node.id;
      newNodes[nodeIndex] = node;

      addLog(`${node.id} starts election for term ${node.term}`);

      // Send vote requests
      const newMessages: Message[] = newNodes
        .filter(n => n.id !== nodeId)
        .map(n => ({
          id: `${Date.now()}-${n.id}`,
          from: nodeId,
          to: n.id,
          type: 'vote-request' as const,
          term: node.term,
        }));

      setTimeout(() => {
        setMessages(newMessages);
        // Simulate vote responses after delay
        setTimeout(() => {
          handleVoteResponses(nodeId, node.term, newNodes);
        }, 1000 / speed);
      }, 100);

      return newNodes;
    });
  }, [addLog, speed]);

  const handleVoteResponses = useCallback((candidateId: string, term: number, currentNodes: RaftNode[]) => {
    // Count votes (simplified - all nodes vote yes)
    const votes = currentNodes.filter(n => n.id !== candidateId).length + 1; // +1 for self
    const majority = Math.floor(currentNodes.length / 2) + 1;

    setMessages([]);

    if (votes >= majority) {
      setNodes(prev => prev.map(n =>
        n.id === candidateId
          ? { ...n, state: 'leader' as NodeState }
          : n
      ));
      addLog(`${candidateId} elected leader with ${votes} votes (term ${term})`);
    }
  }, [addLog]);

  // Leader sends heartbeats
  const sendHeartbeats = useCallback(() => {
    const leader = nodes.find(n => n.state === 'leader');
    if (!leader) return;

    const heartbeats: Message[] = nodes
      .filter(n => n.id !== leader.id)
      .map(n => ({
        id: `hb-${Date.now()}-${n.id}`,
        from: leader.id,
        to: n.id,
        type: 'heartbeat' as const,
        term: leader.term,
      }));

    setMessages(heartbeats);
    addLog(`${leader.id} sends heartbeats`);

    setTimeout(() => setMessages([]), 800 / speed);
  }, [nodes, addLog, speed]);

  // Append a new log entry
  const appendEntry = useCallback(() => {
    const leader = nodes.find(n => n.state === 'leader');
    if (!leader) {
      addLog('No leader - cannot append entry');
      return;
    }

    const newEntry: LogEntry = {
      term: leader.term,
      command: `cmd-${leader.log.length + 1}`,
    };

    // Leader appends to its log
    setNodes(prev => prev.map(n =>
      n.id === leader.id
        ? { ...n, log: [...n.log, newEntry] }
        : n
    ));

    addLog(`${leader.id} appends entry: ${newEntry.command}`);

    // Send append entries to followers
    const appendMessages: Message[] = nodes
      .filter(n => n.id !== leader.id)
      .map(n => ({
        id: `ae-${Date.now()}-${n.id}`,
        from: leader.id,
        to: n.id,
        type: 'append-entries' as const,
        term: leader.term,
      }));

    setMessages(appendMessages);

    // Followers replicate after delay
    setTimeout(() => {
      setNodes(prev => prev.map(n =>
        n.id !== leader.id
          ? { ...n, log: [...n.log, newEntry] }
          : n
      ));
      setMessages([]);
      addLog(`Followers replicated entry`);

      // Commit after majority
      setTimeout(() => {
        setNodes(prev => prev.map(n => ({
          ...n,
          commitIndex: n.log.length,
        })));
        addLog(`Entry committed (index ${leader.log.length + 1})`);
      }, 500 / speed);
    }, 1000 / speed);
  }, [nodes, addLog, speed]);

  // Simulate leader failure
  const killLeader = useCallback(() => {
    const leader = nodes.find(n => n.state === 'leader');
    if (!leader) {
      addLog('No leader to kill');
      return;
    }

    setNodes(prev => prev.map(n =>
      n.id === leader.id
        ? { ...n, state: 'follower' as NodeState }
        : n
    ));
    addLog(`${leader.id} crashed! Followers will timeout...`);

    // Trigger new election after timeout
    setTimeout(() => {
      const followers = nodes.filter(n => n.id !== leader.id);
      const randomFollower = followers[Math.floor(Math.random() * followers.length)];
      startElection(randomFollower.id);
    }, 2000 / speed);
  }, [nodes, addLog, speed, startElection]);

  // Reset to initial state
  const reset = useCallback(() => {
    setNodes(Array.from({ length: 5 }, (_, i) => ({
      id: `N${i + 1}`,
      state: 'follower' as NodeState,
      term: 0,
      votedFor: null,
      log: [],
      commitIndex: 0,
    })));
    setMessages([]);
    setLog([]);
    setIsRunning(false);
  }, []);

  // Auto-run simulation
  useEffect(() => {
    if (!isRunning) return;

    const leader = getLeader();
    if (!leader) {
      // Start election if no leader
      const randomNode = nodes[Math.floor(Math.random() * nodes.length)];
      const timeout = setTimeout(() => startElection(randomNode.id), 1500 / speed);
      return () => clearTimeout(timeout);
    } else {
      // Leader sends periodic heartbeats
      const interval = setInterval(sendHeartbeats, 2000 / speed);
      return () => clearInterval(interval);
    }
  }, [isRunning, nodes, getLeader, startElection, sendHeartbeats, speed]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Raft Consensus</h2>
        <p className="text-gray-400 text-sm">
          Leader election and log replication in distributed systems
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={() => setIsRunning(!isRunning)}
          className={`btn-glass text-sm ${isRunning ? 'border-green-500' : ''}`}
        >
          {isRunning ? '● Running' : '○ Start Simulation'}
        </button>
        <button
          onClick={appendEntry}
          className="btn-primary text-sm"
          disabled={!getLeader()}
        >
          Append Entry
        </button>
        <button
          onClick={killLeader}
          className="btn-glass text-sm text-red-400"
          disabled={!getLeader()}
        >
          Kill Leader
        </button>
        <button onClick={reset} className="btn-glass text-sm">
          Reset
        </button>
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="btn-glass text-sm bg-transparent"
        >
          <option value={0.5}>0.5x Speed</option>
          <option value={1}>1x Speed</option>
          <option value={2}>2x Speed</option>
        </select>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Cluster Visualization */}
        <div className="glass-strong p-6 rounded-2xl">
          <div className="relative w-full aspect-square max-w-md mx-auto">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {/* Connection lines */}
              {nodes.map((node, i) =>
                nodes.slice(i + 1).map((other, j) => (
                  <line
                    key={`${node.id}-${other.id}`}
                    x1={NODE_POSITIONS[i].x}
                    y1={NODE_POSITIONS[i].y}
                    x2={NODE_POSITIONS[i + j + 1].x}
                    y2={NODE_POSITIONS[i + j + 1].y}
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="0.5"
                  />
                ))
              )}

              {/* Message animations */}
              <AnimatePresence>
                {messages.map((msg) => {
                  const fromIdx = nodes.findIndex(n => n.id === msg.from);
                  const toIdx = nodes.findIndex(n => n.id === msg.to);
                  if (fromIdx === -1 || toIdx === -1) return null;

                  const from = NODE_POSITIONS[fromIdx];
                  const to = NODE_POSITIONS[toIdx];

                  return (
                    <motion.circle
                      key={msg.id}
                      r="2"
                      fill={msg.type === 'heartbeat' ? '#10b981' :
                            msg.type === 'vote-request' ? '#f59e0b' : '#6366f1'}
                      initial={{ cx: from.x, cy: from.y, opacity: 1 }}
                      animate={{ cx: to.x, cy: to.y, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5 / speed }}
                    />
                  );
                })}
              </AnimatePresence>

              {/* Nodes */}
              {nodes.map((node, i) => (
                <g key={node.id}>
                  <motion.circle
                    cx={NODE_POSITIONS[i].x}
                    cy={NODE_POSITIONS[i].y}
                    r="8"
                    fill={stateColors[node.state]}
                    stroke="white"
                    strokeWidth={node.state === 'leader' ? 2 : 1}
                    animate={{
                      scale: node.state === 'leader' ? [1, 1.1, 1] : 1,
                    }}
                    transition={{
                      repeat: node.state === 'leader' ? Infinity : 0,
                      duration: 2,
                    }}
                  />
                  <text
                    x={NODE_POSITIONS[i].x}
                    y={NODE_POSITIONS[i].y + 1}
                    textAnchor="middle"
                    fill="white"
                    fontSize="4"
                    fontWeight="bold"
                  >
                    {node.id}
                  </text>
                  {/* State label */}
                  <text
                    x={NODE_POSITIONS[i].x}
                    y={NODE_POSITIONS[i].y + 14}
                    textAnchor="middle"
                    fill={stateColors[node.state]}
                    fontSize="3"
                  >
                    {node.state}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-4 mt-4 text-xs">
            <span className="text-gray-400">● Follower</span>
            <span className="text-yellow-400">● Candidate</span>
            <span className="text-green-400">● Leader</span>
          </div>
        </div>

        {/* Info Panel */}
        <div className="space-y-4">
          {/* Node States */}
          <div className="glass p-4 rounded-xl">
            <h3 className="text-sm font-medium text-white mb-3">Node States</h3>
            <div className="space-y-2">
              {nodes.map(node => (
                <div key={node.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: stateColors[node.state] }}
                    />
                    <span className="text-white">{node.id}</span>
                  </div>
                  <span className="text-gray-400">Term {node.term}</span>
                  <span className="text-gray-500 text-xs">
                    Log: [{node.log.map(e => e.command).join(', ')}]
                  </span>
                </div>
              ))}
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
                <span className="text-gray-600">Start simulation to see activity</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="glass p-4 rounded-xl text-sm text-gray-400">
        <h3 className="font-medium text-white mb-2">How Raft Works:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li><span className="text-yellow-400">Leader Election</span>: Followers timeout and become candidates, requesting votes</li>
          <li><span className="text-green-400">Log Replication</span>: Leader appends entries and replicates to followers</li>
          <li><span className="text-indigo-400">Commit</span>: Entries are committed once replicated to a majority</li>
          <li><span className="text-red-400">Failure Recovery</span>: New election triggered when leader fails</li>
        </ul>
      </div>
    </div>
  );
}
