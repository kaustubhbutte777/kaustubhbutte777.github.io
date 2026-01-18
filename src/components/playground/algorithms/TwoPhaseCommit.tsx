import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type ParticipantState = 'idle' | 'prepared' | 'committed' | 'aborted';
type CoordinatorState = 'idle' | 'preparing' | 'committing' | 'aborting' | 'committed' | 'aborted';

interface Participant {
  id: string;
  state: ParticipantState;
  willVoteYes: boolean;
}

interface Message {
  id: string;
  from: string;
  to: string;
  type: 'prepare' | 'vote-yes' | 'vote-no' | 'commit' | 'abort' | 'ack';
}

const COORDINATOR_POS = { x: 50, y: 15 };
const PARTICIPANT_POSITIONS = [
  { x: 20, y: 70 },
  { x: 40, y: 85 },
  { x: 60, y: 85 },
  { x: 80, y: 70 },
];

const stateColors: Record<ParticipantState | CoordinatorState, string> = {
  idle: '#6b7280',
  preparing: '#f59e0b',
  prepared: '#f59e0b',
  committing: '#10b981',
  committed: '#10b981',
  aborting: '#ef4444',
  aborted: '#ef4444',
};

export default function TwoPhaseCommit() {
  const [participants, setParticipants] = useState<Participant[]>([
    { id: 'P1', state: 'idle', willVoteYes: true },
    { id: 'P2', state: 'idle', willVoteYes: true },
    { id: 'P3', state: 'idle', willVoteYes: true },
    { id: 'P4', state: 'idle', willVoteYes: true },
  ]);
  const [coordinatorState, setCoordinatorState] = useState<CoordinatorState>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [phase, setPhase] = useState<'none' | 'prepare' | 'commit' | 'abort'>('none');

  const addLog = useCallback((msg: string) => {
    setLog(prev => [msg, ...prev].slice(0, 12));
  }, []);

  const toggleParticipantVote = (id: string) => {
    if (coordinatorState !== 'idle') return;
    setParticipants(prev => prev.map(p =>
      p.id === id ? { ...p, willVoteYes: !p.willVoteYes } : p
    ));
  };

  const startTransaction = useCallback(async () => {
    if (coordinatorState !== 'idle') return;

    // Phase 1: Prepare
    addLog('Coordinator: Starting transaction');
    setCoordinatorState('preparing');
    setPhase('prepare');

    // Send prepare messages
    const prepareMessages = participants.map(p => ({
      id: `prepare-${p.id}`,
      from: 'C',
      to: p.id,
      type: 'prepare' as const,
    }));
    setMessages(prepareMessages);
    addLog('Coordinator: Sending PREPARE to all participants');

    await new Promise(r => setTimeout(r, 1000));
    setMessages([]);

    // Participants vote
    const votes: Message[] = [];
    let allYes = true;

    for (const p of participants) {
      if (p.willVoteYes) {
        setParticipants(prev => prev.map(part =>
          part.id === p.id ? { ...part, state: 'prepared' } : part
        ));
        votes.push({
          id: `vote-${p.id}`,
          from: p.id,
          to: 'C',
          type: 'vote-yes',
        });
        addLog(`${p.id}: Vote YES (prepared)`);
      } else {
        setParticipants(prev => prev.map(part =>
          part.id === p.id ? { ...part, state: 'aborted' } : part
        ));
        votes.push({
          id: `vote-${p.id}`,
          from: p.id,
          to: 'C',
          type: 'vote-no',
        });
        addLog(`${p.id}: Vote NO (abort)`);
        allYes = false;
      }
      await new Promise(r => setTimeout(r, 300));
    }

    setMessages(votes);
    await new Promise(r => setTimeout(r, 1000));
    setMessages([]);

    // Phase 2: Commit or Abort
    if (allYes) {
      setCoordinatorState('committing');
      setPhase('commit');
      addLog('Coordinator: All votes YES, sending COMMIT');

      const commitMessages = participants.map(p => ({
        id: `commit-${p.id}`,
        from: 'C',
        to: p.id,
        type: 'commit' as const,
      }));
      setMessages(commitMessages);

      await new Promise(r => setTimeout(r, 1000));
      setMessages([]);

      // Participants commit
      setParticipants(prev => prev.map(p => ({ ...p, state: 'committed' })));
      setCoordinatorState('committed');
      addLog('All participants: COMMITTED');

      // Send ACKs
      const acks = participants.map(p => ({
        id: `ack-${p.id}`,
        from: p.id,
        to: 'C',
        type: 'ack' as const,
      }));
      setMessages(acks);
      await new Promise(r => setTimeout(r, 800));
      setMessages([]);
      addLog('Transaction complete!');
    } else {
      setCoordinatorState('aborting');
      setPhase('abort');
      addLog('Coordinator: Vote NO received, sending ABORT');

      const abortMessages = participants.map(p => ({
        id: `abort-${p.id}`,
        from: 'C',
        to: p.id,
        type: 'abort' as const,
      }));
      setMessages(abortMessages);

      await new Promise(r => setTimeout(r, 1000));
      setMessages([]);

      // Participants abort
      setParticipants(prev => prev.map(p => ({ ...p, state: 'aborted' })));
      setCoordinatorState('aborted');
      addLog('All participants: ABORTED');
    }

    setPhase('none');
  }, [coordinatorState, participants, addLog]);

  const reset = useCallback(() => {
    setParticipants([
      { id: 'P1', state: 'idle', willVoteYes: true },
      { id: 'P2', state: 'idle', willVoteYes: true },
      { id: 'P3', state: 'idle', willVoteYes: true },
      { id: 'P4', state: 'idle', willVoteYes: true },
    ]);
    setCoordinatorState('idle');
    setMessages([]);
    setLog([]);
    setPhase('none');
  }, []);

  const getMessageColor = (type: Message['type']) => {
    switch (type) {
      case 'prepare': return '#f59e0b';
      case 'vote-yes': return '#10b981';
      case 'vote-no': return '#ef4444';
      case 'commit': return '#10b981';
      case 'abort': return '#ef4444';
      case 'ack': return '#525252';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Two-Phase Commit</h2>
        <p className="text-[var(--text-secondary)] text-sm">
          Atomic commit protocol for distributed transactions
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={startTransaction}
          className="btn-primary text-sm"
          disabled={coordinatorState !== 'idle'}
        >
          Start Transaction
        </button>
        <button onClick={reset} className="btn-glass text-sm">
          Reset
        </button>
      </div>

      {/* Phase indicator */}
      <div className="flex justify-center gap-4 text-sm">
        <span className={`px-3 py-1 rounded ${phase === 'prepare' ? 'bg-yellow-500/20 text-yellow-400' : 'text-[var(--text-muted)]'}`}>
          Phase 1: Prepare
        </span>
        <span className={`px-3 py-1 rounded ${phase === 'commit' ? 'bg-green-500/20 text-green-400' : phase === 'abort' ? 'bg-red-500/20 text-red-400' : 'text-[var(--text-muted)]'}`}>
          Phase 2: {phase === 'abort' ? 'Abort' : 'Commit'}
        </span>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Visualization */}
        <div className="glass-strong p-6 rounded-2xl">
          <div className="relative w-full aspect-square max-w-md mx-auto">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {/* Connection lines */}
              {participants.map((p, i) => (
                <line
                  key={`line-${p.id}`}
                  x1={COORDINATOR_POS.x}
                  y1={COORDINATOR_POS.y}
                  x2={PARTICIPANT_POSITIONS[i].x}
                  y2={PARTICIPANT_POSITIONS[i].y}
                  stroke="var(--svg-stroke)"
                  strokeWidth="0.5"
                />
              ))}

              {/* Message animations */}
              <AnimatePresence>
                {messages.map((msg) => {
                  const fromPos = msg.from === 'C'
                    ? COORDINATOR_POS
                    : PARTICIPANT_POSITIONS[participants.findIndex(p => p.id === msg.from)];
                  const toPos = msg.to === 'C'
                    ? COORDINATOR_POS
                    : PARTICIPANT_POSITIONS[participants.findIndex(p => p.id === msg.to)];

                  if (!fromPos || !toPos) return null;

                  return (
                    <motion.g key={msg.id}>
                      <motion.circle
                        r="2"
                        fill={getMessageColor(msg.type)}
                        initial={{ cx: fromPos.x, cy: fromPos.y }}
                        animate={{ cx: toPos.x, cy: toPos.y }}
                        transition={{ duration: 0.8 }}
                      />
                      <motion.text
                        fontSize="3"
                        fill={getMessageColor(msg.type)}
                        initial={{ x: fromPos.x, y: fromPos.y - 4 }}
                        animate={{ x: toPos.x, y: toPos.y - 4 }}
                        transition={{ duration: 0.8 }}
                        textAnchor="middle"
                      >
                        {msg.type.toUpperCase()}
                      </motion.text>
                    </motion.g>
                  );
                })}
              </AnimatePresence>

              {/* Coordinator */}
              <g>
                <motion.rect
                  x={COORDINATOR_POS.x - 12}
                  y={COORDINATOR_POS.y - 6}
                  width="24"
                  height="12"
                  rx="2"
                  fill={stateColors[coordinatorState]}
                  stroke="var(--bg-primary)"
                  strokeWidth="1"
                />
                <text
                  x={COORDINATOR_POS.x}
                  y={COORDINATOR_POS.y + 1}
                  textAnchor="middle"
                  fill="var(--bg-primary)"
                  fontSize="4"
                  fontWeight="bold"
                >
                  Coordinator
                </text>
                <text
                  x={COORDINATOR_POS.x}
                  y={COORDINATOR_POS.y + 12}
                  textAnchor="middle"
                  fill={stateColors[coordinatorState]}
                  fontSize="3"
                >
                  {coordinatorState}
                </text>
              </g>

              {/* Participants */}
              {participants.map((p, i) => (
                <g key={p.id} onClick={() => toggleParticipantVote(p.id)} style={{ cursor: coordinatorState === 'idle' ? 'pointer' : 'default' }}>
                  <motion.circle
                    cx={PARTICIPANT_POSITIONS[i].x}
                    cy={PARTICIPANT_POSITIONS[i].y}
                    r="8"
                    fill={stateColors[p.state]}
                    stroke={p.willVoteYes ? '#10b981' : '#ef4444'}
                    strokeWidth="2"
                    whileHover={coordinatorState === 'idle' ? { scale: 1.1 } : {}}
                  />
                  <text
                    x={PARTICIPANT_POSITIONS[i].x}
                    y={PARTICIPANT_POSITIONS[i].y + 1}
                    textAnchor="middle"
                    fill="var(--bg-primary)"
                    fontSize="4"
                    fontWeight="bold"
                  >
                    {p.id}
                  </text>
                  <text
                    x={PARTICIPANT_POSITIONS[i].x}
                    y={PARTICIPANT_POSITIONS[i].y + 14}
                    textAnchor="middle"
                    fill={stateColors[p.state]}
                    fontSize="3"
                  >
                    {p.state}
                  </text>
                  {coordinatorState === 'idle' && (
                    <text
                      x={PARTICIPANT_POSITIONS[i].x}
                      y={PARTICIPANT_POSITIONS[i].y - 12}
                      textAnchor="middle"
                      fill={p.willVoteYes ? '#10b981' : '#ef4444'}
                      fontSize="3"
                    >
                      will {p.willVoteYes ? 'YES' : 'NO'}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>

          <p className="text-center text-[var(--text-muted)] text-xs mt-2">
            Click participants to toggle their vote (before starting)
          </p>
        </div>

        {/* Info Panel */}
        <div className="space-y-4">
          {/* States */}
          <div className="glass p-4 rounded-xl">
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">Current States</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-primary)]">Coordinator</span>
                <span style={{ color: stateColors[coordinatorState] }}>{coordinatorState}</span>
              </div>
              {participants.map(p => (
                <div key={p.id} className="flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">{p.id}</span>
                  <span style={{ color: stateColors[p.state] }}>{p.state}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Log */}
          <div className="glass p-4 rounded-xl">
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">Activity</h3>
            <div className="space-y-1 font-mono text-xs max-h-40 overflow-y-auto">
              {log.map((entry, i) => (
                <div key={i} className="text-[var(--text-secondary)]">{entry}</div>
              ))}
              {log.length === 0 && (
                <span className="text-[var(--text-muted)]">Start transaction to see activity</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="glass p-4 rounded-xl text-sm text-[var(--text-secondary)]">
        <h3 className="font-medium text-[var(--text-primary)] mb-2">How 2PC Works:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li><span className="text-yellow-400">Phase 1 (Prepare)</span>: Coordinator asks all participants to prepare</li>
          <li><span className="text-green-400">Vote Yes</span>: Participant can commit, locks resources</li>
          <li><span className="text-red-400">Vote No</span>: Participant cannot commit, transaction aborts</li>
          <li><span className="text-zinc-500">Phase 2</span>: Coordinator sends COMMIT (all yes) or ABORT (any no)</li>
        </ul>
      </div>
    </div>
  );
}
