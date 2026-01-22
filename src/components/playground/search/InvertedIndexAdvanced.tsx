import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Document {
  id: number;
  title: string;
  content: string;
}

interface PostingEntry {
  docId: number;
  tf: number;
  positions: number[];
}

interface SkipPointer {
  docId: number;
  offset: number;
}

interface IndexEntry {
  term: string;
  df: number;
  idf: number;
  postings: PostingEntry[];
  skipList: SkipPointer[];
}

interface QueryStep {
  type: 'init' | 'skip' | 'iterate' | 'match' | 'score' | 'done';
  term?: string;
  docId?: number;
  description: string;
  highlight?: { term?: string; docId?: number; skipTo?: number };
}

const sampleDocuments: Document[] = [
  { id: 1, title: "Uber Ride Matching", content: "The ride matching algorithm uses geospatial indexing to find nearby drivers for riders requesting trips in real time" },
  { id: 2, title: "Search Ranking", content: "Search ranking combines relevance scoring with personalization to find the best results for each user query" },
  { id: 3, title: "Driver Dispatch", content: "Driver dispatch optimizes for minimal wait time by matching riders with the nearest available drivers" },
  { id: 4, title: "Real-time Analytics", content: "Real time analytics track ride patterns and driver availability to optimize the matching algorithm" },
  { id: 5, title: "Fare Calculation", content: "Fare calculation uses distance and time to compute the ride cost with surge pricing during high demand" },
  { id: 6, title: "Driver Onboarding", content: "Driver onboarding process includes background checks and vehicle inspection for rider safety" },
  { id: 7, title: "Route Optimization", content: "Route optimization algorithm finds the fastest path using real time traffic data for drivers" },
  { id: 8, title: "Payment Processing", content: "Payment processing handles credit cards and digital wallets for seamless ride transactions" },
];

const SKIP_INTERVAL = 2; // Skip pointer every 2 documents

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function buildIndex(docs: Document[]): Map<string, IndexEntry> {
  const index = new Map<string, IndexEntry>();
  const N = docs.length;

  docs.forEach(doc => {
    const tokens = tokenize(doc.content);
    const termFreq = new Map<string, { count: number; positions: number[] }>();

    tokens.forEach((token, pos) => {
      if (!termFreq.has(token)) {
        termFreq.set(token, { count: 0, positions: [] });
      }
      const entry = termFreq.get(token)!;
      entry.count++;
      entry.positions.push(pos);
    });

    termFreq.forEach((freq, term) => {
      if (!index.has(term)) {
        index.set(term, { term, df: 0, idf: 0, postings: [], skipList: [] });
      }
      const entry = index.get(term)!;
      entry.df++;
      entry.postings.push({
        docId: doc.id,
        tf: freq.count,
        positions: freq.positions
      });
    });
  });

  // Calculate IDF and build skip lists
  index.forEach(entry => {
    entry.idf = Math.log10(N / entry.df);
    // Sort postings by docId
    entry.postings.sort((a, b) => a.docId - b.docId);
    // Build skip list
    entry.skipList = [];
    for (let i = SKIP_INTERVAL; i < entry.postings.length; i += SKIP_INTERVAL) {
      entry.skipList.push({
        docId: entry.postings[i].docId,
        offset: i
      });
    }
  });

  return index;
}

