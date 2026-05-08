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
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { playTrack } = usePlayer();

  useEffect(() => {
    api.trending().then(setTrending).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">{greeting()}</h1>

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
