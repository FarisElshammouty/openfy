import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { usePlayer } from '../context/PlayerContext';
import TrackRow from './TrackRow';
import { upgradeThumbnail } from '../utils/thumb';

function fmt(s) {
  if (!s || isNaN(s)) return '';
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

export default function AlbumView() {
  const { id } = useParams();
  const [album, setAlbum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { playTrack } = usePlayer();

  useEffect(() => {
    setLoading(true);
    setError(false);
    setAlbum(null);
    api.getAlbum(id).then(setAlbum).catch(() => setError(true)).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-neutral-700 border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !album) {
    return <div className="p-8 text-neutral-500 text-center">Could not load album.</div>;
  }

  const playAll = () => { if (album.tracks?.length) playTrack(album.tracks[0], album.tracks); };
  const totalDuration = album.tracks?.reduce((sum, t) => sum + (t.duration || 0), 0) || 0;
  const hours = Math.floor(totalDuration / 3600);
  const minutes = Math.floor((totalDuration % 3600) / 60);

  return (
    <div>
      {/* Hero */}
      <div className="flex items-end gap-6 p-8 pt-16 bg-gradient-to-b from-neutral-700/40 to-transparent">
        <img src={upgradeThumbnail(album.thumbnail, 480)} referrerPolicy="no-referrer" alt=""
          className="w-56 h-56 rounded-md shadow-2xl object-cover bg-neutral-800" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Album</p>
          <h1 className="text-5xl font-black tracking-tight my-3">{album.title}</h1>
          <div className="flex items-center gap-2 text-sm text-neutral-300 flex-wrap">
            {album.artists?.map((a, i) => (
              <span key={a.id || a.name}>
                {a.id ? <Link to={`/artist/${a.id}`} className="font-semibold hover:underline">{a.name}</Link> : <span className="font-semibold">{a.name}</span>}
                {i < album.artists.length - 1 && <span>,</span>}
              </span>
            ))}
            {album.year && <span>· {album.year}</span>}
            {album.tracks?.length > 0 && (
              <span>· {album.tracks.length} song{album.tracks.length === 1 ? '' : 's'}{totalDuration > 0 && `, ${hours > 0 ? `${hours} hr ` : ''}${minutes} min`}</span>
            )}
          </div>
        </div>
      </div>

      <div className="px-8 pb-8">
        {/* Play button */}
        {album.tracks?.length > 0 && (
          <button onClick={playAll}
            className="my-6 w-14 h-14 rounded-full bg-green-500 hover:bg-green-400 hover:scale-105 transition-all flex items-center justify-center text-black shadow-lg">
            <svg className="w-7 h-7 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </button>
        )}

        {/* Tracks */}
        {album.tracks?.length > 0 && (
          <div className="space-y-0.5">
            {album.tracks.map((t, i) => (
              <TrackRow key={t.videoId} track={t} index={i} tracks={album.tracks} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
