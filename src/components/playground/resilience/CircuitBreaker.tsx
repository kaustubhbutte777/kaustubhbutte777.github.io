import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type CircuitState = 'closed' | 'open' | 'half-open';

interface Request {
  id: number;
  timestamp: number;
  success: boolean;
  blocked: boolean;
  rateLimited: boolean;
}

interface CircuitStats {
  successCount: number;
  failureCount: number;
  totalRequests: number;
  blockedRequests: number;
  rateLimitedRequests: number;
}

export default function CircuitBreakerDemo() {
  // Circuit Breaker State
  const [circuitState, setCircuitState] = useState<CircuitState>('closed');
  const [failureCount, setFailureCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [lastStateChange, setLastStateChange] = useState(Date.now());

  // Rate Limiter State (Token Bucket)
  const [tokens, setTokens] = useState(10);
  const [maxTokens] = useState(10);
  const [refillRate] = useState(2); // tokens per second

  // Config
  const [failureThreshold] = useState(5);
  const [successThreshold] = useState(3);
  const [openDuration] = useState(5000); // 5 seconds
  const [errorRate, setErrorRate] = useState(30); // percentage

  // Request History
  const [requests, setRequests] = useState<Request[]>([]);
  const [stats, setStats] = useState<CircuitStats>({
    successCount: 0,
    failureCount: 0,
    totalRequests: 0,
    blockedRequests: 0,
    rateLimitedRequests: 0
  });

  const requestIdRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [autoMode, setAutoMode] = useState(false);

  // Token refill
  useEffect(() => {
    const refillInterval = setInterval(() => {
      setTokens(prev => Math.min(prev + refillRate, maxTokens));
    }, 1000);
    return () => clearInterval(refillInterval);
  }, [refillRate, maxTokens]);

  // Circuit breaker timeout (open -> half-open)
  useEffect(() => {
    if (circuitState === 'open') {
      const timer = setTimeout(() => {
        setCircuitState('half-open');
        setLastStateChange(Date.now());
      }, openDuration);
      return () => clearTimeout(timer);
    }
  }, [circuitState, openDuration, lastStateChange]);

  const makeRequest = useCallback(() => {
    const now = Date.now();
    const requestId = requestIdRef.current++;

    // Check rate limit first
    if (tokens < 1) {
      const request: Request = {
        id: requestId,
        timestamp: now,
        success: false,
        blocked: false,
        rateLimited: true
      };
      setRequests(prev => [...prev.slice(-49), request]);
      setStats(prev => ({
        ...prev,
        totalRequests: prev.totalRequests + 1,
        rateLimitedRequests: prev.rateLimitedRequests + 1
      }));
      return;
    }

    // Consume a token
    setTokens(prev => prev - 1);

    // Check circuit breaker
    if (circuitState === 'open') {
      const request: Request = {
        id: requestId,
        timestamp: now,
        success: false,
        blocked: true,
        rateLimited: false
      };
      setRequests(prev => [...prev.slice(-49), request]);
      setStats(prev => ({
        ...prev,
        totalRequests: prev.totalRequests + 1,
        blockedRequests: prev.blockedRequests + 1
      }));
      return;
    }

    // Simulate request with configured error rate
    const success = Math.random() * 100 > errorRate;

    const request: Request = {
      id: requestId,
      timestamp: now,
      success,
      blocked: false,
      rateLimited: false
    };
    setRequests(prev => [...prev.slice(-49), request]);

    if (success) {
      setStats(prev => ({
        ...prev,
        totalRequests: prev.totalRequests + 1,
        successCount: prev.successCount + 1
      }));

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
      setStats(prev => ({
        ...prev,
        totalRequests: prev.totalRequests + 1,
        failureCount: prev.failureCount + 1
      }));

      if (circuitState === 'half-open') {
        // Single failure in half-open trips the circuit
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
  }, [circuitState, tokens, errorRate, failureThreshold, successThreshold]);

  // Auto mode
  useEffect(() => {
    if (autoMode) {
      intervalRef.current = setInterval(() => {
        makeRequest();
      }, 200);
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
    setStats({
      successCount: 0,
      failureCount: 0,
      totalRequests: 0,
      blockedRequests: 0,
      rateLimitedRequests: 0
    });
    setAutoMode(false);
  };

  const stateColors: Record<CircuitState, string> = {
    closed: '#22c55e',
    open: '#ef4444',
    'half-open': '#eab308'
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
            {autoMode ? 'Stop Auto' : 'Auto Mode'}
          </button>
          <button
            onClick={reset}
            className="px-4 py-3 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
          >
            Reset
          </button>
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-sm text-zinc-400">Error Rate:</span>
            <input
              type="range"
              min="0"
              max="100"
              value={errorRate}
              onChange={(e) => setErrorRate(Number(e.target.value))}
              className="w-24"
            />
            <span className="text-sm text-[var(--text-primary)] font-mono w-12">{errorRate}%</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Circuit Breaker */}
        <div className="glass-strong rounded-xl p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-6">Circuit Breaker</h3>

          {/* State Diagram */}
          <div className="flex items-center justify-center gap-4 mb-6">
            {(['closed', 'half-open', 'open'] as CircuitState[]).map((state, i) => (
              <div key={state} className="flex items-center gap-4">
                <motion.div
                  animate={{
                    scale: circuitState === state ? 1.1 : 1,
                    boxShadow: circuitState === state
                      ? `0 0 20px ${stateColors[state]}50`
                      : 'none'
                  }}
                  className={`w-20 h-20 rounded-full flex items-center justify-center border-2 ${
                    circuitState === state ? 'border-opacity-100' : 'border-opacity-30'
                  }`}
                  style={{
                    borderColor: stateColors[state],
                    backgroundColor: circuitState === state
                      ? `${stateColors[state]}20`
                      : 'transparent'
                  }}
                >
                  <span className={`text-xs font-medium uppercase ${
                    circuitState === state ? '' : 'text-zinc-500'
                  }`} style={{ color: circuitState === state ? stateColors[state] : undefined }}>
                    {state}
                  </span>
                </motion.div>
                {i < 2 && (
                  <svg className="w-6 h-6 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            ))}
          </div>

          {/* Counters */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-zinc-800/30">
              <div className="text-xs text-zinc-500 mb-1">Consecutive Failures</div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-red-400">{failureCount}</span>
                <span className="text-sm text-zinc-500">/ {failureThreshold}</span>
              </div>
              <div className="mt-2 w-full bg-zinc-700 rounded-full h-1.5">
                <div
                  className="bg-red-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${(failureCount / failureThreshold) * 100}%` }}
                />
              </div>
            </div>
            <div className="p-4 rounded-lg bg-zinc-800/30">
              <div className="text-xs text-zinc-500 mb-1">Half-Open Successes</div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-emerald-400">{successCount}</span>
                <span className="text-sm text-zinc-500">/ {successThreshold}</span>
              </div>
              <div className="mt-2 w-full bg-zinc-700 rounded-full h-1.5">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${(successCount / successThreshold) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Rate Limiter (Token Bucket) */}
        <div className="glass-strong rounded-xl p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-6">
            Rate Limiter (Token Bucket)
          </h3>

          {/* Token Visualization */}
          <div className="flex flex-wrap gap-2 justify-center mb-6">
            {Array.from({ length: maxTokens }).map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  scale: i < tokens ? 1 : 0.8,
                  opacity: i < tokens ? 1 : 0.3
                }}
                className={`w-8 h-8 rounded-full ${
                  i < tokens ? 'bg-blue-500' : 'bg-zinc-700'
                }`}
              />
            ))}
          </div>

          <div className="text-center mb-4">
            <span className="text-3xl font-bold text-blue-400">{tokens}</span>
            <span className="text-zinc-500"> / {maxTokens} tokens</span>
          </div>

          <div className="p-4 rounded-lg bg-zinc-800/30 text-center">
            <div className="text-xs text-zinc-500 mb-1">Refill Rate</div>
            <div className="text-lg font-medium text-[var(--text-primary)]">
              {refillRate} tokens/second
            </div>
          </div>
        </div>
      </div>

      {/* Request Stream */}
      <div className="glass-strong rounded-xl p-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Request Stream</h3>
        <div className="flex gap-1 flex-wrap h-16 overflow-hidden">
          <AnimatePresence>
            {requests.slice(-50).map((req) => (
              <motion.div
                key={req.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className={`w-3 h-3 rounded-sm ${
                  req.rateLimited
                    ? 'bg-purple-500'
                    : req.blocked
                    ? 'bg-orange-500'
                    : req.success
                    ? 'bg-emerald-500'
                    : 'bg-red-500'
                }`}
                title={
                  req.rateLimited
                    ? 'Rate Limited'
                    : req.blocked
                    ? 'Circuit Open'
                    : req.success
                    ? 'Success'
                    : 'Failed'
                }
              />
            ))}
          </AnimatePresence>
        </div>
        <div className="flex gap-6 mt-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-emerald-500" />
            <span className="text-zinc-400">Success</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-red-500" />
            <span className="text-zinc-400">Failed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-orange-500" />
            <span className="text-zinc-400">Circuit Open</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-purple-500" />
            <span className="text-zinc-400">Rate Limited</span>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: stats.totalRequests, color: 'text-[var(--text-primary)]' },
          { label: 'Success', value: stats.successCount, color: 'text-emerald-400' },
          { label: 'Failed', value: stats.failureCount, color: 'text-red-400' },
          { label: 'Blocked', value: stats.blockedRequests, color: 'text-orange-400' },
          { label: 'Rate Limited', value: stats.rateLimitedRequests, color: 'text-purple-400' },
        ].map(stat => (
          <div key={stat.label} className="glass rounded-lg p-4 text-center">
            <div className="text-xs text-zinc-500 mb-1">{stat.label}</div>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Explanation */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">How They Work Together</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="p-4 rounded-lg bg-zinc-800/30">
            <div className="font-mono text-emerald-400 mb-2">Circuit Breaker</div>
            <p className="text-[var(--text-secondary)]">
              Prevents cascading failures by stopping requests when a service is unhealthy.
              <strong> Closed</strong> → normal flow.
              <strong> Open</strong> → fail fast.
              <strong> Half-Open</strong> → test recovery.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-zinc-800/30">
            <div className="font-mono text-emerald-400 mb-2">Token Bucket Rate Limiter</div>
            <p className="text-[var(--text-secondary)]">
              Controls request throughput. Tokens refill at a steady rate. Each request consumes a token.
              Empty bucket = rate limited. Allows bursts up to bucket capacity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
