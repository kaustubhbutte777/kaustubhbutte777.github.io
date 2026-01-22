import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface VectorClock {
  [nodeId: string]: number;
}

interface Event {
  id: number;
  nodeId: string;
  type: 'local' | 'send' | 'receive';
  clock: VectorClock;
  description: string;
  relatedEventId?: number;
}

interface Message {
  id: number;
  from: string;
  to: string;
  clock: VectorClock;
  inTransit: boolean;
}

const NODE_COLORS: Record<string, string> = {
  A: '#3b82f6',
  B: '#22c55e',
  C: '#f97316',
};

const NODE_IDS = ['A', 'B', 'C'];

function clockToString(clock: VectorClock): string {
  return `[${NODE_IDS.map(id => clock[id] || 0).join(', ')}]`;
}

function compareCausality(a: VectorClock, b: VectorClock): 'before' | 'after' | 'concurrent' {
  let aBeforeB = true;
  let bBeforeA = true;

  for (const id of NODE_IDS) {
    if ((a[id] || 0) > (b[id] || 0)) bBeforeA = false;
    if ((b[id] || 0) > (a[id] || 0)) aBeforeB = false;
  }

  if (aBeforeB && !bBeforeA) return 'before';
  if (bBeforeA && !aBeforeB) return 'after';
  return 'concurrent';
}

function mergeClock(local: VectorClock, received: VectorClock): VectorClock {
  const merged: VectorClock = { ...local };
  for (const id of NODE_IDS) {
    merged[id] = Math.max(merged[id] || 0, received[id] || 0);
  }
  return merged;
}

