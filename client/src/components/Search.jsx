import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import TrackRow from './TrackRow';

const TABS = [
  { key: 'songs', label: 'Songs' },
  { key: 'artists', label: 'Artists' },
  { key: 'albums', label: 'Albums' }
];

// Module-level scroll cache so scroll position survives tab switches
const scrollCache = { songs: 0, artists: 0, albums: 0 };

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const initialTab = searchParams.get('tab') || 'songs';
  const [query, setQuery] = useState(initialQ);
  const [tab, setTab] = useState(initialTab);
  const [songs, setSongs] = useState(null);
  const [artists, setArtists] = useState(null);
  const [albums, setAlbums] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recents, setRecents] = useState([]);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const navigate = useNavigate();
  const scrollSavedRef = useRef(tab);

  useEffect(() => {
    inputRef.current?.focus();
    api.getRecentSearches().then(setRecents).catch(() => {});
  }, []);

  // Save scroll on tab switch + restore on tab change
  useEffect(() => {
    return () => {
      // Save scroll for current tab when unmounting/changing
      const main = document.querySelector('main');
      if (main) scrollCache[scrollSavedRef.current] = main.scrollTop;
    };
  }, []);
  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;
    // Save the scroll for the previous tab
    scrollCache[scrollSavedRef.current] = main.scrollTop;
    scrollSavedRef.current = tab;
    // Restore for new tab
    requestAnimationFrame(() => { main.scrollTop = scrollCache[tab] || 0; });
  }, [tab]);

  function doSearch(q, t) {
    if (!q.trim()) {
      setSongs(null); setArtists(null); setAlbums(null);
      return;
    }
    setLoading(true);
    const fn = t === 'artists' ? api.searchArtists : t === 'albums' ? api.searchAlbums : api.search;
    fn(q)
      .then(r => {
        if (t === 'artists') setArtists(r);
        else if (t === 'albums') setAlbums(r);
        else setSongs(r);
      })
      .catch(() => {
        if (t === 'artists') setArtists({ items: [] });
        else if (t === 'albums') setAlbums({ items: [] });
        else setSongs({ items: [] });
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (initialQ) doSearch(initialQ, tab);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setSongs(null); setArtists(null); setAlbums(null); return; }
    debounceRef.current = setTimeout(() => {
      const trimmed = query.trim();
      const params = { q: trimmed };
      if (tab !== 'songs') params.tab = tab;
      setSearchParams(params, { replace: true });
      doSearch(trimmed, tab);
      // Save the search to recents (only after 2s of no typing, handled by debounce)
      api.saveRecentSearch(trimmed);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query, tab]);

  const clearRecents = async () => {
    await api.clearRecentSearches();
    setRecents([]);
  };

  const results = tab === 'artists' ? artists : tab === 'albums' ? albums : songs;
  const hasResults = results?.items?.length > 0;

  return (
    <div className="p-6 pt-16">
      <div className="mb-4">
        <div className="relative max-w-lg">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 5L20.49 19l-5-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="What do you want to listen to?"
            className="w-full bg-neutral-800 text-white pl-12 pr-4 py-3.5 rounded-full text-sm outline-none focus:ring-2 focus:ring-white/20 placeholder:text-neutral-500" />
          {query && (
            <button onClick={() => { setQuery(''); setSongs(null); setArtists(null); setAlbums(null); inputRef.current?.focus(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
            </button>
          )}
        </div>
      </div>

      {query && (
        <div className="flex gap-2 mb-6">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${tab === t.key ? 'bg-white text-black' : 'bg-neutral-800 text-white hover:bg-neutral-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="space-y-2 mt-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-2 animate-pulse">
              <div className="w-10 h-10 rounded bg-neutral-800/60" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-neutral-800/60 rounded w-1/2" />
                <div className="h-2.5 bg-neutral-800/40 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !query && recents.length === 0 && (
        <div className="py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-neutral-800/60 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-neutral-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 5L20.49 19l-5-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
          </div>
          <div className="text-neutral-300 text-lg font-semibold mb-1">Find your next favorite song</div>
          <div className="text-neutral-500 text-sm">Search for songs, artists, or albums</div>
        </div>
      )}

      {!loading && !query && recents.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Recent searches</h2>
            <button onClick={clearRecents} className="text-xs text-neutral-400 hover:text-white">Clear all</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recents.map(q => (
              <button key={q} onClick={() => setQuery(q)}
                className="bg-neutral-800 hover:bg-neutral-700 text-white text-sm px-3 py-1.5 rounded-full transition-colors">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && query && !hasResults && (
        <div className="py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-neutral-800/60 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-neutral-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.5 9C10.12 9 9 10.12 9 11.5S10.12 14 11.5 14 14 12.88 14 11.5 12.88 9 11.5 9zm0 7c-2.48 0-4.5-2.02-4.5-4.5S9.02 7 11.5 7 16 9.02 16 11.5 13.98 16 11.5 16zm9-4h-1v-1c0-.55-.45-1-1-1s-1 .45-1 1v1h-1c-.55 0-1 .45-1 1s.45 1 1 1h1v1c0 .55.45 1 1 1s1-.45 1-1v-1h1c.55 0 1-.45 1-1s-.45-1-1-1z" />
            </svg>
          </div>
          <div className="text-neutral-300 text-lg font-semibold mb-1">No results for &ldquo;{query}&rdquo;</div>
          <div className="text-neutral-500 text-sm">Check your spelling or try different keywords.</div>
        </div>
      )}

      {!loading && tab === 'songs' && hasResults && (
        <div className="space-y-0.5">
          {songs.items.map((t, i) => <TrackRow key={t.videoId + i} track={t} index={i} tracks={songs.items} />)}
        </div>
      )}

      {!loading && tab === 'artists' && hasResults && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {artists.items.map(a => (
            <Link key={a.id} to={`/artist/${a.id}`}
              className="bg-neutral-800/40 hover:bg-neutral-800 rounded-md p-3 transition-colors text-center">
              <div className="aspect-square rounded-full mb-3 bg-neutral-800 overflow-hidden mx-auto">
                {a.thumbnail && <img src={a.thumbnail} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}
              </div>
              <div className="font-semibold text-sm truncate">{a.name}</div>
              <div className="text-xs text-neutral-400 truncate">Artist{a.subscribers ? ` · ${a.subscribers}` : ''}</div>
            </Link>
          ))}
        </div>
      )}

      {!loading && tab === 'albums' && hasResults && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {albums.items.map(a => (
            <Link key={a.id} to={`/album/${a.id}`}
              className="bg-neutral-800/40 hover:bg-neutral-800 rounded-md p-3 transition-colors">
              <div className="aspect-square rounded mb-3 bg-neutral-800 overflow-hidden">
                {a.thumbnail && <img src={a.thumbnail} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}
              </div>
              <div className="font-semibold text-sm truncate">{a.title}</div>
              <div className="text-xs text-neutral-400 truncate">{a.artist || 'Album'}{a.year ? ` · ${a.year}` : ''}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
