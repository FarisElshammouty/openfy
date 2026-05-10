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
  const [saved, setSaved] = useState(false);
  const { playTrack } = usePlayer();

  useEffect(() => {
    setLoading(true);
    setError(false);
    setAlbum(null);
    api.getAlbum(id).then(setAlbum).catch(() => setError(true)).finally(() => setLoading(false));
    api.getSavedAlbums().then(list => setSaved(list.some(a => a.id === id))).catch(() => {});
  }, [id]);

  const toggleSave = async () => {
    if (!album) return;
    if (saved) {
      await api.unsaveAlbum(id);
      setSaved(false);
    } else {
      await api.saveAlbum({
        id,
        title: album.title,
        artist: album.artists?.[0]?.name || '',
        artistId: album.artists?.[0]?.id || '',
        thumbnail: album.thumbnail,
        year: album.year
      });
      setSaved(true);
    }
  };

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
              <span key={a.id || a.name} className="font-semibold">
                {a.id ? <Link to={`/artist/${a.id}`} className="hover:underline">{a.name}</Link> : a.name}
                {i < album.artists.length - 1 && ', '}
              </span>
            ))}
            {album.year && <span>· {album.year}</span>}
            {album.stats && <span>· {album.stats}</span>}
          </div>
        </div>
      </div>

      <div className="px-8 pb-8">
        {/* Play + Save buttons */}
        <div className="flex items-center gap-5 my-6">
          {album.tracks?.length > 0 && (
            <button onClick={playAll}
              className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-400 hover:scale-105 transition-all flex items-center justify-center text-black shadow-lg">
              <svg className="w-7 h-7 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </button>
          )}
          <button onClick={toggleSave} title={saved ? 'Remove from library' : 'Save to library'}
            className={`p-2 transition-colors ${saved ? 'text-green-500' : 'text-neutral-400 hover:text-white'}`}>
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </button>
        </div>

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