export default function InvertedIndexAdvanced() {
  const [query, setQuery] = useState('');
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [querySteps, setQuerySteps] = useState<QueryStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showSkipLists, setShowSkipLists] = useState(true);
  const [animationSpeed, setAnimationSpeed] = useState(800);

  const index = useMemo(() => buildIndex(sampleDocuments), []);

  const sortedTerms = useMemo(() =>
    Array.from(index.values()).sort((a, b) => b.df - a.df).slice(0, 15),
    [index]
  );

  // Simulate Lucene-style query execution with steps
  const executeQuery = useCallback((queryText: string) => {
    const queryTerms = tokenize(queryText);
    const steps: QueryStep[] = [];
    const scores = new Map<number, number>();

    steps.push({
      type: 'init',
      description: `Parsing query: "${queryText}" → terms: [${queryTerms.join(', ')}]`
    });

    queryTerms.forEach(term => {
      const entry = index.get(term);
      if (!entry) {
        steps.push({
          type: 'iterate',
          term,
          description: `Term "${term}" not found in index, skipping`
        });
        return;
      }

      steps.push({
        type: 'init',
        term,
        description: `Opening posting list for "${term}" (${entry.df} docs, ${entry.skipList.length} skip pointers)`
      });

      // Simulate iteration through posting list
      let skipsUsed = 0;
      entry.postings.forEach((posting, idx) => {
        // Check if we could use a skip pointer (for demonstration)
        const skipPointer = entry.skipList.find(s => s.offset === idx);
        if (skipPointer) {
          steps.push({
            type: 'skip',
            term,
            docId: posting.docId,
            description: `Skip pointer available → jump to doc ${skipPointer.docId} (offset ${skipPointer.offset})`,
            highlight: { term, skipTo: skipPointer.docId }
          });
          skipsUsed++;
        }

        steps.push({
          type: 'iterate',
          term,
          docId: posting.docId,
          description: `Reading posting: doc=${posting.docId}, tf=${posting.tf}, positions=[${posting.positions.join(',')}]`,
          highlight: { term, docId: posting.docId }
        });

        const tfidf = posting.tf * entry.idf;
        scores.set(posting.docId, (scores.get(posting.docId) || 0) + tfidf);

        steps.push({
          type: 'score',
          term,
          docId: posting.docId,
          description: `Scoring: TF(${posting.tf}) × IDF(${entry.idf.toFixed(3)}) = ${tfidf.toFixed(3)}`,
          highlight: { term, docId: posting.docId }
        });
      });
    });

    // Final results
    const rankedDocs = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    steps.push({
      type: 'done',
      description: `Query complete! Top results: ${rankedDocs.map(([id, score]) => `Doc${id}(${score.toFixed(2)})`).join(', ')}`
    });

    return steps;
  }, [index]);

  const runAnimation = useCallback(async () => {
    if (!query.trim()) return;

    const steps = executeQuery(query);
    setQuerySteps(steps);
    setCurrentStep(0);
    setIsAnimating(true);

    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i);
      await new Promise(resolve => setTimeout(resolve, animationSpeed));
    }

    setIsAnimating(false);
  }, [query, executeQuery, animationSpeed]);

  const currentHighlight = querySteps[currentStep]?.highlight;

  return (
    <div className="space-y-6">
      {/* Search Controls */}
      <div className="glass-strong rounded-xl p-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-64">
            <label className="block text-sm text-[var(--text-muted)] mb-2">Search Query</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isAnimating && runAnimation()}
              placeholder="Try: ride matching drivers, search ranking..."
              className="w-full px-4 py-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-[var(--text-primary)] placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />
          </div>
          <button
            onClick={runAnimation}
            disabled={isAnimating || !query.trim()}
            className="px-6 py-3 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30 transition-all disabled:opacity-50"
          >
            {isAnimating ? 'Running...' : 'Execute Query'}
          </button>
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500">Speed:</label>
            <input
              type="range"
              min="200"
              max="1500"
              value={animationSpeed}
              onChange={(e) => setAnimationSpeed(Number(e.target.value))}
              className="w-20"
            />
          </div>
        </div>
      </div>

      {/* Query Execution Steps */}
      <AnimatePresence>
        {querySteps.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-strong rounded-xl p-6"
          >
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
              Lucene-style Query Execution
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto font-mono text-sm">
              {querySteps.slice(0, currentStep + 1).map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-2 rounded ${
                    i === currentStep ? 'bg-zinc-700/50' : 'bg-zinc-800/30'
                  } ${
                    step.type === 'skip' ? 'border-l-2 border-yellow-500' :
                    step.type === 'match' ? 'border-l-2 border-emerald-500' :
                    step.type === 'score' ? 'border-l-2 border-blue-500' :
                    step.type === 'done' ? 'border-l-2 border-purple-500' :
                    ''
                  }`}
                >
                  <span className={`${
                    step.type === 'skip' ? 'text-yellow-400' :
                    step.type === 'score' ? 'text-blue-400' :
                    step.type === 'done' ? 'text-purple-400' :
                    'text-zinc-400'
                  }`}>
                    [{step.type.toUpperCase()}]
                  </span>{' '}
                  <span className="text-zinc-300">{step.description}</span>
                </motion.div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${((currentStep + 1) / querySteps.length) * 100}%` }}
                />
              </div>
              <span className="text-xs text-zinc-500">
                {currentStep + 1} / {querySteps.length}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Posting Lists with Skip Pointers */}
        <div className="glass-strong rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              Posting Lists
            </h3>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showSkipLists}
                onChange={(e) => setShowSkipLists(e.target.checked)}
                className="rounded"
              />
              <span className="text-zinc-400">Show Skip Pointers</span>
            </label>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {sortedTerms.map((entry) => (
              <div
                key={entry.term}
                onClick={() => setSelectedTerm(selectedTerm === entry.term ? null : entry.term)}
                className={`p-3 rounded-lg cursor-pointer transition-all ${
                  selectedTerm === entry.term
                    ? 'bg-zinc-700/50 border border-zinc-600'
                    : 'bg-zinc-800/30 hover:bg-zinc-800/50'
                } ${currentHighlight?.term === entry.term ? 'ring-2 ring-emerald-500/50' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm text-[var(--text-primary)]">{entry.term}</span>
                  <div className="flex gap-2 text-xs">
                    <span className="text-zinc-500">DF: {entry.df}</span>
                    <span className="text-zinc-500">IDF: {entry.idf.toFixed(2)}</span>
                  </div>
                </div>

                {/* Posting List Visualization */}
                <div className="flex items-center gap-1 flex-wrap">
                  {entry.postings.map((posting, idx) => {
                    const hasSkip = entry.skipList.some(s => s.offset === idx);
                    const isHighlighted = currentHighlight?.docId === posting.docId && currentHighlight?.term === entry.term;

                    return (
                      <div key={posting.docId} className="flex items-center">
                        <motion.div
                          animate={{
                            scale: isHighlighted ? 1.2 : 1,
                            backgroundColor: isHighlighted ? '#22c55e' : '#3b82f6'
                          }}
                          className="px-2 py-1 rounded text-xs text-zinc-50 font-mono"
                        >
                          {posting.docId}
                        </motion.div>
                        {idx < entry.postings.length - 1 && (
                          <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                        {showSkipLists && hasSkip && (
                          <div className="absolute -mt-8 ml-1">
                            <div className="px-1 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-xs">
                              skip
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Skip List */}
                {showSkipLists && entry.skipList.length > 0 && selectedTerm === entry.term && (
                  <div className="mt-2 pt-2 border-t border-zinc-700/50">
                    <div className="text-xs text-yellow-400 mb-1">Skip Pointers:</div>
                    <div className="flex gap-2 text-xs font-mono">
                      {entry.skipList.map((skip, i) => (
                        <span key={i} className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">
                          →doc{skip.docId} @{skip.offset}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expanded Details */}
                <AnimatePresence>
                  {selectedTerm === entry.term && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 pt-2 border-t border-zinc-700/50"
                    >
                      <div className="text-xs text-[var(--text-muted)] mb-2">Document Details:</div>
                      <div className="space-y-1">
                        {entry.postings.map((posting) => (
                          <div key={posting.docId} className="flex items-center gap-2 text-xs p-1 rounded bg-zinc-900/50">
                            <span className="text-zinc-400 w-12">Doc {posting.docId}:</span>
                            <span className="text-emerald-400">TF={posting.tf}</span>
                            <span className="text-zinc-500">pos=[{posting.positions.join(', ')}]</span>
                            <span className="text-blue-400 ml-auto">
                              TF-IDF: {(posting.tf * entry.idf).toFixed(3)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>

        {/* Documents */}
        <div className="glass-strong rounded-xl p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Document Store ({sampleDocuments.length} docs)
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {sampleDocuments.map((doc) => {
              const isHighlighted = currentHighlight?.docId === doc.id;
              return (
                <motion.div
                  key={doc.id}
                  animate={{
                    scale: isHighlighted ? 1.02 : 1,
                    borderColor: isHighlighted ? '#22c55e' : 'transparent'
                  }}
                  className={`p-3 rounded-lg bg-zinc-800/30 border ${
                    isHighlighted ? 'border-emerald-500' : 'border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded bg-zinc-700 text-xs font-mono text-zinc-300">
                      ID: {doc.id}
                    </span>
                    <span className="text-sm font-medium text-[var(--text-primary)]">{doc.title}</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{doc.content}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lucene Concepts Explanation */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Lucene Index Internals</h3>
        <div className="grid md:grid-cols-4 gap-4 text-sm">
          <div className="p-4 rounded-lg bg-zinc-800/30">
            <div className="font-mono text-blue-400 mb-2">Posting List</div>
            <p className="text-[var(--text-secondary)]">
              Sorted list of document IDs containing a term. Enables fast OR queries via list merging.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-zinc-800/30">
            <div className="font-mono text-yellow-400 mb-2">Skip Pointers</div>
            <p className="text-[var(--text-secondary)]">
              Jump ahead in posting list to skip irrelevant docs. Speeds up AND queries with short-circuiting.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-zinc-800/30">
            <div className="font-mono text-emerald-400 mb-2">Term Positions</div>
            <p className="text-[var(--text-secondary)]">
              Word positions within documents. Enables phrase queries like "ride matching" (adjacent terms).
            </p>
          </div>
          <div className="p-4 rounded-lg bg-zinc-800/30">
            <div className="font-mono text-purple-400 mb-2">Segment Iteration</div>
            <p className="text-[var(--text-secondary)]">
              Lucene iterates segments, merging results. Each segment has its own posting lists and skip lists.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
