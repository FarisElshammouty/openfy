import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { usePlayer } from '../context/PlayerContext';
import TrackRow from './TrackRow';

export default function ArtistView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { playTrack } = usePlayer();

  useEffect(() => {
    setLoading(true);
    setError(false);
    setArtist(null);
    api.getArtist(id).then(setArtist).catch(() => setError(true)).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-neutral-700 border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !artist) {
    return <div className="p-8 text-neutral-500 text-center">Could not load artist.</div>;
  }

  const playAll = () => { if (artist.topSongs?.length) playTrack(artist.topSongs[0], artist.topSongs); };

  return (
    <div>
      {/* Hero */}
      <div className="relative h-[340px] flex items-end p-8 overflow-hidden">
        {artist.thumbnail && (
          <>
            <img src={artist.thumbnail} alt="" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/60 to-neutral-900/20" />
          </>
        )}
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/80 mb-2">Artist</p>
          <h1 className="text-6xl font-black tracking-tight">{artist.name}</h1>
        </div>
      </div>

      <div className="px-8 pb-8 -mt-2">
        {/* Play button */}
        {artist.topSongs?.length > 0 && (
          <button onClick={playAll}
            className="mb-8 w-14 h-14 rounded-full bg-green-500 hover:bg-green-400 hover:scale-105 transition-all flex items-center justify-center text-black shadow-lg">
            <svg className="w-7 h-7 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </button>
        )}

        {/* Top songs */}
        {artist.topSongs?.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-bold mb-3">Popular</h2>
            <div className="space-y-0.5">
              {artist.topSongs.map((t, i) => (
                <TrackRow key={t.videoId} track={t} index={i} tracks={artist.topSongs} />
              ))}
            </div>
          </section>
        )}

        {/* Albums */}
        {artist.albums?.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-bold mb-3">Albums</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {artist.albums.map(a => (
                <Link key={a.id} to={`/album/${a.id}`}
                  className="bg-neutral-800/40 hover:bg-neutral-800 rounded-md p-3 transition-colors">
                  <div className="aspect-square rounded mb-3 bg-neutral-800 overflow-hidden">
                    {a.thumbnail && <img src={a.thumbnail} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}
                  </div>
                  <div className="font-semibold text-sm truncate">{a.title}</div>
                  <div className="text-xs text-neutral-400 truncate">{a.year || 'Album'}</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Singles */}
        {artist.singles?.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-bold mb-3">Singles & EPs</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {artist.singles.map(s => (
                <Link key={s.id} to={`/album/${s.id}`}
                  className="bg-neutral-800/40 hover:bg-neutral-800 rounded-md p-3 transition-colors">
                  <div className="aspect-square rounded mb-3 bg-neutral-800 overflow-hidden">
                    {s.thumbnail && <img src={s.thumbnail} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}
                  </div>
                  <div className="font-semibold text-sm truncate">{s.title}</div>
                  <div className="text-xs text-neutral-400 truncate">{s.year || 'Single'}</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Related artists */}
        {artist.related?.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-bold mb-3">Fans also like</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {artist.related.map(r => (
                <Link key={r.id} to={`/artist/${r.id}`}
                  className="bg-neutral-800/40 hover:bg-neutral-800 rounded-md p-3 transition-colors text-center">
                  <div className="aspect-square rounded-full mb-3 bg-neutral-800 overflow-hidden mx-auto">
                    {r.thumbnail && <img src={r.thumbnail} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}
                  </div>
                  <div className="font-semibold text-sm truncate">{r.name}</div>
                  <div className="text-xs text-neutral-400">Artist</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Description */}
        {artist.description && (
          <section>
            <h2 className="text-xl font-bold mb-3">About</h2>
            <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-line max-w-3xl">{artist.description}</p>
          </section>
        )}
      </div>
    </div>
  );
}
