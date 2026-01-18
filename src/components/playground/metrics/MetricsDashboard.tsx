import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface MetricPoint {
  time: string;
  p50: number;
  p95: number;
  p99: number;
  throughput: number;
  errorRate: number;
}

type CircuitState = 'closed' | 'open' | 'half-open';

const generateMetricPoint = (isIncident: boolean, index: number): MetricPoint => {
  const baseP50 = isIncident ? 150 + Math.random() * 100 : 20 + Math.random() * 30;
  const baseP95 = baseP50 * (isIncident ? 3 : 2);
  const baseP99 = baseP95 * (isIncident ? 2 : 1.5);

  return {
    time: `${index}s`,
    p50: Math.round(baseP50),
    p95: Math.round(baseP95),
    p99: Math.round(baseP99),
    throughput: isIncident
      ? Math.round(500 + Math.random() * 200)
      : Math.round(2000 + Math.random() * 500),
    errorRate: isIncident
      ? Math.round(5 + Math.random() * 15)
      : Math.round(Math.random() * 2),
  };
};

export default function MetricsDashboard() {
  const [data, setData] = useState<MetricPoint[]>(() =>
    Array.from({ length: 20 }, (_, i) => generateMetricPoint(false, i))
  );
  const [isIncident, setIsIncident] = useState(false);
  const [circuitState, setCircuitState] = useState<CircuitState>('closed');
  const [isLive, setIsLive] = useState(true);

  // Simulate real-time data
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      setData(prev => {
        const newData = [...prev.slice(1)];
        newData.push(generateMetricPoint(isIncident, prev.length));
        return newData;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isLive, isIncident]);

  // Circuit breaker logic
  useEffect(() => {
    const latestErrorRate = data[data.length - 1]?.errorRate || 0;

    if (circuitState === 'closed' && latestErrorRate > 10) {
      setCircuitState('open');
    } else if (circuitState === 'open') {
      const timeout = setTimeout(() => setCircuitState('half-open'), 3000);
      return () => clearTimeout(timeout);
    } else if (circuitState === 'half-open' && latestErrorRate < 5) {
      setCircuitState('closed');
    } else if (circuitState === 'half-open' && latestErrorRate > 10) {
      setCircuitState('open');
    }
  }, [data, circuitState]);

  const toggleIncident = () => {
    setIsIncident(!isIncident);
    if (!isIncident) {
      setCircuitState('closed');
    }
  };

  const latestMetrics = data[data.length - 1];

  const getCircuitColor = (state: CircuitState) => {
    switch (state) {
      case 'closed': return 'text-green-400 bg-green-500/20';
      case 'open': return 'text-red-400 bg-red-500/20';
      case 'half-open': return 'text-yellow-400 bg-yellow-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Service Metrics</h2>
          <p className="text-[var(--text-secondary)] text-sm">Real-time observability dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsLive(!isLive)}
            className={`btn-glass text-sm ${isLive ? 'border-green-500' : ''}`}
          >
            {isLive ? '● Live' : '○ Paused'}
          </button>
          <button
            onClick={toggleIncident}
            className={`btn-glass text-sm ${isIncident ? 'bg-red-500/20 border-red-500' : ''}`}
          >
            {isIncident ? '🔥 Incident Active' : 'Simulate Incident'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          className="glass p-4 rounded-xl"
          animate={{ borderColor: latestMetrics?.p99 > 500 ? '#ef4444' : 'rgba(255,255,255,0.1)' }}
        >
          <div className="text-[var(--text-secondary)] text-xs mb-1">P99 Latency</div>
          <div className={`text-2xl font-bold ${latestMetrics?.p99 > 500 ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>
            {latestMetrics?.p99}ms
          </div>
          <div className="text-xs text-[var(--text-muted)]">SLO: &lt;500ms</div>
        </motion.div>

        <motion.div
          className="glass p-4 rounded-xl"
          animate={{ borderColor: latestMetrics?.throughput < 1000 ? '#f59e0b' : 'rgba(255,255,255,0.1)' }}
        >
          <div className="text-[var(--text-secondary)] text-xs mb-1">Throughput</div>
          <div className={`text-2xl font-bold ${latestMetrics?.throughput < 1000 ? 'text-yellow-400' : 'text-[var(--text-primary)]'}`}>
            {latestMetrics?.throughput}
          </div>
          <div className="text-xs text-[var(--text-muted)]">req/sec</div>
        </motion.div>

        <motion.div
          className="glass p-4 rounded-xl"
          animate={{ borderColor: latestMetrics?.errorRate > 5 ? '#ef4444' : 'rgba(255,255,255,0.1)' }}
        >
          <div className="text-[var(--text-secondary)] text-xs mb-1">Error Rate</div>
          <div className={`text-2xl font-bold ${latestMetrics?.errorRate > 5 ? 'text-red-400' : 'text-green-400'}`}>
            {latestMetrics?.errorRate}%
          </div>
          <div className="text-xs text-[var(--text-muted)]">SLO: &lt;5%</div>
        </motion.div>

        <motion.div className={`glass p-4 rounded-xl ${getCircuitColor(circuitState)}`}>
          <div className="text-[var(--text-secondary)] text-xs mb-1">Circuit Breaker</div>
          <div className="text-2xl font-bold capitalize">{circuitState}</div>
          <div className="text-xs text-[var(--text-muted)]">Auto-managed</div>
        </motion.div>
      </div>

      {/* Latency Chart */}
      <div className="glass-strong p-6 rounded-2xl">
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">Latency Percentiles</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="time" stroke="#666" fontSize={10} />
            <YAxis stroke="#666" fontSize={10} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(0,0,0,0.8)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
              }}
            />
            <ReferenceLine y={500} stroke="#ef4444" strokeDasharray="5 5" label="SLO" />
            <Line type="monotone" dataKey="p50" stroke="#10b981" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="p95" stroke="#f59e0b" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="p99" stroke="#ef4444" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-6 mt-2 text-xs">
          <span className="text-green-400">● P50</span>
          <span className="text-yellow-400">● P95</span>
          <span className="text-red-400">● P99</span>
        </div>
      </div>

      {/* Throughput & Errors */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-strong p-6 rounded-2xl">
          <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">Throughput</h3>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="time" stroke="#666" fontSize={10} />
              <YAxis stroke="#666" fontSize={10} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                }}
              />
              <Area
                type="monotone"
                dataKey="throughput"
                stroke="#525252"
                fill="rgba(99, 102, 241, 0.2)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-strong p-6 rounded-2xl">
          <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">Error Rate</h3>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="time" stroke="#666" fontSize={10} />
              <YAxis stroke="#666" fontSize={10} domain={[0, 20]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                }}
              />
              <ReferenceLine y={5} stroke="#ef4444" strokeDasharray="5 5" />
              <Area
                type="monotone"
                dataKey="errorRate"
                stroke="#ef4444"
                fill="rgba(239, 68, 68, 0.2)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Explanation */}
      <div className="glass p-4 rounded-xl text-sm text-[var(--text-secondary)]">
        <h3 className="font-medium text-[var(--text-primary)] mb-2">Dashboard Features:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li><span className="text-green-400">Latency percentiles</span> show P50, P95, P99 with SLO threshold</li>
          <li><span className="text-zinc-500">Circuit breaker</span> automatically opens when error rate exceeds 10%</li>
          <li>Click <span className="text-red-400">"Simulate Incident"</span> to see degradation patterns</li>
          <li>Real-world dashboards use tools like Grafana, Datadog, or Prometheus</li>
        </ul>
      </div>
    </div>
  );
}
