import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { usePlayer } from '../context/PlayerContext';
import TrackRow from './TrackRow';

export default function Library() {
  const [likedTracks, setLikedTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const { playlists, refreshPlaylists, playTrack } = usePlayer();
  const navigate = useNavigate();

  useEffect(() => {
    api.getLiked().then(setLikedTracks).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const createPlaylist = async () => {
    const p = await api.createPlaylist(`My Playlist #${playlists.length + 1}`);
    await refreshPlaylists();
    navigate(`/playlist/${p.id}`);
  };

  const playAllLiked = () => {
    if (likedTracks.length) playTrack(likedTracks[0], likedTracks);
  };

  return (
    <div className="p-6 pt-16">
      {/* Liked Songs */}
      <section className="mb-10">
        <div className="bg-gradient-to-br from-indigo-800/60 to-neutral-900 rounded-lg p-6 mb-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-300 mb-1">Playlist</p>
              <h1 className="text-4xl font-bold mb-2">Liked Songs</h1>
              <p className="text-sm text-neutral-400">{likedTracks.length} songs</p>
            </div>
            {likedTracks.length > 0 && (
              <button onClick={playAllLiked}
                className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center hover:scale-105 hover:bg-green-400 transition-all shadow-xl">
                <svg className="w-5 h-5 text-black ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-neutral-500 py-4 text-center">Loading...</div>
        ) : likedTracks.length === 0 ? (
          <div className="text-neutral-500 py-4 text-center text-sm">Songs you like will appear here</div>
        ) : (
          <div className="space-y-0.5">
            {likedTracks.map((t, i) => (
              <TrackRow key={t.videoId} track={t} index={i} tracks={likedTracks} />
            ))}
          </div>
        )}
      </section>

      {/* Playlists */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Your Playlists</h2>
          <button onClick={createPlaylist}
            className="bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium py-2 px-5 rounded-full transition-colors">
            Create Playlist
          </button>
        </div>

        {playlists.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-bold mb-1">Create your first playlist</h3>
            <p className="text-neutral-400 text-sm mb-4">It's easy, we'll help you</p>
            <button onClick={createPlaylist}
              className="bg-white text-black font-bold py-2.5 px-7 rounded-full hover:scale-105 transition-transform text-sm">
              Create Playlist
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {playlists.map(p => (
              <button key={p.id} onClick={() => navigate(`/playlist/${p.id}`)}
                className="bg-neutral-800/50 hover:bg-neutral-800 rounded-lg p-4 text-left transition-colors group">
                <div className="w-full aspect-square rounded-md bg-neutral-800 mb-3 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                  <svg className="w-12 h-12 text-neutral-600" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>
                </div>
                <div className="font-medium text-sm truncate">{p.name}</div>
                <div className="text-xs text-neutral-400 truncate">{p.track_count || 0} songs</div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
