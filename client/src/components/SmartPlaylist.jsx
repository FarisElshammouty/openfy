import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { usePlayer } from '../context/PlayerContext';
import TrackRow from './TrackRow';

export default function SmartPlaylist() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { playTrack } = usePlayer();

  useEffect(() => {
    setLoading(true);
    api.getSmartPlaylistTracks(id).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const playAll = () => { if (data?.tracks?.length) playTrack(data.tracks[0], data.tracks); };

  const handleDelete = async () => {
    await api.deleteSmartPlaylist(id);
    navigate('/library');
  };

  if (loading) {
    return <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-2 border-neutral-700 border-t-green-500 rounded-full animate-spin" />
    </div>;
  }

  if (!data) return <div className="p-8 text-neutral-500 text-center">Could not load smart playlist.</div>;

  return (
    <div>
      <div className="flex items-end gap-6 p-6 pt-16 bg-gradient-to-b from-purple-800/40 to-neutral-900">
        <div className="w-48 h-48 bg-gradient-to-br from-purple-700 to-purple-900 rounded-lg shadow-2xl flex items-center justify-center shrink-0">
          <svg className="w-20 h-20 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium uppercase tracking-wider text-neutral-300">Smart Playlist</p>
          <h1 className="text-4xl font-bold mt-1 mb-3 truncate">{data.name}</h1>
          <p className="text-sm text-neutral-400">{data.tracks.length} songs · auto-updating</p>
        </div>
      </div>

      <div className="flex items-center gap-4 px-6 py-4">
        {data.tracks.length > 0 && (
          <button onClick={playAll}
            className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center hover:scale-105 hover:bg-green-400 transition-all shadow-xl">
            <svg className="w-5 h-5 text-black ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </button>
        )}
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-300">Delete smart playlist?</span>
            <button onClick={handleDelete} className="bg-red-500 hover:bg-red-400 text-white text-sm font-medium py-1.5 px-3 rounded-full">Yes, delete</button>
            <button onClick={() => setConfirmDelete(false)} className="bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-medium py-1.5 px-3 rounded-full">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-neutral-400 hover:text-red-400 transition-colors text-sm">
            Delete
          </button>
        )}
      </div>

      <div className="px-6 pb-8">
        {data.tracks.length > 0 ? (
          <div className="space-y-0.5">
            {data.tracks.map((t, i) => (
              <TrackRow key={t.videoId + i} track={t} index={i} tracks={data.tracks} />
            ))}
          </div>
        ) : (
          <div className="text-neutral-500 text-center py-8 text-sm">No tracks match this smart playlist's rules yet.</div>
        )}
      </div>
    </div>
  );
}
