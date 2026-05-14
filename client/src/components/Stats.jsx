import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import TrackRow from './TrackRow';

export default function Stats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);

  const refresh = () => {
    setLoading(true);
    api.getStats().then(setStats).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const handleClearHistory = async () => {
    await api.clearHistory();
    setConfirmClear(false);
    refresh();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-2 border-neutral-700 border-t-green-500 rounded-full animate-spin" />
    </div>;
  }

  if (!stats || stats.totalPlays === 0) {
    return (
      <div className="p-8 pt-16 text-center text-neutral-500">
        <h1 className="text-3xl font-bold text-white mb-4">Your stats</h1>
        <p>Play some music to start building your stats.</p>
      </div>
    );
  }

  const hours = Math.floor(stats.totalSeconds / 3600);
  const minutes = Math.floor((stats.totalSeconds % 3600) / 60);

  return (
    <div className="p-6 pt-16">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Your stats</h1>
        {confirmClear ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-300">Clear all history?</span>
            <button onClick={handleClearHistory} className="bg-red-500 hover:bg-red-400 text-white text-sm font-medium py-1.5 px-4 rounded-full transition-colors">Yes, clear</button>
            <button onClick={() => setConfirmClear(false)} className="bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-medium py-1.5 px-4 rounded-full transition-colors">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmClear(true)}
            className="text-neutral-400 hover:text-red-400 text-sm transition-colors">
            Clear history
          </button>
        )}
      </div>

      {/* Big numbers */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <div className="bg-gradient-to-br from-purple-700/40 to-purple-900/20 rounded-lg p-6">
          <div className="text-xs uppercase tracking-wider text-white/70 mb-1">Total plays</div>
          <div className="text-4xl font-black">{stats.totalPlays.toLocaleString()}</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-700/40 to-emerald-900/20 rounded-lg p-6">
          <div className="text-xs uppercase tracking-wider text-white/70 mb-1">Listening time</div>
          <div className="text-4xl font-black">
            {hours > 0 ? `${hours}h ` : ''}{minutes}m
          </div>
        </div>
        <div className="bg-gradient-to-br from-rose-700/40 to-rose-900/20 rounded-lg p-6">
          <div className="text-xs uppercase tracking-wider text-white/70 mb-1">Unique tracks</div>
          <div className="text-4xl font-black">{stats.uniqueTracks.toLocaleString()}</div>
        </div>
      </div>

      {/* Top artists */}
      {stats.topArtists?.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">Top artists</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {stats.topArtists.map((a, i) => {
              const card = (
                <>
                  <div className="relative">
                    <div className="aspect-square rounded-full mb-3 bg-neutral-800 overflow-hidden">
                      {a.thumbnail && <img src={a.thumbnail} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}
                    </div>
                    <span className="absolute top-1 left-1 text-2xl font-black text-white drop-shadow">{i + 1}</span>
                  </div>
                  <div className="font-semibold text-sm truncate text-center">{a.artist}</div>
                  <div className="text-xs text-neutral-400 text-center">{a.plays} plays</div>
                </>
              );
              return a.artistId
                ? <Link key={a.artist} to={`/artist/${a.artistId}`} className="bg-neutral-800/40 hover:bg-neutral-800 rounded-md p-3 transition-colors">{card}</Link>
                : <div key={a.artist} className="bg-neutral-800/40 rounded-md p-3">{card}</div>;
            })}
          </div>
        </section>
      )}

      {/* Top tracks: TrackRow already shows index column, so we use plays as suffix */}
      {stats.topTracks?.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4">Top tracks</h2>
          <div className="space-y-0.5">
            {stats.topTracks.map((t, i) => (
              <div key={t.videoId} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <TrackRow track={t} index={i} tracks={stats.topTracks} />
                </div>
                <div className="text-xs text-neutral-400 w-20 text-right shrink-0 pr-2">{t.playCount} plays</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