export default function VectorClocks() {
  const [clocks, setClocks] = useState<Record<string, VectorClock>>({
    A: { A: 0, B: 0, C: 0 },
    B: { A: 0, B: 0, C: 0 },
    C: { A: 0, B: 0, C: 0 },
  });
  const [events, setEvents] = useState<Event[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<[number | null, number | null]>([null, null]);
  const [eventCounter, setEventCounter] = useState(0);
  const [messageCounter, setMessageCounter] = useState(0);

  const localEvent = useCallback((nodeId: string) => {
    setClocks(prev => {
      const newClock = { ...prev[nodeId], [nodeId]: prev[nodeId][nodeId] + 1 };
      setEvents(e => [...e, {
        id: eventCounter,
        nodeId,
        type: 'local',
        clock: { ...newClock },
        description: `Local event on ${nodeId}`
      }]);
      setEventCounter(c => c + 1);
      return { ...prev, [nodeId]: newClock };
    });
  }, [eventCounter]);

  const sendMessage = useCallback((from: string, to: string) => {
    setClocks(prev => {
      const newClock = { ...prev[from], [from]: prev[from][from] + 1 };
      const msgId = messageCounter;

      setEvents(e => [...e, {
        id: eventCounter,
        nodeId: from,
        type: 'send',
        clock: { ...newClock },
        description: `${from} → ${to}`,
        relatedEventId: msgId
      }]);

      setMessages(m => [...m, {
        id: msgId,
        from,
        to,
        clock: { ...newClock },
        inTransit: true
      }]);

      setEventCounter(c => c + 1);
      setMessageCounter(c => c + 1);

      return { ...prev, [from]: newClock };
    });
  }, [eventCounter, messageCounter]);

  const deliverMessage = useCallback((msgId: number) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg || !msg.inTransit) return;

    setClocks(prev => {
      const merged = mergeClock(prev[msg.to], msg.clock);
      merged[msg.to] = merged[msg.to] + 1;

      setEvents(e => [...e, {
        id: eventCounter,
        nodeId: msg.to,
        type: 'receive',
        clock: { ...merged },
        description: `${msg.from} → ${msg.to}`,
        relatedEventId: msgId
      }]);

      setMessages(m => m.map(message =>
        message.id === msgId ? { ...message, inTransit: false } : message
      ));

      setEventCounter(c => c + 1);

      return { ...prev, [msg.to]: merged };
    });
  }, [messages, eventCounter]);

  const reset = () => {
    setClocks({
      A: { A: 0, B: 0, C: 0 },
      B: { A: 0, B: 0, C: 0 },
      C: { A: 0, B: 0, C: 0 },
    });
    setEvents([]);
    setMessages([]);
    setSelectedEvents([null, null]);
    setEventCounter(0);
    setMessageCounter(0);
  };

  const toggleEventSelection = (eventId: number) => {
    setSelectedEvents(prev => {
      if (prev[0] === eventId) return [null, prev[1]];
      if (prev[1] === eventId) return [prev[0], null];
      if (prev[0] === null) return [eventId, prev[1]];
      if (prev[1] === null) return [prev[0], eventId];
      return [eventId, null];
    });
  };

  const causalityResult = selectedEvents[0] !== null && selectedEvents[1] !== null
    ? (() => {
        const e1 = events.find(e => e.id === selectedEvents[0])!;
        const e2 = events.find(e => e.id === selectedEvents[1])!;
        const result = compareCausality(e1.clock, e2.clock);
        return { e1, e2, result };
      })()
    : null;

  const inTransitMessages = messages.filter(m => m.inTransit);

  return (
    <div className="space-y-6">
      {/* Node Controls */}
      <div className="grid md:grid-cols-3 gap-4">
        {NODE_IDS.map((nodeId) => (
          <div
            key={nodeId}
            className="glass-strong rounded-xl p-6"
            style={{ borderColor: NODE_COLORS[nodeId], borderWidth: 2 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold" style={{ color: NODE_COLORS[nodeId] }}>
                Node {nodeId}
              </h3>
              <span className="font-mono text-lg text-[var(--text-primary)]">
                {clockToString(clocks[nodeId])}
              </span>
            </div>

            <button
              onClick={() => localEvent(nodeId)}
              className="w-full mb-3 px-4 py-2 rounded-lg text-sm font-medium bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700/50 transition-all"
            >
              Local Event
            </button>

            <div className="text-xs text-[var(--text-muted)] mb-2">Send to:</div>
            <div className="flex gap-2">
              {NODE_IDS.filter(id => id !== nodeId).map(targetId => (
                <button
                  key={targetId}
                  onClick={() => sendMessage(nodeId, targetId)}
                  className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    backgroundColor: `${NODE_COLORS[targetId]}20`,
                    color: NODE_COLORS[targetId]
                  }}
                >
                  → {targetId}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* In-Transit Messages */}
      <AnimatePresence>
        {inTransitMessages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-strong rounded-xl p-6"
          >
            <h3 className="text-lg font-semibold text-yellow-400 mb-4">
              Messages In Transit ({inTransitMessages.length})
            </h3>
            <div className="flex flex-wrap gap-3">
              {inTransitMessages.map((msg) => (
                <motion.button
                  key={msg.id}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  onClick={() => deliverMessage(msg.id)}
                  className="px-4 py-2 rounded-lg bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 text-sm font-medium hover:bg-yellow-500/30 transition-all"
                >
                  Deliver: {msg.from} → {msg.to} {clockToString(msg.clock)}
                </motion.button>
              ))}
            </div>
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              Click a message to deliver it (simulates network delay)
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Event Timeline & Causality */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Event History */}
        <div className="glass-strong rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Event History</h3>
            <button
              onClick={reset}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Reset
            </button>
          </div>

          <p className="text-xs text-[var(--text-muted)] mb-4">
            Select 2 events to compare their causality
          </p>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            <AnimatePresence>
              {events.map((event) => {
                const isSelected = selectedEvents.includes(event.id);
                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => toggleEventSelection(event.id)}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-zinc-700/50 ring-2 ring-zinc-500'
                        : 'bg-zinc-800/30 hover:bg-zinc-800/50'
                    }`}
                    style={{ borderLeft: `3px solid ${NODE_COLORS[event.nodeId]}` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm font-medium"
                          style={{ color: NODE_COLORS[event.nodeId] }}
                        >
                          {event.nodeId}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          event.type === 'local'
                            ? 'bg-zinc-700/50 text-zinc-400'
                            : event.type === 'send'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-green-500/20 text-green-400'
                        }`}>
                          {event.type}
                        </span>
                        <span className="text-xs text-zinc-500">{event.description}</span>
                      </div>
                      <span className="font-mono text-sm text-[var(--text-primary)]">
                        {clockToString(event.clock)}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {events.length === 0 && (
              <p className="text-sm text-zinc-500 text-center py-8">
                No events yet. Click buttons above to generate events.
              </p>
            )}
          </div>
        </div>

        {/* Causality Comparison */}
        <div className="glass-strong rounded-xl p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Causality Comparison</h3>

          {causalityResult ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-zinc-800/30">
                  <div className="text-xs text-[var(--text-muted)] mb-1">Event 1</div>
                  <div className="font-mono text-lg" style={{ color: NODE_COLORS[causalityResult.e1.nodeId] }}>
                    {clockToString(causalityResult.e1.clock)}
                  </div>
                  <div className="text-sm text-zinc-400 mt-1">{causalityResult.e1.description}</div>
                </div>
                <div className="p-4 rounded-lg bg-zinc-800/30">
                  <div className="text-xs text-[var(--text-muted)] mb-1">Event 2</div>
                  <div className="font-mono text-lg" style={{ color: NODE_COLORS[causalityResult.e2.nodeId] }}>
                    {clockToString(causalityResult.e2.clock)}
                  </div>
                  <div className="text-sm text-zinc-400 mt-1">{causalityResult.e2.description}</div>
                </div>
              </div>

              <div className={`p-4 rounded-lg text-center ${
                causalityResult.result === 'concurrent'
                  ? 'bg-yellow-500/20 border border-yellow-500/50'
                  : 'bg-emerald-500/20 border border-emerald-500/50'
              }`}>
                <div className={`text-2xl font-bold ${
                  causalityResult.result === 'concurrent' ? 'text-yellow-400' : 'text-emerald-400'
                }`}>
                  {causalityResult.result === 'before' && 'E1 → E2 (Happens Before)'}
                  {causalityResult.result === 'after' && 'E2 → E1 (Happens Before)'}
                  {causalityResult.result === 'concurrent' && 'E1 || E2 (Concurrent)'}
                </div>
                <div className="text-sm text-[var(--text-secondary)] mt-2">
                  {causalityResult.result === 'concurrent'
                    ? 'These events are causally independent - no ordering possible'
                    : 'There is a causal relationship between these events'}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-500">
              <p className="mb-2">Select 2 events from the history</p>
              <p className="text-sm">to compare their causal relationship</p>
            </div>
          )}
        </div>
      </div>

      {/* Explanation */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">How Vector Clocks Work</h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="p-4 rounded-lg bg-zinc-800/30">
            <div className="font-mono text-emerald-400 mb-2">Increment Rule</div>
            <p className="text-[var(--text-secondary)]">
              On any local event or send, increment your own position in the vector.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-zinc-800/30">
            <div className="font-mono text-emerald-400 mb-2">Merge Rule</div>
            <p className="text-[var(--text-secondary)]">
              On receive, take element-wise max of local and received clocks, then increment.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-zinc-800/30">
            <div className="font-mono text-emerald-400 mb-2">Causality Detection</div>
            <p className="text-[var(--text-secondary)]">
              A → B if all components of A ≤ B and at least one is strictly less. Otherwise concurrent.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
