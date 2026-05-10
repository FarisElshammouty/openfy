import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { usePlayer } from '../context/PlayerContext';
import TrackRow from './TrackRow';

const GENRES = [
  { name: 'Pop Hits', q: 'pop hits 2025', from: 'from-rose-600', to: 'to-rose-900' },
  { name: 'Hip Hop', q: 'hip hop hits', from: 'from-orange-600', to: 'to-orange-900' },
  { name: 'Rock', q: 'rock hits', from: 'from-red-700', to: 'to-red-950' },
  { name: 'Electronic', q: 'electronic dance music', from: 'from-cyan-600', to: 'to-cyan-900' },
  { name: 'R&B', q: 'r&b soul music', from: 'from-purple-600', to: 'to-purple-900' },
  { name: 'Lo-fi', q: 'lofi hip hop beats', from: 'from-emerald-700', to: 'to-emerald-950' },
  { name: 'Jazz', q: 'jazz music', from: 'from-amber-600', to: 'to-amber-900' },
  { name: 'Indie', q: 'indie music', from: 'from-teal-600', to: 'to-teal-900' },
];

export default function Home() {
  const [trending, setTrending] = useState([]);
  const [recent, setRecent] = useState([]);
  const [mixes, setMixes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { playTrack, currentTrack } = usePlayer();

  useEffect(() => {
    api.trending().then(setTrending).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.getHistory().then(setRecent).catch(() => {});
    api.getMixes().then(d => setMixes(d.mixes || [])).catch(() => {});
  }, [currentTrack?.videoId]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="p-6 pt-16">
      <h1 className="text-3xl font-bold mb-6">{greeting()}</h1>

      {recent.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4">Recently played</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {recent.slice(0, 12).map(t => (
              <button key={t.videoId}
                onClick={() => playTrack(t, recent)}
                className="bg-neutral-800/40 hover:bg-neutral-800 rounded-md flex items-center gap-3 pr-3 overflow-hidden transition-colors group text-left">
                <img src={t.thumbnail} alt="" referrerPolicy="no-referrer" className="w-14 h-14 object-cover bg-neutral-800 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{t.title}</div>
                  <div className="text-xs text-neutral-400 truncate">{t.artist}</div>
                </div>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity w-9 h-9 rounded-full bg-green-500 flex items-center justify-center text-black shrink-0">
                  <svg className="w-4 h-4 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {mixes.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4">Made for you</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {mixes.map(m => (
              <button key={m.id} onClick={() => m.tracks?.length && playTrack(m.tracks[0], m.tracks)}
                className="bg-neutral-800/50 hover:bg-neutral-800 rounded-md p-3 text-left transition-colors group">
                <div className="aspect-square rounded mb-3 bg-neutral-800 overflow-hidden relative">
                  {m.thumbnail && <img src={m.thumbnail} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-green-500 text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-5 h-5 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  </span>
                </div>
                <div className="font-semibold text-sm truncate">{m.name}</div>
                <div className="text-xs text-neutral-400 line-clamp-2">{m.subtitle}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4">Browse by genre</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {GENRES.map(g => (
            <button key={g.name} onClick={() => navigate(`/search?q=${encodeURIComponent(g.q)}`)}
              className={`bg-gradient-to-br ${g.from} ${g.to} rounded-lg p-4 text-left font-bold text-lg hover:brightness-110 transition-all h-24 flex items-end`}>
              {g.name}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Trending now</h2>
        {loading ? (
          <div className="text-neutral-500 py-8 text-center">Loading trending music...</div>
        ) : trending.length === 0 ? (
          <div className="text-neutral-500 py-8 text-center">Could not load trending. Try searching for songs instead.</div>
        ) : (
          <div className="space-y-0.5">
            {trending.slice(0, 20).map((t, i) => (
              <TrackRow key={t.videoId} track={t} index={i} tracks={trending.slice(0, 20)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
