import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type CircuitState = 'closed' | 'open' | 'half-open';

interface Request {
  id: number;
  timestamp: number;
  latency: number;
  success: boolean;
  blocked: boolean;
  rateLimited: boolean;
}

interface MetricPoint {
  timestamp: number;
  latency: number;
  throughput: number;
  errorRate: number;
  circuitState: CircuitState;
}

export default function CircuitBreakerWithMetrics() {
  // Circuit Breaker State
  const [circuitState, setCircuitState] = useState<CircuitState>('closed');
  const [failureCount, setFailureCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [lastStateChange, setLastStateChange] = useState(Date.now());

  // Rate Limiter State (Token Bucket)
  const [tokens, setTokens] = useState(10);
  const [maxTokens] = useState(10);
  const [refillRate] = useState(2);

  // Config
  const [failureThreshold] = useState(5);
  const [successThreshold] = useState(3);
  const [openDuration] = useState(5000);
  const [errorRate, setErrorRate] = useState(30);
  const [baseLatency, setBaseLatency] = useState(50);

  // Requests & Metrics
  const [requests, setRequests] = useState<Request[]>([]);
  const [metrics, setMetrics] = useState<MetricPoint[]>([]);
  const [recentRequests, setRecentRequests] = useState<Request[]>([]);

  const requestIdRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const metricsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [autoMode, setAutoMode] = useState(false);

  // Calculate real-time metrics
  const calculateMetrics = useCallback(() => {
    const now = Date.now();
    const windowMs = 2000; // 2 second window
    const windowRequests = recentRequests.filter(r => now - r.timestamp < windowMs);

    const successfulRequests = windowRequests.filter(r => r.success && !r.blocked && !r.rateLimited);
    const failedRequests = windowRequests.filter(r => !r.success && !r.blocked && !r.rateLimited);

    const avgLatency = successfulRequests.length > 0
      ? successfulRequests.reduce((sum, r) => sum + r.latency, 0) / successfulRequests.length
      : 0;

    const throughput = windowRequests.filter(r => !r.blocked && !r.rateLimited).length / (windowMs / 1000);

    const errorRateCalc = windowRequests.length > 0
      ? (failedRequests.length / windowRequests.filter(r => !r.blocked && !r.rateLimited).length) * 100 || 0
      : 0;

    return {
      timestamp: now,
      latency: avgLatency,
      throughput,
      errorRate: errorRateCalc,
      circuitState
    };
  }, [recentRequests, circuitState]);

  // Token refill
  useEffect(() => {
    const refillInterval = setInterval(() => {
      setTokens(prev => Math.min(prev + refillRate, maxTokens));
    }, 1000);
    return () => clearInterval(refillInterval);
  }, [refillRate, maxTokens]);

  // Metrics collection
  useEffect(() => {
    metricsIntervalRef.current = setInterval(() => {
      const newMetric = calculateMetrics();
      setMetrics(prev => [...prev.slice(-30), newMetric]);
    }, 500);
    return () => {
      if (metricsIntervalRef.current) clearInterval(metricsIntervalRef.current);
    };
  }, [calculateMetrics]);

  // Circuit breaker timeout
  useEffect(() => {
    if (circuitState === 'open') {
      const timer = setTimeout(() => {
        setCircuitState('half-open');
        setLastStateChange(Date.now());
      }, openDuration);
      return () => clearTimeout(timer);
    }
  }, [circuitState, openDuration, lastStateChange]);

  // Clean old requests
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setRecentRequests(prev => prev.filter(r => now - r.timestamp < 5000));
    }, 1000);
    return () => clearInterval(cleanupInterval);
  }, []);

  const makeRequest = useCallback(() => {
    const now = Date.now();
    const requestId = requestIdRef.current++;

    // Simulate latency (higher when failing)
    const latency = baseLatency + Math.random() * 50 + (circuitState === 'half-open' ? 100 : 0);

    // Check rate limit first
    if (tokens < 1) {
      const request: Request = {
        id: requestId,
        timestamp: now,
        latency: 0,
        success: false,
        blocked: false,
        rateLimited: true
      };
      setRequests(prev => [...prev.slice(-99), request]);
      setRecentRequests(prev => [...prev, request]);
      return;
    }

    setTokens(prev => prev - 1);

    // Check circuit breaker
    if (circuitState === 'open') {
      const request: Request = {
        id: requestId,
        timestamp: now,
        latency: 0,
        success: false,
        blocked: true,
        rateLimited: false
      };
      setRequests(prev => [...prev.slice(-99), request]);
      setRecentRequests(prev => [...prev, request]);
      return;
    }

    const success = Math.random() * 100 > errorRate;

    const request: Request = {
      id: requestId,
      timestamp: now,
      latency: success ? latency : latency * 2, // Failed requests take longer
      success,
      blocked: false,
      rateLimited: false
    };
    setRequests(prev => [...prev.slice(-99), request]);
    setRecentRequests(prev => [...prev, request]);

    if (success) {
      if (circuitState === 'half-open') {
        setSuccessCount(prev => {
          const newCount = prev + 1;
          if (newCount >= successThreshold) {
            setCircuitState('closed');
            setLastStateChange(Date.now());
            setFailureCount(0);
            return 0;
          }
          return newCount;
        });
      } else {
        setFailureCount(0);
      }
    } else {
      if (circuitState === 'half-open') {
        setCircuitState('open');
        setLastStateChange(Date.now());
        setSuccessCount(0);
      } else {
        setFailureCount(prev => {
          const newCount = prev + 1;
          if (newCount >= failureThreshold) {
            setCircuitState('open');
            setLastStateChange(Date.now());
            return 0;
          }
          return newCount;
        });
      }
    }
  }, [circuitState, tokens, errorRate, baseLatency, failureThreshold, successThreshold]);

  // Auto mode
  useEffect(() => {
    if (autoMode) {
      intervalRef.current = setInterval(() => {
        makeRequest();
      }, 100);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoMode, makeRequest]);

  const reset = () => {
    setCircuitState('closed');
    setFailureCount(0);
    setSuccessCount(0);
    setTokens(maxTokens);
    setRequests([]);
    setRecentRequests([]);
    setMetrics([]);
    setAutoMode(false);
  };

  // Calculate percentiles from recent latencies
  const latencies = recentRequests
    .filter(r => r.success && !r.blocked && !r.rateLimited)
    .map(r => r.latency)
    .sort((a, b) => a - b);

  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

  const currentMetrics = metrics[metrics.length - 1] || { latency: 0, throughput: 0, errorRate: 0 };

  const stateColors: Record<CircuitState, string> = {
    closed: '#22c55e',
    open: '#ef4444',
    'half-open': '#eab308'
  };

  // Simple sparkline component
  const Sparkline = ({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) => {
    if (data.length < 2) return <div style={{ height }} className="bg-zinc-800/50 rounded" />;
    const max = Math.max(...data, 1);
    const points = data.map((v, i) => ({
      x: (i / (data.length - 1)) * 100,
      y: height - (v / max) * height
    }));
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
      <svg width="100%" height={height} className="overflow-visible">
        <path d={pathD} fill="none" stroke={color} strokeWidth={2} />
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="glass-strong rounded-xl p-6">
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={makeRequest}
            disabled={autoMode}
            className="px-6 py-3 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/30 transition-all disabled:opacity-50"
          >
            Send Request
          </button>
          <button
            onClick={() => setAutoMode(!autoMode)}
            className={`px-6 py-3 rounded-lg transition-all ${
              autoMode
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50'
            }`}
          >
            {autoMode ? 'Stop Auto (10 req/s)' : 'Auto Mode'}
          </button>
          <button
            onClick={reset}
            className="px-4 py-3 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
          >
            Reset
          </button>
          <div className="flex items-center gap-3 ml-auto">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 w-16">Error %:</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={errorRate}
                  onChange={(e) => setErrorRate(Number(e.target.value))}
                  className="w-20"
                />
                <span className="text-xs text-[var(--text-primary)] font-mono w-8">{errorRate}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 w-16">Latency:</span>
                <input
                  type="range"
                  min="10"
                  max="200"
                  value={baseLatency}
                  onChange={(e) => setBaseLatency(Number(e.target.value))}
                  className="w-20"
                />
                <span className="text-xs text-[var(--text-primary)] font-mono w-8">{baseLatency}ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Metrics Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-strong rounded-xl p-4">
          <div className="text-xs text-zinc-500 mb-1">Throughput</div>
          <div className="text-2xl font-bold text-[var(--text-primary)]">
            {currentMetrics.throughput.toFixed(1)} <span className="text-sm text-zinc-500">req/s</span>
          </div>
          <div className="mt-2">
            <Sparkline data={metrics.map(m => m.throughput)} color="#3b82f6" />
          </div>
        </div>
        <div className="glass-strong rounded-xl p-4">
          <div className="text-xs text-zinc-500 mb-1">Avg Latency</div>
          <div className="text-2xl font-bold text-[var(--text-primary)]">
            {currentMetrics.latency.toFixed(0)} <span className="text-sm text-zinc-500">ms</span>
          </div>
          <div className="mt-2">
            <Sparkline data={metrics.map(m => m.latency)} color="#22c55e" />
          </div>
        </div>
        <div className="glass-strong rounded-xl p-4">
          <div className="text-xs text-zinc-500 mb-1">Error Rate</div>
          <div className={`text-2xl font-bold ${currentMetrics.errorRate > 50 ? 'text-red-400' : currentMetrics.errorRate > 20 ? 'text-yellow-400' : 'text-emerald-400'}`}>
            {currentMetrics.errorRate.toFixed(1)} <span className="text-sm text-zinc-500">%</span>
          </div>
          <div className="mt-2">
            <Sparkline data={metrics.map(m => m.errorRate)} color={currentMetrics.errorRate > 50 ? '#ef4444' : '#eab308'} />
          </div>
        </div>
        <div className="glass-strong rounded-xl p-4">
          <div className="text-xs text-zinc-500 mb-1">Circuit State</div>
          <div className="text-2xl font-bold uppercase" style={{ color: stateColors[circuitState] }}>
            {circuitState}
          </div>
          <div className="mt-2 flex gap-1">
            {metrics.slice(-20).map((m, i) => (
              <div
                key={i}
                className="flex-1 h-6 rounded-sm"
                style={{ backgroundColor: stateColors[m.circuitState] + '40' }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Latency Percentiles */}
      <div className="glass-strong rounded-xl p-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Latency Percentiles</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-lg bg-zinc-800/30">
            <div className="text-xs text-zinc-500 mb-1">P50</div>
            <div className="text-3xl font-bold text-emerald-400">{p50.toFixed(0)}<span className="text-sm text-zinc-500">ms</span></div>
          </div>
          <div className="text-center p-4 rounded-lg bg-zinc-800/30">
            <div className="text-xs text-zinc-500 mb-1">P95</div>
            <div className="text-3xl font-bold text-yellow-400">{p95.toFixed(0)}<span className="text-sm text-zinc-500">ms</span></div>
          </div>
          <div className="text-center p-4 rounded-lg bg-zinc-800/30">
            <div className="text-xs text-zinc-500 mb-1">P99</div>
            <div className="text-3xl font-bold text-red-400">{p99.toFixed(0)}<span className="text-sm text-zinc-500">ms</span></div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Circuit Breaker State Machine */}
        <div className="glass-strong rounded-xl p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-6">Circuit Breaker</h3>

          <div className="flex items-center justify-center gap-4 mb-6">
            {(['closed', 'half-open', 'open'] as CircuitState[]).map((state, i) => (
              <div key={state} className="flex items-center gap-4">
                <motion.div
                  animate={{
                    scale: circuitState === state ? 1.1 : 1,
                    boxShadow: circuitState === state ? `0 0 20px ${stateColors[state]}50` : 'none'
                  }}
                  className={`w-16 h-16 rounded-full flex items-center justify-center border-2`}
                  style={{
                    borderColor: stateColors[state],
                    backgroundColor: circuitState === state ? `${stateColors[state]}20` : 'transparent'
                  }}
                >
                  <span className={`text-xs font-medium uppercase ${circuitState === state ? '' : 'text-zinc-500'}`}
                    style={{ color: circuitState === state ? stateColors[state] : undefined }}>
                    {state.split('-')[0]}
                  </span>
                </motion.div>
                {i < 2 && (
                  <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-zinc-800/30">
              <div className="text-xs text-zinc-500 mb-1">Failures to Open</div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-red-400">{failureCount}</span>
                <span className="text-sm text-zinc-500">/ {failureThreshold}</span>
              </div>
              <div className="mt-2 w-full bg-zinc-700 rounded-full h-1.5">
                <div className="bg-red-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${(failureCount / failureThreshold) * 100}%` }} />
              </div>
            </div>
            <div className="p-3 rounded-lg bg-zinc-800/30">
              <div className="text-xs text-zinc-500 mb-1">Successes to Close</div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-emerald-400">{successCount}</span>
                <span className="text-sm text-zinc-500">/ {successThreshold}</span>
              </div>
              <div className="mt-2 w-full bg-zinc-700 rounded-full h-1.5">
                <div className="bg-emerald-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${(successCount / successThreshold) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Rate Limiter */}
        <div className="glass-strong rounded-xl p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-6">Token Bucket Rate Limiter</h3>

          <div className="flex flex-wrap gap-2 justify-center mb-4">
            {Array.from({ length: maxTokens }).map((_, i) => (
              <motion.div
                key={i}
                animate={{ scale: i < tokens ? 1 : 0.7, opacity: i < tokens ? 1 : 0.2 }}
                className={`w-8 h-8 rounded-full ${i < tokens ? 'bg-blue-500' : 'bg-zinc-700'}`}
              />
            ))}
          </div>

          <div className="text-center mb-4">
            <span className="text-3xl font-bold text-blue-400">{tokens}</span>
            <span className="text-zinc-500"> / {maxTokens}</span>
          </div>

          <div className="p-3 rounded-lg bg-zinc-800/30 text-center">
            <span className="text-sm text-zinc-400">Refill: {refillRate} tokens/sec</span>
          </div>
        </div>
      </div>

      {/* Request Stream */}
      <div className="glass-strong rounded-xl p-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Request Stream (last 100)</h3>
        <div className="flex gap-0.5 flex-wrap h-12 overflow-hidden">
          <AnimatePresence>
            {requests.slice(-100).map((req) => (
              <motion.div
                key={req.id}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`w-2 h-2 rounded-sm ${
                  req.rateLimited ? 'bg-purple-500' :
                  req.blocked ? 'bg-orange-500' :
                  req.success ? 'bg-emerald-500' : 'bg-red-500'
                }`}
              />
            ))}
          </AnimatePresence>
        </div>
        <div className="flex gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-emerald-500" /><span className="text-zinc-400">Success</span></div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-red-500" /><span className="text-zinc-400">Failed</span></div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-orange-500" /><span className="text-zinc-400">Circuit Open</span></div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-purple-500" /><span className="text-zinc-400">Rate Limited</span></div>
        </div>
      </div>
    </div>
  );
}
