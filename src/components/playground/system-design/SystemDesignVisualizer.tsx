import { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from 'reactflow';
import type { Node, Edge, NodeProps } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
import 'reactflow/dist/style.css';

type Scenario = 'normal' | 'high-load' | 'failure' | 'partition';

interface NodeData {
  label: string;
  icon: string;
  type: 'client' | 'gateway' | 'service' | 'database' | 'cache' | 'queue' | 'external';
  tech?: string;
  throughput?: string;
  latency?: string;
  description?: string;
  status?: 'healthy' | 'degraded' | 'down';
}

const nodeColors: Record<NodeData['type'], string> = {
  client: '#10b981',
  gateway: '#6366f1',
  service: '#8b5cf6',
  database: '#f59e0b',
  cache: '#ef4444',
  queue: '#06b6d4',
  external: '#ec4899',
};

// Custom Node Component
function ServiceNode({ data, selected }: NodeProps<NodeData>) {
  const statusColor = data.status === 'healthy' ? 'bg-green-500' :
                      data.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className={`px-4 py-3 rounded-xl border-2 transition-all min-w-[140px]
      ${selected ? 'border-white shadow-lg shadow-white/20' : 'border-white/20'}
      ${data.status === 'down' ? 'opacity-50' : ''}`}
      style={{
        background: `linear-gradient(135deg, ${nodeColors[data.type]}40, ${nodeColors[data.type]}20)`,
        backdropFilter: 'blur(8px)',
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-white/50 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-white/50 !w-2 !h-2" />
      <Handle type="target" position={Position.Left} className="!bg-white/50 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-white/50 !w-2 !h-2" />

      <div className="flex items-center gap-2">
        <span className="text-2xl">{data.icon}</span>
        <div>
          <div className="text-white font-medium text-sm flex items-center gap-2">
            {data.label}
            <div className={`w-2 h-2 rounded-full ${statusColor}`} />
          </div>
          {data.tech && (
            <div className="text-gray-400 text-xs">{data.tech}</div>
          )}
        </div>
      </div>
    </div>
  );
}

const nodeTypes = {
  service: ServiceNode,
};

const initialNodes: Node<NodeData>[] = [
  // Clients
  {
    id: 'rider-app',
    type: 'service',
    position: { x: 100, y: 0 },
    data: {
      label: 'Rider App',
      icon: '📱',
      type: 'client',
      tech: 'iOS/Android',
      description: 'Mobile app for riders to request rides',
      status: 'healthy'
    }
  },
  {
    id: 'driver-app',
    type: 'service',
    position: { x: 350, y: 0 },
    data: {
      label: 'Driver App',
      icon: '🚗',
      type: 'client',
      tech: 'iOS/Android',
      description: 'Mobile app for drivers to accept rides',
      status: 'healthy'
    }
  },

  // Gateway
  {
    id: 'api-gateway',
    type: 'service',
    position: { x: 225, y: 100 },
    data: {
      label: 'API Gateway',
      icon: '🌐',
      type: 'gateway',
      tech: 'Kong/Nginx',
      throughput: '100K req/s',
      latency: '5ms',
      description: 'Rate limiting, auth, routing',
      status: 'healthy'
    }
  },

  // Core Services
  {
    id: 'ride-service',
    type: 'service',
    position: { x: 50, y: 220 },
    data: {
      label: 'Ride Service',
      icon: '🎯',
      type: 'service',
      tech: 'Go',
      throughput: '50K req/s',
      latency: '20ms',
      description: 'Handles ride requests and matching',
      status: 'healthy'
    }
  },
  {
    id: 'dispatch-service',
    type: 'service',
    position: { x: 225, y: 220 },
    data: {
      label: 'Dispatch',
      icon: '📍',
      type: 'service',
      tech: 'Go',
      throughput: '30K req/s',
      latency: '15ms',
      description: 'Matches riders with nearby drivers',
      status: 'healthy'
    }
  },
  {
    id: 'pricing-service',
    type: 'service',
    position: { x: 400, y: 220 },
    data: {
      label: 'Pricing',
      icon: '💰',
      type: 'service',
      tech: 'Java',
      throughput: '20K req/s',
      latency: '10ms',
      description: 'Dynamic pricing and surge calculation',
      status: 'healthy'
    }
  },

  // Location & Payment
  {
    id: 'location-service',
    type: 'service',
    position: { x: 50, y: 340 },
    data: {
      label: 'Location',
      icon: '🗺️',
      type: 'service',
      tech: 'Go + H3',
      throughput: '200K req/s',
      latency: '5ms',
      description: 'Real-time driver location tracking',
      status: 'healthy'
    }
  },
  {
    id: 'payment-service',
    type: 'service',
    position: { x: 400, y: 340 },
    data: {
      label: 'Payment',
      icon: '💳',
      type: 'service',
      tech: 'Java',
      throughput: '10K req/s',
      latency: '100ms',
      description: 'Process payments and refunds',
      status: 'healthy'
    }
  },

  // Message Queue
  {
    id: 'kafka',
    type: 'service',
    position: { x: 225, y: 340 },
    data: {
      label: 'Kafka',
      icon: '📨',
      type: 'queue',
      tech: 'Event Streaming',
      throughput: '1M msg/s',
      description: 'Async event processing',
      status: 'healthy'
    }
  },

  // Cache
  {
    id: 'redis',
    type: 'service',
    position: { x: 550, y: 220 },
    data: {
      label: 'Redis',
      icon: '⚡',
      type: 'cache',
      tech: 'Cache Cluster',
      latency: '1ms',
      description: 'Driver locations, session data',
      status: 'healthy'
    }
  },

  // Databases
  {
    id: 'postgres-rides',
    type: 'service',
    position: { x: 50, y: 460 },
    data: {
      label: 'Rides DB',
      icon: '🗄️',
      type: 'database',
      tech: 'PostgreSQL',
      description: 'Ride history and metadata',
      status: 'healthy'
    }
  },
  {
    id: 'postgres-users',
    type: 'service',
    position: { x: 225, y: 460 },
    data: {
      label: 'Users DB',
      icon: '🗄️',
      type: 'database',
      tech: 'PostgreSQL',
      description: 'User profiles and preferences',
      status: 'healthy'
    }
  },
  {
    id: 'postgres-payments',
    type: 'service',
    position: { x: 400, y: 460 },
    data: {
      label: 'Payments DB',
      icon: '🗄️',
      type: 'database',
      tech: 'PostgreSQL',
      description: 'Transaction ledger',
      status: 'healthy'
    }
  },

  // External
  {
    id: 'maps-api',
    type: 'service',
    position: { x: 550, y: 340 },
    data: {
      label: 'Maps API',
      icon: '🌍',
      type: 'external',
      tech: 'Google Maps',
      description: 'ETA and routing',
      status: 'healthy'
    }
  },
  {
    id: 'stripe',
    type: 'service',
    position: { x: 550, y: 460 },
    data: {
      label: 'Stripe',
      icon: '💸',
      type: 'external',
      tech: 'Payment Gateway',
      description: 'Credit card processing',
      status: 'healthy'
    }
  },
];

const initialEdges: Edge[] = [
  // Client to Gateway
  { id: 'e1', source: 'rider-app', target: 'api-gateway', animated: true, style: { stroke: '#10b981' } },
  { id: 'e2', source: 'driver-app', target: 'api-gateway', animated: true, style: { stroke: '#10b981' } },

  // Gateway to Services
  { id: 'e3', source: 'api-gateway', target: 'ride-service', animated: true, style: { stroke: '#6366f1' } },
  { id: 'e4', source: 'api-gateway', target: 'dispatch-service', animated: true, style: { stroke: '#6366f1' } },
  { id: 'e5', source: 'api-gateway', target: 'pricing-service', animated: true, style: { stroke: '#6366f1' } },

  // Service interconnections
  { id: 'e6', source: 'ride-service', target: 'dispatch-service', style: { stroke: '#8b5cf6' } },
  { id: 'e7', source: 'dispatch-service', target: 'pricing-service', style: { stroke: '#8b5cf6' } },
  { id: 'e8', source: 'ride-service', target: 'location-service', style: { stroke: '#8b5cf6' } },
  { id: 'e9', source: 'dispatch-service', target: 'location-service', style: { stroke: '#8b5cf6' } },
  { id: 'e10', source: 'ride-service', target: 'kafka', style: { stroke: '#06b6d4' } },
  { id: 'e11', source: 'kafka', target: 'payment-service', animated: true, style: { stroke: '#06b6d4' } },

  // Cache connections
  { id: 'e12', source: 'dispatch-service', target: 'redis', style: { stroke: '#ef4444' } },
  { id: 'e13', source: 'location-service', target: 'redis', style: { stroke: '#ef4444' } },
  { id: 'e14', source: 'pricing-service', target: 'redis', style: { stroke: '#ef4444' } },

  // Database connections
  { id: 'e15', source: 'ride-service', target: 'postgres-rides', style: { stroke: '#f59e0b' } },
  { id: 'e16', source: 'dispatch-service', target: 'postgres-users', style: { stroke: '#f59e0b' } },
  { id: 'e17', source: 'payment-service', target: 'postgres-payments', style: { stroke: '#f59e0b' } },

  // External connections
  { id: 'e18', source: 'location-service', target: 'maps-api', style: { stroke: '#ec4899' } },
  { id: 'e19', source: 'payment-service', target: 'stripe', style: { stroke: '#ec4899' } },
];

export default function SystemDesignVisualizer() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null);
  const [scenario, setScenario] = useState<Scenario>('normal');
  const [requestFlow, setRequestFlow] = useState(false);

  // Apply scenario effects
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        const newNode = { ...node, data: { ...node.data } };

        switch (scenario) {
          case 'normal':
            newNode.data.status = 'healthy';
            break;
          case 'high-load':
            if (['dispatch-service', 'location-service', 'redis'].includes(node.id)) {
              newNode.data.status = 'degraded';
            } else {
              newNode.data.status = 'healthy';
            }
            break;
          case 'failure':
            if (node.id === 'payment-service') {
              newNode.data.status = 'down';
            } else if (node.id === 'kafka') {
              newNode.data.status = 'degraded';
            } else {
              newNode.data.status = 'healthy';
            }
            break;
          case 'partition':
            if (['postgres-rides', 'postgres-payments'].includes(node.id)) {
              newNode.data.status = 'degraded';
            } else if (node.id === 'stripe') {
              newNode.data.status = 'down';
            } else {
              newNode.data.status = 'healthy';
            }
            break;
        }
        return newNode;
      })
    );
  }, [scenario, setNodes]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node<NodeData>) => {
    setSelectedNode(node);
  }, []);

  const simulateRequest = () => {
    setRequestFlow(true);
    setTimeout(() => setRequestFlow(false), 3000);
  };

  const scenarioDescriptions: Record<Scenario, string> = {
    normal: 'All services operating normally with healthy latencies',
    'high-load': 'Surge pricing active, dispatch and location services under heavy load',
    failure: 'Payment service down, events queuing in Kafka for retry',
    partition: 'Network partition - external payment gateway unreachable',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">System Design Visualizer</h2>
        <p className="text-gray-400 text-sm">
          Interactive Uber-style ride service architecture
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={simulateRequest}
          className="btn-primary text-sm"
          disabled={requestFlow}
        >
          {requestFlow ? '● Simulating...' : 'Simulate Ride Request'}
        </button>
        <select
          value={scenario}
          onChange={(e) => setScenario(e.target.value as Scenario)}
          className="btn-glass text-sm bg-transparent cursor-pointer"
        >
          <option value="normal">Normal Operation</option>
          <option value="high-load">High Load (Surge)</option>
          <option value="failure">Service Failure</option>
          <option value="partition">Network Partition</option>
        </select>
      </div>

      {/* Scenario Description */}
      <div className={`text-center text-sm px-4 py-2 rounded-lg mx-auto max-w-xl
        ${scenario === 'normal' ? 'text-green-400 bg-green-500/10' :
          scenario === 'high-load' ? 'text-yellow-400 bg-yellow-500/10' :
          'text-red-400 bg-red-500/10'}`}
      >
        {scenarioDescriptions[scenario]}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Flow Diagram */}
        <div className="lg:col-span-2 glass-strong rounded-2xl overflow-hidden" style={{ height: 600 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-left"
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#334155" gap={20} />
            <Controls className="!bg-gray-800/80 !border-gray-700" />
            <MiniMap
              className="!bg-gray-800/80"
              nodeColor={(node) => nodeColors[(node.data as NodeData).type]}
            />
          </ReactFlow>
        </div>

        {/* Details Panel */}
        <div className="space-y-4">
          {/* Selected Node Details */}
          <AnimatePresence mode="wait">
            {selectedNode ? (
              <motion.div
                key={selectedNode.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="glass-strong p-4 rounded-xl"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{selectedNode.data.icon}</span>
                  <div>
                    <h3 className="text-white font-medium">{selectedNode.data.label}</h3>
                    <span className="text-xs text-gray-400">{selectedNode.data.tech}</span>
                  </div>
                  <div className={`ml-auto px-2 py-1 rounded text-xs
                    ${selectedNode.data.status === 'healthy' ? 'bg-green-500/20 text-green-400' :
                      selectedNode.data.status === 'degraded' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'}`}
                  >
                    {selectedNode.data.status}
                  </div>
                </div>

                <p className="text-gray-400 text-sm mb-4">{selectedNode.data.description}</p>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  {selectedNode.data.throughput && (
                    <div className="glass p-2 rounded-lg">
                      <div className="text-gray-500 text-xs">Throughput</div>
                      <div className="text-white">{selectedNode.data.throughput}</div>
                    </div>
                  )}
                  {selectedNode.data.latency && (
                    <div className="glass p-2 rounded-lg">
                      <div className="text-gray-500 text-xs">Latency</div>
                      <div className="text-white">{selectedNode.data.latency}</div>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass p-4 rounded-xl text-center text-gray-400 text-sm"
              >
                Click a node to see details
              </motion.div>
            )}
          </AnimatePresence>

          {/* Legend */}
          <div className="glass p-4 rounded-xl">
            <h3 className="text-sm font-medium text-white mb-3">Component Types</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(nodeColors).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-gray-400 capitalize">{type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Architecture Notes */}
          <div className="glass p-4 rounded-xl">
            <h3 className="text-sm font-medium text-white mb-2">Architecture Highlights</h3>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• <span className="text-cyan-400">Kafka</span> for async event processing</li>
              <li>• <span className="text-red-400">Redis</span> for low-latency location data</li>
              <li>• <span className="text-purple-400">Microservices</span> enable independent scaling</li>
              <li>• <span className="text-yellow-400">PostgreSQL</span> per domain (rides, users, payments)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="glass p-4 rounded-xl text-sm text-gray-400">
        <h3 className="font-medium text-white mb-2">About This Design:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>Simplified version of Uber's ride-matching architecture</li>
          <li>Click nodes to see technology stack and performance characteristics</li>
          <li>Switch scenarios to see how the system handles failures and load</li>
          <li>Real systems include many more services: notifications, analytics, ML, etc.</li>
        </ul>
      </div>
    </div>
  );
}
