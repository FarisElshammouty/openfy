import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { usePlayer } from '../context/PlayerContext';
import TrackRow from './TrackRow';

export default function PlaylistView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { playTrack, refreshPlaylists } = usePlayer();
  const [playlist, setPlaylist] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => { load(); }, [id]);

  async function load() {
    const data = await api.getPlaylist(id);
    setPlaylist(data);
    setEditName(data.name);
  }

  const playAll = () => {
    if (playlist?.tracks.length) playTrack(playlist.tracks[0], playlist.tracks);
  };

  const handleRename = async () => {
    if (editName.trim() && editName !== playlist.name) {
      await api.updatePlaylist(id, { name: editName.trim() });
      setPlaylist(p => ({ ...p, name: editName.trim() }));
      refreshPlaylists();
    }
    setEditing(false);
  };

  const handleDelete = async () => {
    await api.deletePlaylist(id);
    await refreshPlaylists();
    navigate('/library');
  };

  const handleRemove = async (videoId) => {
    await api.removeFromPlaylist(id, videoId);
    setPlaylist(p => ({ ...p, tracks: p.tracks.filter(t => t.videoId !== videoId) }));
    refreshPlaylists();
  };

  const handleAdd = async (track) => {
    try {
      await api.addToPlaylist(id, track);
      setPlaylist(p => ({ ...p, tracks: [...p.tracks, track] }));
      refreshPlaylists();
    } catch {}
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQ.trim()) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.search(searchQ.trim());
        setSearchResults(data.items || []);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [searchQ]);

  if (!playlist) return <div className="p-6 text-neutral-500">Loading...</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-end gap-6 p-6 bg-gradient-to-b from-neutral-800/60 to-neutral-900">
        <div className="w-48 h-48 bg-neutral-800 rounded-lg shadow-2xl flex items-center justify-center shrink-0">
          <svg className="w-16 h-16 text-neutral-600" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium uppercase tracking-wider text-neutral-300">Playlist</p>
          {editing ? (
            <input value={editName} onChange={e => setEditName(e.target.value)}
              onBlur={handleRename} onKeyDown={e => e.key === 'Enter' && handleRename()} autoFocus
              className="text-4xl font-bold mt-1 mb-3 bg-neutral-800 rounded px-2 py-1 outline-none w-full" />
          ) : (
            <h1 className="text-4xl font-bold mt-1 mb-3 cursor-pointer hover:underline decoration-2 truncate" onClick={() => setEditing(true)}>
              {playlist.name}
            </h1>
          )}
          <p className="text-sm text-neutral-400">{playlist.tracks.length} songs</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 px-6 py-4">
        {playlist.tracks.length > 0 && (
          <button onClick={playAll}
            className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center hover:scale-105 hover:bg-green-400 transition-all shadow-xl">
            <svg className="w-5 h-5 text-black ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </button>
        )}
        <button onClick={handleDelete} className="text-neutral-400 hover:text-red-400 transition-colors text-sm">
          Delete
        </button>
      </div>

      {/* Tracks */}
      <div className="px-6 pb-4">
        {playlist.tracks.length === 0 && !searchQ && (
          <div className="text-neutral-500 text-center py-8 text-sm">This playlist is empty. Search below to add songs.</div>
        )}

        {playlist.tracks.length > 0 && (
          <div className="space-y-0.5 mb-8">
            {playlist.tracks.map((t, i) => (
              <TrackRow key={t.videoId} track={t} index={i} tracks={playlist.tracks} onRemove={handleRemove} />
            ))}
          </div>
        )}

        {/* Add songs */}
        <div>
          <h3 className="text-lg font-bold mb-3">Find songs to add</h3>
          <div className="relative max-w-md mb-4">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 5L20.49 19l-5-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
            <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
              placeholder="Search for songs..."
              className="w-full bg-neutral-800 text-white text-sm pl-9 pr-4 py-2.5 rounded-md outline-none focus:ring-1 focus:ring-white/20 placeholder:text-neutral-500" />
          </div>

          {searching && <div className="text-neutral-500 text-sm py-2">Searching...</div>}

          {searchResults.length > 0 && (
            <div className="space-y-0.5">
              {searchResults.map((t, i) => {
                const alreadyAdded = playlist.tracks.some(pt => pt.videoId === t.videoId);
                return (
                  <TrackRow key={t.videoId + i} track={t} index={i} tracks={searchResults}
                    onAdd={alreadyAdded ? undefined : handleAdd} />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
