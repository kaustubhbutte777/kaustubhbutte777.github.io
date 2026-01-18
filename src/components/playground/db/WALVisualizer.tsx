import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LogEntry {
  lsn: number; // Log Sequence Number
  type: 'BEGIN' | 'WRITE' | 'COMMIT' | 'CHECKPOINT' | 'ABORT';
  txnId: number;
  table?: string;
  key?: string;
  oldValue?: string;
  newValue?: string;
  timestamp: number;
}

interface Transaction {
  id: number;
  status: 'active' | 'committed' | 'aborted';
  operations: LogEntry[];
}

interface DataPage {
  key: string;
  value: string;
  dirty: boolean;
  lsn: number;
}

export default function WALVisualizer() {
  const [wal, setWal] = useState<LogEntry[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dataPages, setDataPages] = useState<DataPage[]>([
    { key: 'balance:A', value: '1000', dirty: false, lsn: 0 },
    { key: 'balance:B', value: '500', dirty: false, lsn: 0 },
    { key: 'balance:C', value: '750', dirty: false, lsn: 0 },
  ]);
  const [nextLsn, setNextLsn] = useState(1);
  const [nextTxnId, setNextTxnId] = useState(1);
  const [log, setLog] = useState<string[]>([]);
  const [isRecovering, setIsRecovering] = useState(false);
  const [checkpointLsn, setCheckpointLsn] = useState<number | null>(null);

  const addLog = useCallback((msg: string) => {
    setLog(prev => [msg, ...prev].slice(0, 15));
  }, []);

  // Append entry to WAL
  const appendWal = useCallback((entry: Omit<LogEntry, 'lsn' | 'timestamp'>) => {
    const newEntry: LogEntry = {
      ...entry,
      lsn: nextLsn,
      timestamp: Date.now(),
    };
    setWal(prev => [...prev, newEntry]);
    setNextLsn(prev => prev + 1);
    return newEntry;
  }, [nextLsn]);

  // Begin a new transaction
  const beginTransaction = useCallback(() => {
    const txnId = nextTxnId;
    setNextTxnId(prev => prev + 1);

    const entry = appendWal({ type: 'BEGIN', txnId });
    addLog(`T${txnId}: BEGIN (LSN ${entry.lsn})`);

    setTransactions(prev => [...prev, {
      id: txnId,
      status: 'active',
      operations: [{ ...entry, lsn: nextLsn - 1, timestamp: Date.now() }],
    }]);

    return txnId;
  }, [nextTxnId, appendWal, addLog, nextLsn]);

  // Write operation
  const writeData = useCallback((txnId: number, key: string, newValue: string) => {
    const page = dataPages.find(p => p.key === key);
    if (!page) return;

    const oldValue = page.value;
    const entry = appendWal({
      type: 'WRITE',
      txnId,
      table: 'accounts',
      key,
      oldValue,
      newValue,
    });

    addLog(`T${txnId}: WRITE ${key}=${newValue} (LSN ${entry.lsn})`);

    // Update data page (dirty)
    setDataPages(prev => prev.map(p =>
      p.key === key
        ? { ...p, value: newValue, dirty: true, lsn: nextLsn - 1 }
        : p
    ));

    setTransactions(prev => prev.map(t =>
      t.id === txnId
        ? { ...t, operations: [...t.operations, { ...entry, lsn: nextLsn - 1, timestamp: Date.now() }] }
        : t
    ));
  }, [dataPages, appendWal, addLog, nextLsn]);

  // Commit transaction
  const commitTransaction = useCallback((txnId: number) => {
    const entry = appendWal({ type: 'COMMIT', txnId });
    addLog(`T${txnId}: COMMIT (LSN ${entry.lsn})`);

    setTransactions(prev => prev.map(t =>
      t.id === txnId ? { ...t, status: 'committed' } : t
    ));

    // Mark pages as clean after commit
    setDataPages(prev => prev.map(p => ({ ...p, dirty: false })));
  }, [appendWal, addLog]);

  // Abort transaction
  const abortTransaction = useCallback((txnId: number) => {
    const txn = transactions.find(t => t.id === txnId);
    if (!txn) return;

    const entry = appendWal({ type: 'ABORT', txnId });
    addLog(`T${txnId}: ABORT (LSN ${entry.lsn})`);

    // Undo changes using WAL
    const writeOps = txn.operations.filter(op => op.type === 'WRITE').reverse();
    writeOps.forEach(op => {
      if (op.key && op.oldValue !== undefined) {
        setDataPages(prev => prev.map(p =>
          p.key === op.key ? { ...p, value: op.oldValue!, dirty: false } : p
        ));
        addLog(`UNDO: ${op.key}=${op.oldValue}`);
      }
    });

    setTransactions(prev => prev.map(t =>
      t.id === txnId ? { ...t, status: 'aborted' } : t
    ));
  }, [transactions, appendWal, addLog]);

  // Checkpoint
  const checkpoint = useCallback(() => {
    const entry = appendWal({ type: 'CHECKPOINT', txnId: 0 });
    setCheckpointLsn(entry.lsn);
    addLog(`CHECKPOINT at LSN ${entry.lsn}`);

    // Flush dirty pages
    setDataPages(prev => prev.map(p => ({ ...p, dirty: false })));
  }, [appendWal, addLog]);

  // Simulate crash and recovery
  const simulateCrashRecovery = useCallback(async () => {
    setIsRecovering(true);
    addLog('--- CRASH! ---');
    addLog('Starting recovery...');

    await new Promise(r => setTimeout(r, 1000));

    // REDO phase: Replay from checkpoint
    const startLsn = checkpointLsn || 1;
    addLog(`REDO: Replaying from LSN ${startLsn}`);

    const entriesToRedo = wal.filter(e => e.lsn >= startLsn);
    for (const entry of entriesToRedo) {
      if (entry.type === 'WRITE' && entry.key && entry.newValue) {
        await new Promise(r => setTimeout(r, 300));
        setDataPages(prev => prev.map(p =>
          p.key === entry.key ? { ...p, value: entry.newValue!, lsn: entry.lsn } : p
        ));
        addLog(`REDO: ${entry.key}=${entry.newValue}`);
      }
    }

    await new Promise(r => setTimeout(r, 500));

    // UNDO phase: Rollback uncommitted transactions
    addLog('UNDO: Rolling back uncommitted txns');
    const uncommittedTxns = transactions.filter(t => t.status === 'active');
    for (const txn of uncommittedTxns) {
      const writeOps = txn.operations.filter(op => op.type === 'WRITE').reverse();
      for (const op of writeOps) {
        if (op.key && op.oldValue !== undefined) {
          await new Promise(r => setTimeout(r, 300));
          setDataPages(prev => prev.map(p =>
            p.key === op.key ? { ...p, value: op.oldValue! } : p
          ));
          addLog(`UNDO T${txn.id}: ${op.key}=${op.oldValue}`);
        }
      }
      setTransactions(prev => prev.map(t =>
        t.id === txn.id ? { ...t, status: 'aborted' } : t
      ));
    }

    addLog('Recovery complete!');
    setIsRecovering(false);
  }, [wal, transactions, checkpointLsn, addLog]);

  // Run demo scenario
  const runDemo = useCallback(async () => {
    // Reset
    setWal([]);
    setTransactions([]);
    setDataPages([
      { key: 'balance:A', value: '1000', dirty: false, lsn: 0 },
      { key: 'balance:B', value: '500', dirty: false, lsn: 0 },
      { key: 'balance:C', value: '750', dirty: false, lsn: 0 },
    ]);
    setNextLsn(1);
    setNextTxnId(1);
    setLog([]);
    setCheckpointLsn(null);

    await new Promise(r => setTimeout(r, 500));

    // T1: Transfer from A to B
    const t1 = beginTransaction();
    await new Promise(r => setTimeout(r, 400));
    writeData(t1, 'balance:A', '900');
    await new Promise(r => setTimeout(r, 400));
    writeData(t1, 'balance:B', '600');
    await new Promise(r => setTimeout(r, 400));
    commitTransaction(t1);

    await new Promise(r => setTimeout(r, 600));

    // Checkpoint
    checkpoint();

    await new Promise(r => setTimeout(r, 600));

    // T2: Another transfer (will be uncommitted)
    const t2 = beginTransaction();
    await new Promise(r => setTimeout(r, 400));
    writeData(t2, 'balance:B', '400');
    await new Promise(r => setTimeout(r, 400));
    writeData(t2, 'balance:C', '950');

    addLog('T2 is still active (uncommitted)...');
  }, [beginTransaction, writeData, commitTransaction, checkpoint, addLog]);

  // Reset
  const reset = () => {
    setWal([]);
    setTransactions([]);
    setDataPages([
      { key: 'balance:A', value: '1000', dirty: false, lsn: 0 },
      { key: 'balance:B', value: '500', dirty: false, lsn: 0 },
      { key: 'balance:C', value: '750', dirty: false, lsn: 0 },
    ]);
    setNextLsn(1);
    setNextTxnId(1);
    setLog([]);
    setCheckpointLsn(null);
    setIsRecovering(false);
  };

  const getEntryColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'BEGIN': return '#525252';
      case 'WRITE': return '#f59e0b';
      case 'COMMIT': return '#10b981';
      case 'ABORT': return '#ef4444';
      case 'CHECKPOINT': return '#737373';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Write-Ahead Log (WAL)</h2>
        <p className="text-[var(--text-secondary)] text-sm">
          Durability and crash recovery in databases
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap justify-center gap-3">
        <button onClick={runDemo} className="btn-primary text-sm">
          Run Demo Scenario
        </button>
        <button
          onClick={simulateCrashRecovery}
          className="btn-glass text-sm text-red-400"
          disabled={isRecovering || wal.length === 0}
        >
          {isRecovering ? 'Recovering...' : 'Simulate Crash'}
        </button>
        <button onClick={reset} className="btn-glass text-sm">
          Reset
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* WAL Visualization */}
        <div className="lg:col-span-2 space-y-4">
          {/* WAL Log */}
          <div className="glass-strong p-4 rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">Write-Ahead Log (Disk)</h3>
              {checkpointLsn && (
                <span className="text-xs px-2 py-0.5 rounded bg-zinc-500/20 text-zinc-400">
                  Checkpoint @ LSN {checkpointLsn}
                </span>
              )}
            </div>
            <div className="flex gap-1 flex-wrap min-h-[80px] p-2 glass rounded-lg">
              <AnimatePresence>
                {wal.map((entry, i) => (
                  <motion.div
                    key={entry.lsn}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="px-2 py-1 rounded text-xs font-mono"
                    style={{
                      backgroundColor: `${getEntryColor(entry.type)}20`,
                      borderLeft: `3px solid ${getEntryColor(entry.type)}`,
                      opacity: checkpointLsn && entry.lsn < checkpointLsn ? 0.5 : 1,
                    }}
                  >
                    <div className="text-[var(--text-muted)]">LSN {entry.lsn}</div>
                    <div style={{ color: getEntryColor(entry.type) }}>
                      {entry.type}
                      {entry.txnId > 0 && ` T${entry.txnId}`}
                    </div>
                    {entry.key && (
                      <div className="text-[var(--text-secondary)]">
                        {entry.key}: {entry.oldValue}→{entry.newValue}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              {wal.length === 0 && (
                <span className="text-[var(--text-muted)] text-xs">WAL is empty - run demo to see entries</span>
              )}
            </div>
          </div>

          {/* Data Pages */}
          <div className="glass-strong p-4 rounded-2xl">
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">Data Pages (Buffer Pool)</h3>
            <div className="grid grid-cols-3 gap-3">
              {dataPages.map(page => (
                <motion.div
                  key={page.key}
                  animate={{
                    borderColor: page.dirty ? '#f59e0b' : 'rgba(255,255,255,0.1)',
                  }}
                  className="glass p-3 rounded-lg border-2"
                >
                  <div className="text-xs text-[var(--text-secondary)] mb-1">{page.key}</div>
                  <div className="text-xl font-bold text-[var(--text-primary)]">${page.value}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-[var(--text-muted)]">LSN: {page.lsn}</span>
                    {page.dirty && (
                      <span className="text-xs px-1 rounded bg-yellow-500/20 text-yellow-400">
                        dirty
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Transactions */}
          <div className="glass-strong p-4 rounded-2xl">
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">Active Transactions</h3>
            <div className="space-y-2">
              {transactions.map(txn => (
                <div
                  key={txn.id}
                  className="flex items-center justify-between p-2 rounded glass"
                >
                  <span className="text-sm text-[var(--text-primary)]">T{txn.id}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    txn.status === 'committed' ? 'bg-green-500/20 text-green-400' :
                    txn.status === 'aborted' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {txn.status}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {txn.operations.length} ops
                  </span>
                </div>
              ))}
              {transactions.length === 0 && (
                <span className="text-[var(--text-muted)] text-xs">No transactions</span>
              )}
            </div>
          </div>
        </div>

        {/* Info Panel */}
        <div className="space-y-4">
          {/* Legend */}
          <div className="glass p-4 rounded-xl">
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">Log Entry Types</h3>
            <div className="space-y-2 text-sm">
              {(['BEGIN', 'WRITE', 'COMMIT', 'ABORT', 'CHECKPOINT'] as const).map(type => (
                <div key={type} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: getEntryColor(type) }}
                  />
                  <span className="text-[var(--text-secondary)]">{type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Log */}
          <div className="glass p-4 rounded-xl">
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">Activity</h3>
            <div className="space-y-1 font-mono text-xs max-h-64 overflow-y-auto">
              {log.map((entry, i) => (
                <div
                  key={i}
                  className={entry.includes('CRASH') ? 'text-red-400 font-bold' :
                             entry.includes('REDO') ? 'text-green-400' :
                             entry.includes('UNDO') ? 'text-yellow-400' :
                             'text-[var(--text-secondary)]'}
                >
                  {entry}
                </div>
              ))}
              {log.length === 0 && (
                <span className="text-[var(--text-muted)]">Run demo to see activity</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="glass p-4 rounded-xl text-sm text-[var(--text-secondary)]">
        <h3 className="font-medium text-[var(--text-primary)] mb-2">How WAL Works:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li><span className="text-zinc-500">Write-Ahead</span>: Log changes BEFORE modifying data pages</li>
          <li><span className="text-zinc-400">Checkpoint</span>: Flush dirty pages to disk, mark recovery point</li>
          <li><span className="text-green-400">REDO</span>: Replay committed transactions after crash</li>
          <li><span className="text-yellow-400">UNDO</span>: Rollback uncommitted transactions</li>
          <li>Ensures <span className="text-[var(--text-primary)]">ACID durability</span> even after crashes</li>
        </ul>
      </div>
    </div>
  );
}
