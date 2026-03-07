import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
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
  type: 'init' | 'skip' | 'iterate' | 'match' | 'score' | 'advance' | 'compare' | 'done';
  term?: string;
  docId?: number;
  description: string;
  highlight?: { term?: string; docId?: number; skipTo?: number };
  // For parallel pointer visualization
  pointers?: { [term: string]: number }; // Current pointer positions per term
  matchedDocs?: number[]; // Running list of matched docs
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
  const [animationSpeed, setAnimationSpeed] = useState(1500);
  const [isPaused, setIsPaused] = useState(false);
  const pauseRef = useRef(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const index = useMemo(() => buildIndex(sampleDocuments), []);

  const sortedTerms = useMemo(() =>
    Array.from(index.values()).sort((a, b) => b.df - a.df).slice(0, 15),
    [index]
  );

  // Parse query into terms and operators
  const parseQuery = useCallback((queryText: string): { type: 'term' | 'AND' | 'OR'; value?: string }[] => {
    const tokens: { type: 'term' | 'AND' | 'OR'; value?: string }[] = [];
    const parts = queryText.split(/\s+/);

    parts.forEach(part => {
      const upper = part.toUpperCase();
      if (upper === 'AND') {
        tokens.push({ type: 'AND' });
      } else if (upper === 'OR') {
        tokens.push({ type: 'OR' });
      } else if (part.length > 2) {
        tokens.push({ type: 'term', value: part.toLowerCase() });
      }
    });

    return tokens;
  }, []);

  // Simulate Lucene-style query execution with parallel pointer algorithm
  const executeQuery = useCallback((queryText: string) => {
    const parsedQuery = parseQuery(queryText);
    const steps: QueryStep[] = [];
    const scores = new Map<number, number>();

    // Detect if query has operators
    const hasAnd = parsedQuery.some(t => t.type === 'AND');
    const hasOr = parsedQuery.some(t => t.type === 'OR');
    const terms = parsedQuery.filter(t => t.type === 'term').map(t => t.value!);

    // Filter to only terms that exist in index
    const validTerms = terms.filter(t => index.has(t));

    if (validTerms.length === 0) {
      steps.push({
        type: 'init',
        description: `No matching terms found in index for query: "${queryText}"`
      });
      steps.push({
        type: 'done',
        description: 'Query complete! No matching documents'
      });
      return steps;
    }

    // For boolean queries with 2+ terms, use parallel pointer algorithm
    if ((hasAnd || hasOr) && validTerms.length >= 2) {
      return executeParallelPointerQueryHelper(validTerms, hasAnd, queryText, steps, scores);
    }

    // Single term or implicit OR - use simple iteration
    steps.push({
      type: 'init',
      description: `Parsing query: "${queryText}" → terms: [${validTerms.join(', ')}]${validTerms.length > 1 ? ' (implicit OR)' : ''}`
    });

    validTerms.forEach(term => {
      const entry = index.get(term)!;

      steps.push({
        type: 'init',
        term,
        description: `Opening posting list for "${term}" (${entry.df} docs, IDF=${entry.idf.toFixed(2)})`
      });

      entry.postings.forEach((posting, idx) => {
        const skipPointer = entry.skipList.find(s => s.offset === idx);
        if (skipPointer) {
          steps.push({
            type: 'skip',
            term,
            docId: posting.docId,
            description: `Skip pointer available → can jump to doc ${skipPointer.docId}`,
            highlight: { term, skipTo: skipPointer.docId }
          });
        }

        steps.push({
          type: 'iterate',
          term,
          docId: posting.docId,
          description: `Reading: doc=${posting.docId}, tf=${posting.tf}`,
          highlight: { term, docId: posting.docId }
        });

        const tfidf = posting.tf * entry.idf;
        scores.set(posting.docId, (scores.get(posting.docId) || 0) + tfidf);
      });
    });

    const rankedDocs = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    steps.push({
      type: 'done',
      description: `Query complete! ${rankedDocs.length > 0 ? `Top results: ${rankedDocs.map(([id, score]) => `Doc${id}(${score.toFixed(2)})`).join(', ')}` : 'No matching documents'}`
    });

    return steps;
  }, [index, parseQuery]);

  // Helper function for parallel pointer algorithm (called from executeQuery)
  function executeParallelPointerQueryHelper(
    terms: string[],
    isAnd: boolean,
    queryText: string,
    steps: QueryStep[],
    scores: Map<number, number>
  ): QueryStep[] {
    steps.push({
      type: 'init',
      description: `Parsing boolean query: "${queryText}" → ${isAnd ? 'AND (intersection)' : 'OR (union)'} using parallel pointer algorithm`
    });

    // Get posting lists for each term
    const postingLists = terms.map(term => ({
      term,
      entry: index.get(term)!,
      postings: index.get(term)!.postings,
      pointer: 0 // Current position in posting list
    }));

    // Sort by posting list length (shortest first for AND - optimization)
    if (isAnd) {
      postingLists.sort((a, b) => a.postings.length - b.postings.length);
    }

    steps.push({
      type: 'init',
      description: `Initializing ${postingLists.length} pointers: ${postingLists.map(p => `${p.term}[0→doc${p.postings[0]?.docId || 'END'}]`).join(', ')}`,
      pointers: Object.fromEntries(postingLists.map(p => [p.term, 0])),
      matchedDocs: []
    });

    const matchedDocs: number[] = [];
    let iterations = 0;
    const maxIterations = 100; // Safety limit

    if (isAnd) {
      // AND: Parallel pointer intersection (like merge in merge-sort)
      // All pointers must point to same docId for a match
      while (iterations < maxIterations) {
        iterations++;

        // Check if any list is exhausted
        const exhausted = postingLists.some(p => p.pointer >= p.postings.length);
        if (exhausted) {
          const exhaustedList = postingLists.find(p => p.pointer >= p.postings.length);
          steps.push({
            type: 'done',
            description: `Pointer for "${exhaustedList?.term}" reached end of list. Intersection complete.`,
            pointers: Object.fromEntries(postingLists.map(p => [p.term, p.pointer])),
            matchedDocs: [...matchedDocs]
          });
          break;
        }

        // Get current docIds at each pointer
        const currentDocs = postingLists.map(p => ({
          term: p.term,
          docId: p.postings[p.pointer].docId,
          pointer: p.pointer
        }));

        const minDocId = Math.min(...currentDocs.map(d => d.docId));
        const maxDocId = Math.max(...currentDocs.map(d => d.docId));

        steps.push({
          type: 'compare',
          description: `Comparing pointers: ${currentDocs.map(d => `${d.term}→doc${d.docId}`).join(', ')} | min=${minDocId}, max=${maxDocId}`,
          pointers: Object.fromEntries(postingLists.map(p => [p.term, p.pointer])),
          matchedDocs: [...matchedDocs],
          highlight: { docId: minDocId }
        });

        if (minDocId === maxDocId) {
          // All pointers point to same doc - MATCH!
          matchedDocs.push(minDocId);

          // Calculate combined score
          let totalScore = 0;
          postingLists.forEach(p => {
            const posting = p.postings[p.pointer];
            const tfidf = posting.tf * p.entry.idf;
            totalScore += tfidf;
          });
          scores.set(minDocId, totalScore);

          steps.push({
            type: 'match',
            docId: minDocId,
            description: `MATCH! All pointers at doc${minDocId}. Score=${totalScore.toFixed(3)}. Advancing all pointers.`,
            pointers: Object.fromEntries(postingLists.map(p => [p.term, p.pointer])),
            matchedDocs: [...matchedDocs],
            highlight: { docId: minDocId }
          });

          // Advance all pointers
          postingLists.forEach(p => p.pointer++);
        } else {
          // Pointers don't match - advance the one(s) pointing to minDocId
          const listsToAdvance = postingLists.filter(p => p.postings[p.pointer].docId === minDocId);

          for (const list of listsToAdvance) {
            const currentPos = list.pointer;
            const targetDocId = maxDocId;

            // Check if we can use a skip pointer
            let usedSkip = false;
            for (const skip of list.entry.skipList) {
              if (skip.offset > currentPos && skip.docId <= targetDocId) {
                // Skip pointer is useful!
                steps.push({
                  type: 'skip',
                  term: list.term,
                  description: `"${list.term}": Skip pointer! Jumping from pos ${currentPos} to pos ${skip.offset} (doc${skip.docId}) to reach doc${targetDocId}`,
                  pointers: Object.fromEntries(postingLists.map(p => [p.term, p.pointer])),
                  matchedDocs: [...matchedDocs],
                  highlight: { term: list.term, skipTo: skip.docId }
                });
                list.pointer = skip.offset;
                usedSkip = true;
                break;
              }
            }

            if (!usedSkip) {
              // Regular advance
              list.pointer++;
              steps.push({
                type: 'advance',
                term: list.term,
                description: `"${list.term}": doc${minDocId} < doc${maxDocId}, advancing pointer to ${list.pointer < list.postings.length ? 'doc' + list.postings[list.pointer].docId : 'END'}`,
                pointers: Object.fromEntries(postingLists.map(p => [p.term, p.pointer])),
                matchedDocs: [...matchedDocs],
                highlight: { term: list.term, docId: list.pointer < list.postings.length ? list.postings[list.pointer].docId : undefined }
              });
            }
          }
        }
      }
    } else {
      // OR: Parallel pointer union (merge both lists)
      // Output doc when ANY pointer points to it
      const seenDocs = new Set<number>();

      while (iterations < maxIterations) {
        iterations++;

        // Check if all lists are exhausted
        const allExhausted = postingLists.every(p => p.pointer >= p.postings.length);
        if (allExhausted) {
          steps.push({
            type: 'done',
            description: `All pointers exhausted. Union complete.`,
            pointers: Object.fromEntries(postingLists.map(p => [p.term, p.pointer])),
            matchedDocs: [...matchedDocs]
          });
          break;
        }

        // Get current docIds at each non-exhausted pointer
        const currentDocs = postingLists
          .filter(p => p.pointer < p.postings.length)
          .map(p => ({
            term: p.term,
            docId: p.postings[p.pointer].docId,
            pointer: p.pointer,
            list: p
          }));

        const minDocId = Math.min(...currentDocs.map(d => d.docId));
        const listsAtMin = currentDocs.filter(d => d.docId === minDocId);

        steps.push({
          type: 'compare',
          description: `Comparing: ${currentDocs.map(d => `${d.term}→doc${d.docId}`).join(', ')} | min=${minDocId}`,
          pointers: Object.fromEntries(postingLists.map(p => [p.term, p.pointer])),
          matchedDocs: [...matchedDocs],
          highlight: { docId: minDocId }
        });

        if (!seenDocs.has(minDocId)) {
          seenDocs.add(minDocId);
          matchedDocs.push(minDocId);

          // Calculate score (sum from all lists that have this doc)
          let totalScore = 0;
          listsAtMin.forEach(d => {
            const posting = d.list.postings[d.pointer];
            const tfidf = posting.tf * d.list.entry.idf;
            totalScore += tfidf;
          });
          scores.set(minDocId, (scores.get(minDocId) || 0) + totalScore);

          steps.push({
            type: 'match',
            docId: minDocId,
            description: `Adding doc${minDocId} to union (from: ${listsAtMin.map(d => d.term).join(', ')}). Score=${totalScore.toFixed(3)}`,
            pointers: Object.fromEntries(postingLists.map(p => [p.term, p.pointer])),
            matchedDocs: [...matchedDocs],
            highlight: { docId: minDocId }
          });
        }

        // Advance all pointers at minDocId
        listsAtMin.forEach(d => d.list.pointer++);

        steps.push({
          type: 'advance',
          description: `Advancing ${listsAtMin.length} pointer(s) past doc${minDocId}`,
          pointers: Object.fromEntries(postingLists.map(p => [p.term, p.pointer])),
          matchedDocs: [...matchedDocs]
        });
      }
    }

    // Final results
    const rankedDocs = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    steps.push({
      type: 'done',
      description: `${isAnd ? 'Intersection' : 'Union'} complete! ${matchedDocs.length} docs matched. Top: ${rankedDocs.map(([id, score]) => `Doc${id}(${score.toFixed(2)})`).join(', ') || 'None'}`,
      matchedDocs
    });

    return steps;
  }

  const runAnimation = useCallback(async () => {
    if (!query.trim()) return;

    const steps = executeQuery(query);
    setQuerySteps(steps);
    setCurrentStep(0);
    setIsAnimating(true);
    pauseRef.current = false;
    setIsPaused(false);

    for (let i = 0; i < steps.length; i++) {
      // Check for pause
      while (pauseRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      setCurrentStep(i);
      await new Promise(resolve => setTimeout(resolve, animationSpeed));
    }

    setIsAnimating(false);
  }, [query, executeQuery, animationSpeed]);

  const togglePause = () => {
    pauseRef.current = !pauseRef.current;
    setIsPaused(!isPaused);
  };

  const stepForward = () => {
    if (currentStep < querySteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const stepBackward = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const currentHighlight = querySteps[currentStep]?.highlight;

  // Auto-scroll log container when step changes
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [currentStep]);

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
              placeholder="Try: ride AND driver, search OR ranking, matching algorithm..."
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
            <label className="text-xs text-zinc-500">Delay:</label>
            <input
              type="range"
              min="500"
              max="3000"
              step="100"
              value={animationSpeed}
              onChange={(e) => setAnimationSpeed(Number(e.target.value))}
              className="w-24"
            />
            <span className="text-xs text-zinc-400 w-12">{(animationSpeed/1000).toFixed(1)}s</span>
          </div>
          {isAnimating && (
            <div className="flex items-center gap-2">
              <button
                onClick={togglePause}
                className={`px-3 py-2 rounded-lg text-sm ${
                  isPaused ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}
              >
                {isPaused ? '▶ Resume' : '⏸ Pause'}
              </button>
              <button
                onClick={stepBackward}
                disabled={currentStep === 0}
                className="px-2 py-2 rounded-lg bg-zinc-800/50 text-zinc-400 disabled:opacity-30"
              >
                ◀
              </button>
              <button
                onClick={stepForward}
                disabled={currentStep >= querySteps.length - 1}
                className="px-2 py-2 rounded-lg bg-zinc-800/50 text-zinc-400 disabled:opacity-30"
              >
                ▶
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Query Execution Steps - Now in sidebar */}
        <div className="lg:col-span-1">
          <div className="glass-strong rounded-xl p-4 sticky top-24">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
              Query Execution {querySteps.length > 0 && `(${currentStep + 1}/${querySteps.length})`}
            </h3>
            {querySteps.length > 0 ? (
              <>
                <div ref={logContainerRef} className="space-y-1.5 max-h-80 overflow-y-auto font-mono text-xs">
                  {querySteps.slice(0, currentStep + 1).map((step, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-1.5 rounded ${
                        i === currentStep ? 'bg-zinc-700/50 ring-1 ring-zinc-500' : 'bg-zinc-800/30'
                      } ${
                        step.type === 'skip' ? 'border-l-2 border-yellow-500' :
                        step.type === 'score' ? 'border-l-2 border-blue-500' :
                        step.type === 'match' ? 'border-l-2 border-emerald-500' :
                        step.type === 'compare' ? 'border-l-2 border-cyan-500' :
                        step.type === 'advance' ? 'border-l-2 border-orange-500' :
                        step.type === 'done' ? 'border-l-2 border-purple-500' :
                        ''
                      }`}
                    >
                      <span className={`${
                        step.type === 'skip' ? 'text-yellow-400' :
                        step.type === 'score' ? 'text-blue-400' :
                        step.type === 'match' ? 'text-emerald-400' :
                        step.type === 'compare' ? 'text-cyan-400' :
                        step.type === 'advance' ? 'text-orange-400' :
                        step.type === 'done' ? 'text-purple-400' :
                        'text-zinc-400'
                      }`}>
                        [{step.type.toUpperCase()}]
                      </span>{' '}
                      <span className="text-zinc-300">{step.description}</span>
                    </motion.div>
                  ))}
                </div>

                {/* Pointer State Visualization */}
                {querySteps[currentStep]?.pointers && (
                  <div className="mt-3 p-2 rounded bg-zinc-900/50 border border-zinc-700/50">
                    <div className="text-xs text-zinc-500 mb-2">Pointer Positions:</div>
                    <div className="space-y-1">
                      {Object.entries(querySteps[currentStep].pointers!).map(([term, pos]) => (
                        <div key={term} className="flex items-center gap-2 text-xs">
                          <span className="text-cyan-400 font-mono w-16 truncate">{term}</span>
                          <span className="text-zinc-400">→</span>
                          <span className="text-zinc-300">pos {pos}</span>
                        </div>
                      ))}
                    </div>
                    {querySteps[currentStep].matchedDocs && querySteps[currentStep].matchedDocs!.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-zinc-700/50">
                        <span className="text-xs text-emerald-400">
                          Matched: [{querySteps[currentStep].matchedDocs!.join(', ')}]
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3">
                  <div className="w-full bg-zinc-800 rounded-full h-1">
                    <div
                      className="bg-emerald-500 h-1 rounded-full transition-all"
                      style={{ width: `${((currentStep + 1) / querySteps.length) * 100}%` }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-zinc-500">
                Enter a query and click "Execute" to see step-by-step execution
              </p>
            )}
          </div>
        </div>

        {/* Posting Lists and Documents - Main content */}
        <div className="lg:col-span-2 grid md:grid-cols-2 gap-6">
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
                <div className="flex items-center gap-1 flex-wrap pt-8">
                  {entry.postings.map((posting, idx) => {
                    const hasSkip = entry.skipList.some(s => s.offset === idx);
                    const isHighlighted = currentHighlight?.docId === posting.docId && currentHighlight?.term === entry.term;

                    // Check if current step has a pointer pointing to this position
                    const currentPointers = querySteps[currentStep]?.pointers;
                    const isPointerHere = currentPointers && currentPointers[entry.term] === idx;

                    return (
                      <div key={posting.docId} className="flex items-center relative">
                        {/* Pointer indicator */}
                        {isPointerHere && (
                          <motion.div
                            initial={{ y: -10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center"
                          >
                            <span className="text-cyan-400 text-xs font-bold">PTR</span>
                            <span className="text-cyan-400">▼</span>
                          </motion.div>
                        )}
                        {showSkipLists && hasSkip && !isPointerHere && (
                          <div className="absolute -top-5 left-0 px-1 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-xs whitespace-nowrap">
                            skip↓
                          </div>
                        )}
                        <motion.div
                          animate={{
                            scale: isHighlighted || isPointerHere ? 1.2 : 1,
                            backgroundColor: isPointerHere ? '#06b6d4' : isHighlighted ? '#22c55e' : '#3b82f6'
                          }}
                          className={`px-2 py-1 rounded text-xs text-zinc-50 font-mono ${
                            isPointerHere ? 'ring-2 ring-cyan-400' : ''
                          }`}
                        >
                          {posting.docId}
                        </motion.div>
                        {idx < entry.postings.length - 1 && (
                          <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
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
      </div>

      {/* Lucene Concepts Explanation */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Lucene Index Internals</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div className="p-4 rounded-lg bg-zinc-800/30">
            <div className="font-mono text-blue-400 mb-2">Posting List</div>
            <p className="text-[var(--text-secondary)]">
              Sorted list of document IDs containing a term. Sorted order enables efficient parallel iteration.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-zinc-800/30">
            <div className="font-mono text-cyan-400 mb-2">Parallel Pointers</div>
            <p className="text-[var(--text-secondary)]">
              For AND queries: maintain pointers into each posting list. Compare docIds, advance smaller pointer. Match when all equal. O(n+m) time.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-zinc-800/30">
            <div className="font-mono text-yellow-400 mb-2">Skip Pointers</div>
            <p className="text-[var(--text-secondary)]">
              Jump ahead when gaps are large. If pointer A is at doc 5 and B is at doc 100, skip A forward using skip list.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-zinc-800/30">
            <div className="font-mono text-orange-400 mb-2">Merge Algorithm</div>
            <p className="text-[var(--text-secondary)]">
              For OR queries: walk through both lists, output minimum docId, advance that pointer. Like merge-sort merge phase.
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
