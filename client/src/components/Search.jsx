import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import TrackRow from './TrackRow';

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (initialQ && !results) {
      doSearch(initialQ);
    }
  }, []);

  function doSearch(q) {
    if (!q.trim()) { setResults(null); return; }
    setLoading(true);
    api.search(q).then(setResults).catch(() => setResults({ items: [] })).finally(() => setLoading(false));
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults(null); return; }
    debounceRef.current = setTimeout(() => {
      setSearchParams(query.trim() ? { q: query.trim() } : {}, { replace: true });
      doSearch(query.trim());
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="relative max-w-lg">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 5L20.49 19l-5-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="What do you want to listen to?"
            className="w-full bg-neutral-800 text-white pl-12 pr-4 py-3.5 rounded-full text-sm outline-none focus:ring-2 focus:ring-white/20 placeholder:text-neutral-500" />
          {query && (
            <button onClick={() => { setQuery(''); setResults(null); inputRef.current?.focus(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
            </button>
          )}
        </div>
      </div>

      {loading && <div className="text-neutral-500 py-12 text-center">Searching...</div>}

      {!loading && !results && (
        <div className="text-neutral-500 py-20 text-center text-lg">Search for songs, artists, or albums</div>
      )}

      {!loading && results && results.items?.length === 0 && (
        <div className="text-neutral-500 py-20 text-center">No results found for &ldquo;{query}&rdquo;</div>
      )}

      {!loading && results?.items?.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-3">Songs</h2>
          <div className="space-y-0.5">
            {results.items.map((t, i) => (
              <TrackRow key={t.videoId + i} track={t} index={i} tracks={results.items} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
