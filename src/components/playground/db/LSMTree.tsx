import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MemTableEntry {
  key: string;
  value: string;
  timestamp: number;
}

interface SSTable {
  id: string;
  level: number;
  entries: MemTableEntry[];
  size: number;
  minKey: string;
  maxKey: string;
}

const MAX_MEMTABLE_SIZE = 4;
const LEVEL_MULTIPLIER = 4;

export default function LSMTree() {
  const [memtable, setMemtable] = useState<MemTableEntry[]>([]);
  const [sstables, setSstables] = useState<SSTable[]>([]);
  const [inputKey, setInputKey] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [isCompacting, setIsCompacting] = useState(false);
  const [highlightedSSTable, setHighlightedSSTable] = useState<string | null>(null);
  const [writeCount, setWriteCount] = useState(0);

  const addLog = useCallback((msg: string) => {
    setLog(prev => [msg, ...prev].slice(0, 12));
  }, []);

  // Get max tables allowed at a level
  const getMaxTablesAtLevel = (level: number) => {
    if (level === 0) return 2;
    return Math.pow(LEVEL_MULTIPLIER, level);
  };

  // Compact SSTables at a level (defined first - no hook dependencies)
  const compact = useCallback((level: number, tables: SSTable[]) => {
    setIsCompacting(true);
    addLog(`Compaction: Merging L${level} → L${level + 1}`);

    const tablesAtLevel = tables.filter(t => t.level === level);
    const otherTables = tables.filter(t => t.level !== level);

    const minTables = level === 0 ? 2 : getMaxTablesAtLevel(level);
    if (tablesAtLevel.length < minTables) {
      setIsCompacting(false);
      return;
    }

    // Merge all entries and deduplicate
    const allEntries: MemTableEntry[] = [];
    tablesAtLevel.forEach(t => {
      t.entries.forEach(e => allEntries.push(e));
    });

    // Sort and deduplicate (keep latest)
    const entryMap = new Map<string, MemTableEntry>();
    allEntries.sort((a, b) => a.timestamp - b.timestamp);
    allEntries.forEach(e => entryMap.set(e.key, e));

    const mergedEntries = Array.from(entryMap.values()).sort((a, b) =>
      a.key.localeCompare(b.key)
    );

    // Create new SSTable at next level
    const newSSTable: SSTable = {
      id: `sstable-${Date.now()}`,
      level: level + 1,
      entries: mergedEntries,
      size: mergedEntries.length,
      minKey: mergedEntries[0]?.key || '',
      maxKey: mergedEntries[mergedEntries.length - 1]?.key || '',
    };

    const newTables = [...otherTables, newSSTable];
    setSstables(newTables);
    setHighlightedSSTable(newSSTable.id);

    addLog(`Compacted ${tablesAtLevel.length} tables → L${level + 1}`);

    setTimeout(() => {
      setHighlightedSSTable(null);
      setIsCompacting(false);

      // Check if next level needs compaction (cascading)
      const nextLevelTables = newTables.filter(t => t.level === level + 1);
      const nextLevelMax = getMaxTablesAtLevel(level + 1);
      if (nextLevelTables.length >= nextLevelMax) {
        setTimeout(() => compact(level + 1, newTables), 500);
      }
    }, 1000);
  }, [addLog]);

  // Flush memtable to SSTable
  const flushMemtable = useCallback((entries: MemTableEntry[]) => {
    if (entries.length === 0) return;

    const newSSTable: SSTable = {
      id: `sstable-${Date.now()}`,
      level: 0,
      entries: [...entries],
      size: entries.length,
      minKey: entries[0].key,
      maxKey: entries[entries.length - 1].key,
    };

    addLog(`Flush: MemTable → SSTable L0 (${entries.length} entries)`);
    setMemtable([]);

    setSstables(prev => {
      const updatedTables = [...prev, newSSTable];
      // Check if compaction is needed
      const l0Tables = updatedTables.filter(t => t.level === 0);
      if (l0Tables.length >= 2) {
        setTimeout(() => compact(0, updatedTables), 500);
      }
      return updatedTables;
    });
  }, [addLog, compact]);

  // Write to memtable
  const write = useCallback((key: string, value: string) => {
    const entry: MemTableEntry = {
      key,
      value,
      timestamp: Date.now(),
    };

    setMemtable(prev => {
      // Remove existing key if present (update)
      const filtered = prev.filter(e => e.key !== key);
      const newMemtable = [...filtered, entry].sort((a, b) => a.key.localeCompare(b.key));

      addLog(`Write: ${key}=${value} to MemTable`);

      // Check if memtable is full
      if (newMemtable.length >= MAX_MEMTABLE_SIZE) {
        // Schedule flush
        setTimeout(() => flushMemtable(newMemtable), 500);
      }

      return newMemtable;
    });

    setWriteCount(prev => prev + 1);
  }, [addLog, flushMemtable]);

  // Read a key (search through levels)
  const read = useCallback((key: string) => {
    // Check memtable first
    const memEntry = memtable.find(e => e.key === key);
    if (memEntry) {
      addLog(`Read: ${key}=${memEntry.value} (from MemTable)`);
      return memEntry.value;
    }

    // Search SSTables from L0 to Ln
    const sortedTables = [...sstables].sort((a, b) => a.level - b.level);
    for (const table of sortedTables) {
      setHighlightedSSTable(table.id);
      const entry = table.entries.find(e => e.key === key);
      if (entry) {
        addLog(`Read: ${key}=${entry.value} (from L${table.level})`);
        setTimeout(() => setHighlightedSSTable(null), 1000);
        return entry.value;
      }
    }

    addLog(`Read: ${key} not found`);
    setHighlightedSSTable(null);
    return null;
  }, [memtable, sstables, addLog]);

  // Handle form submission
  const handleWrite = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputKey && inputValue) {
      write(inputKey, inputValue);
      setInputKey('');
      setInputValue('');
    }
  };

  const handleRead = () => {
    if (inputKey) {
      read(inputKey);
    }
  };

  // Load sample data
  const loadSampleData = () => {
    const samples = [
      { key: 'user:1', value: 'Alice' },
      { key: 'user:2', value: 'Bob' },
      { key: 'user:3', value: 'Charlie' },
      { key: 'order:1', value: 'Pizza' },
      { key: 'order:2', value: 'Burger' },
      { key: 'user:1', value: 'Alicia' }, // Update
      { key: 'order:3', value: 'Sushi' },
      { key: 'user:4', value: 'Diana' },
    ];

    samples.forEach((s, i) => {
      setTimeout(() => write(s.key, s.value), i * 400);
    });
  };

  // Reset
  const reset = () => {
    setMemtable([]);
    setSstables([]);
    setLog([]);
    setWriteCount(0);
    setHighlightedSSTable(null);
    setIsCompacting(false);
  };

  // Get tables by level
  const getTablesByLevel = () => {
    const levels: Map<number, SSTable[]> = new Map();
    sstables.forEach(t => {
      if (!levels.has(t.level)) levels.set(t.level, []);
      levels.get(t.level)!.push(t);
    });
    return levels;
  };

  const tablesByLevel = getTablesByLevel();
  const maxLevel = Math.max(0, ...Array.from(tablesByLevel.keys()));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">LSM Tree</h2>
        <p className="text-[var(--text-secondary)] text-sm">
          Log-Structured Merge Tree used in RocksDB, LevelDB, Cassandra
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap justify-center gap-3">
        <form onSubmit={handleWrite} className="flex gap-2">
          <input
            type="text"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            placeholder="Key"
            className="glass px-3 py-2 rounded-lg text-[var(--text-primary)] text-sm w-24 bg-transparent"
          />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Value"
            className="glass px-3 py-2 rounded-lg text-[var(--text-primary)] text-sm w-24 bg-transparent"
          />
          <button type="submit" className="btn-primary text-sm">
            Write
          </button>
        </form>
        <button onClick={handleRead} className="btn-glass text-sm" disabled={!inputKey}>
          Read
        </button>
        <button onClick={loadSampleData} className="btn-glass text-sm">
          Load Sample
        </button>
        <button onClick={reset} className="btn-glass text-sm text-red-400">
          Reset
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* LSM Structure Visualization */}
        <div className="lg:col-span-2 glass-strong p-6 rounded-2xl">
          {/* MemTable */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded bg-green-500" />
              <span className="text-sm font-medium text-[var(--text-primary)]">MemTable (In-Memory)</span>
              <span className="text-xs text-[var(--text-muted)]">{memtable.length}/{MAX_MEMTABLE_SIZE}</span>
            </div>
            <div className="glass p-3 rounded-lg border border-green-500/30 min-h-[60px]">
              <div className="flex flex-wrap gap-2">
                <AnimatePresence>
                  {memtable.map(entry => (
                    <motion.div
                      key={entry.key}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0, y: 50 }}
                      className="px-2 py-1 rounded bg-green-500/20 text-green-400 text-xs font-mono"
                    >
                      {entry.key}={entry.value}
                    </motion.div>
                  ))}
                </AnimatePresence>
                {memtable.length === 0 && (
                  <span className="text-[var(--text-muted)] text-xs">Empty - writes go here first</span>
                )}
              </div>
            </div>
          </div>

          {/* Flush Arrow */}
          {isCompacting && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-yellow-400 text-sm mb-4"
            >
              ↓ Flushing / Compacting...
            </motion.div>
          )}

          {/* SSTables by Level */}
          <div className="space-y-4">
            {Array.from({ length: maxLevel + 2 }, (_, level) => (
              <div key={level}>
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: `hsl(${200 + level * 30}, 70%, 50%)` }}
                  />
                  <span className="text-sm font-medium text-[var(--text-primary)]">Level {level}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    (max: {level === 0 ? 2 : Math.pow(LEVEL_MULTIPLIER, level)} tables)
                  </span>
                </div>
                <div className="glass p-3 rounded-lg min-h-[50px] border"
                  style={{ borderColor: `hsla(${200 + level * 30}, 70%, 50%, 0.3)` }}
                >
                  <div className="flex flex-wrap gap-2">
                    <AnimatePresence>
                      {(tablesByLevel.get(level) || []).map(table => (
                        <motion.div
                          key={table.id}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{
                            scale: 1,
                            opacity: 1,
                            boxShadow: highlightedSSTable === table.id
                              ? '0 0 20px rgba(99, 102, 241, 0.5)'
                              : 'none'
                          }}
                          exit={{ scale: 0, opacity: 0 }}
                          className="px-3 py-2 rounded border bg-gray-800/50"
                          style={{
                            borderColor: highlightedSSTable === table.id
                              ? '#525252'
                              : `hsla(${200 + level * 30}, 70%, 50%, 0.5)`
                          }}
                        >
                          <div className="text-xs text-[var(--text-secondary)] mb-1">
                            SSTable ({table.size} entries)
                          </div>
                          <div className="text-xs font-mono text-[var(--text-muted)]">
                            [{table.minKey} ... {table.maxKey}]
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {!tablesByLevel.get(level)?.length && (
                      <span className="text-[var(--text-muted)] text-xs">No SSTables</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info Panel */}
        <div className="space-y-4">
          {/* Stats */}
          <div className="glass p-4 rounded-xl">
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">Statistics</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Total Writes</span>
                <span className="text-[var(--text-primary)]">{writeCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">MemTable Size</span>
                <span className="text-[var(--text-primary)]">{memtable.length}/{MAX_MEMTABLE_SIZE}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Total SSTables</span>
                <span className="text-[var(--text-primary)]">{sstables.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Max Level</span>
                <span className="text-[var(--text-primary)]">{maxLevel}</span>
              </div>
            </div>
          </div>

          {/* Activity Log */}
          <div className="glass p-4 rounded-xl">
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">Activity</h3>
            <div className="space-y-1 font-mono text-xs max-h-48 overflow-y-auto">
              {log.map((entry, i) => (
                <div key={i} className="text-[var(--text-secondary)]">{entry}</div>
              ))}
              {log.length === 0 && (
                <span className="text-[var(--text-muted)]">Write data to see activity</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="glass p-4 rounded-xl text-sm text-[var(--text-secondary)]">
        <h3 className="font-medium text-[var(--text-primary)] mb-2">How LSM Trees Work:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li><span className="text-green-400">MemTable</span>: In-memory sorted structure for recent writes</li>
          <li><span className="text-zinc-400">Flush</span>: When MemTable is full, it's written to disk as an SSTable</li>
          <li><span className="text-yellow-400">Compaction</span>: Merge SSTables to reduce space and improve reads</li>
          <li><span className="text-zinc-500">Leveled</span>: Lower levels have fewer, smaller tables for faster reads</li>
          <li>Optimized for write-heavy workloads (append-only)</li>
        </ul>
      </div>
    </div>
  );
}
