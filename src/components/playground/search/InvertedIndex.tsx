import { useState, useMemo } from 'react';
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

interface IndexEntry {
  term: string;
  df: number;
  idf: number;
  postings: PostingEntry[];
}

const sampleDocuments: Document[] = [
  { id: 1, title: "Uber Ride Matching", content: "The ride matching algorithm uses geospatial indexing to find nearby drivers for riders requesting trips in real time" },
  { id: 2, title: "Search Ranking", content: "Search ranking combines relevance scoring with personalization to find the best results for each user query" },
  { id: 3, title: "Driver Dispatch", content: "Driver dispatch optimizes for minimal wait time by matching riders with the nearest available drivers" },
  { id: 4, title: "Real-time Analytics", content: "Real time analytics track ride patterns and driver availability to optimize the matching algorithm" },
];

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
        index.set(term, { term, df: 0, idf: 0, postings: [] });
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

  // Calculate IDF
  index.forEach(entry => {
    entry.idf = Math.log10(N / entry.df);
  });

  return index;
}

function search(query: string, index: Map<string, IndexEntry>, docs: Document[]): { doc: Document; score: number; matchedTerms: string[] }[] {
  const queryTerms = tokenize(query);
  const scores = new Map<number, { score: number; terms: string[] }>();

  queryTerms.forEach(term => {
    const entry = index.get(term);
    if (entry) {
      entry.postings.forEach(posting => {
        const tfidf = posting.tf * entry.idf;
        if (!scores.has(posting.docId)) {
          scores.set(posting.docId, { score: 0, terms: [] });
        }
        const docScore = scores.get(posting.docId)!;
        docScore.score += tfidf;
        if (!docScore.terms.includes(term)) {
          docScore.terms.push(term);
        }
      });
    }
  });

  return Array.from(scores.entries())
    .map(([docId, { score, terms }]) => ({
      doc: docs.find(d => d.id === docId)!,
      score,
      matchedTerms: terms
    }))
    .sort((a, b) => b.score - a.score);
}

export default function InvertedIndex() {
  const [query, setQuery] = useState('');
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [showIndex, setShowIndex] = useState(true);

  const index = useMemo(() => buildIndex(sampleDocuments), []);
  const results = useMemo(() => query ? search(query, index, sampleDocuments) : [], [query, index]);

  const sortedTerms = useMemo(() =>
    Array.from(index.values()).sort((a, b) => b.df - a.df).slice(0, 20),
    [index]
  );

  const highlightText = (text: string, terms: string[]) => {
    if (terms.length === 0) return text;
    const regex = new RegExp(`\\b(${terms.join('|')})\\b`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      terms.some(t => t.toLowerCase() === part.toLowerCase())
        ? <span key={i} className="bg-emerald-500/30 text-emerald-300 px-1 rounded">{part}</span>
        : part
    );
  };

  return (
    <div className="space-y-6">
      {/* Search Box */}
      <div className="glass-strong rounded-xl p-6">
        <label className="block text-sm text-[var(--text-muted)] mb-2">Search Query</label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try: ride matching drivers, search ranking, real time..."
          className="w-full px-4 py-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-[var(--text-primary)] placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
        />
        {query && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs text-[var(--text-muted)]">Query terms:</span>
            {tokenize(query).map((term, i) => (
              <span
                key={i}
                className={`px-2 py-1 text-xs rounded-full ${
                  index.has(term)
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {term} {index.has(term) ? `(IDF: ${index.get(term)!.idf.toFixed(2)})` : '(not found)'}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Inverted Index */}
        <div className="glass-strong rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Inverted Index</h3>
            <button
              onClick={() => setShowIndex(!showIndex)}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              {showIndex ? 'Hide' : 'Show'}
            </button>
          </div>

          <AnimatePresence>
            {showIndex && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 max-h-96 overflow-y-auto"
              >
                {sortedTerms.map((entry) => (
                  <motion.div
                    key={entry.term}
                    onClick={() => setSelectedTerm(selectedTerm === entry.term ? null : entry.term)}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      selectedTerm === entry.term
                        ? 'bg-zinc-700/50 border border-zinc-600'
                        : 'bg-zinc-800/30 hover:bg-zinc-800/50'
                    } ${tokenize(query).includes(entry.term) ? 'ring-1 ring-emerald-500/50' : ''}`}
                    layout
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm text-[var(--text-primary)]">{entry.term}</span>
                      <div className="flex gap-2 text-xs">
                        <span className="text-zinc-500">DF: {entry.df}</span>
                        <span className="text-zinc-500">IDF: {entry.idf.toFixed(2)}</span>
                      </div>
                    </div>

                    <AnimatePresence>
                      {selectedTerm === entry.term && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-2 pt-2 border-t border-zinc-700/50"
                        >
                          <div className="text-xs text-[var(--text-muted)] mb-2">Postings List:</div>
                          <div className="space-y-1">
                            {entry.postings.map((posting) => (
                              <div key={posting.docId} className="flex items-center gap-2 text-xs">
                                <span className="text-zinc-400">Doc {posting.docId}:</span>
                                <span className="text-emerald-400">TF={posting.tf}</span>
                                <span className="text-zinc-500">positions=[{posting.positions.join(', ')}]</span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Search Results / Documents */}
        <div className="glass-strong rounded-xl p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            {query ? `Results (${results.length})` : 'Documents'}
          </h3>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {(query ? results : sampleDocuments.map(doc => ({ doc, score: 0, matchedTerms: [] as string[] }))).map(({ doc, score, matchedTerms }) => (
              <motion.div
                key={doc.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-lg bg-zinc-800/30"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-[var(--text-primary)]">{doc.title}</h4>
                  {score > 0 && (
                    <span className="px-2 py-1 text-xs rounded-full bg-emerald-500/20 text-emerald-400">
                      Score: {score.toFixed(3)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                  {highlightText(doc.content, matchedTerms)}
                </p>
                {matchedTerms.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {matchedTerms.map(term => (
                      <span key={term} className="px-1.5 py-0.5 text-xs rounded bg-zinc-700/50 text-zinc-400">
                        {term}: TF-IDF = {(index.get(term)!.postings.find(p => p.docId === doc.id)!.tf * index.get(term)!.idf).toFixed(3)}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* TF-IDF Explanation */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">How TF-IDF Works</h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="p-4 rounded-lg bg-zinc-800/30">
            <div className="font-mono text-emerald-400 mb-2">TF (Term Frequency)</div>
            <p className="text-[var(--text-secondary)]">
              How often a term appears in a document. Higher TF = more relevant to that term.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-zinc-800/30">
            <div className="font-mono text-emerald-400 mb-2">IDF (Inverse Document Frequency)</div>
            <p className="text-[var(--text-secondary)]">
              log(N / DF) - Rare terms get higher weight. Common words like "the" get low IDF.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-zinc-800/30">
            <div className="font-mono text-emerald-400 mb-2">TF-IDF Score</div>
            <p className="text-[var(--text-secondary)]">
              TF × IDF for each term, summed across query terms. Balances frequency with uniqueness.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
