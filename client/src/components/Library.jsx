import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { usePlayer } from '../context/PlayerContext';
import TrackRow from './TrackRow';
import SmartPlaylistBuilder from './SmartPlaylistBuilder';

export default function Library() {
  const [likedTracks, setLikedTracks] = useState([]);
  const [savedAlbums, setSavedAlbums] = useState([]);
  const [smartPlaylists, setSmartPlaylists] = useState([]);
  const [showSmartBuilder, setShowSmartBuilder] = useState(false);
  const [loading, setLoading] = useState(true);
  const { playlists, refreshPlaylists, playTrack } = usePlayer();
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.getLiked().then(setLikedTracks).catch(() => {}),
      api.getSavedAlbums().then(setSavedAlbums).catch(() => {}),
      api.getSmartPlaylists().then(setSmartPlaylists).catch(() => {})
    ]).finally(() => setLoading(false));
  }, []);

  const [showImport, setShowImport] = useState(false);
  const [importMode, setImportMode] = useState('url'); // 'url' | 'paste'
  const [importUrl, setImportUrl] = useState('');
  const [pasteName, setPasteName] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const createPlaylist = async () => {
    const p = await api.createPlaylist(`My Playlist #${playlists.length + 1}`);
    await refreshPlaylists();
    navigate(`/playlist/${p.id}`);
  };

  const playAllLiked = () => {
    if (likedTracks.length) playTrack(likedTracks[0], likedTracks);
  };

  const handleImport = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      let r;
      if (importMode === 'url') {
        if (!importUrl.trim()) { setImporting(false); return; }
        r = await api.importPlaylist(importUrl.trim());
      } else {
        if (!pasteText.trim()) { setImporting(false); return; }
        r = await api.importTracklist(pasteName.trim() || 'Imported tracklist', pasteText.trim());
      }
      setImportResult({ ok: true, ...r });
      await refreshPlaylists();
    } catch (e) {
      setImportResult({ ok: false, error: e.message });
    }
    setImporting(false);
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

      {/* Smart Playlists */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Smart Playlists</h2>
          <button onClick={() => setShowSmartBuilder(s => !s)}
            className="bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium py-2 px-5 rounded-full transition-colors">
            {showSmartBuilder ? 'Cancel' : 'New smart playlist'}
          </button>
        </div>
        {showSmartBuilder && (
          <SmartPlaylistBuilder
            onCreated={async (id) => {
              setShowSmartBuilder(false);
              const updated = await api.getSmartPlaylists();
              setSmartPlaylists(updated);
              navigate(`/smart-playlist/${id}`);
            }}
            onCancel={() => setShowSmartBuilder(false)}
          />
        )}
        {smartPlaylists.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-4">
            {smartPlaylists.map(sp => (
              <button key={sp.id} onClick={() => navigate(`/smart-playlist/${sp.id}`)}
                className="bg-neutral-800/50 hover:bg-neutral-800 rounded-lg p-4 text-left transition-colors group">
                <div className="w-full aspect-square rounded-md bg-gradient-to-br from-purple-700 to-purple-900 mb-3 flex items-center justify-center shadow-lg">
                  <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25z" />
                  </svg>
                </div>
                <div className="font-medium text-sm truncate">{sp.name}</div>
                <div className="text-xs text-neutral-400 truncate">Smart playlist</div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Saved Albums */}
      {savedAlbums.length > 0 && (
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Saved Albums</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {savedAlbums.map(a => (
              <button key={a.id} onClick={() => navigate(`/album/${a.id}`)}
                className="bg-neutral-800/50 hover:bg-neutral-800 rounded-lg p-4 text-left transition-colors group">
                <div className="w-full aspect-square rounded-md bg-neutral-800 mb-3 overflow-hidden shadow-lg">
                  {a.thumbnail && <img src={a.thumbnail} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}
                </div>
                <div className="font-medium text-sm truncate">{a.title}</div>
                <div className="text-xs text-neutral-400 truncate">{a.artist || 'Album'}{a.year ? ` · ${a.year}` : ''}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Playlists */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Your Playlists</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowImport(s => !s)}
              className="bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium py-2 px-5 rounded-full transition-colors">
              Import
            </button>
            <button onClick={createPlaylist}
              className="bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium py-2 px-5 rounded-full transition-colors">
              Create
            </button>
          </div>
        </div>

        {showImport && (
          <div className="bg-neutral-800/40 rounded-lg p-4 mb-4 max-w-2xl">
            <div className="flex gap-2 mb-3">
              <button onClick={() => { setImportMode('url'); setImportResult(null); }}
                className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${importMode === 'url' ? 'bg-white text-black' : 'bg-neutral-800 text-white hover:bg-neutral-700'}`}>
                From URL
              </button>
              <button onClick={() => { setImportMode('paste'); setImportResult(null); }}
                className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${importMode === 'paste' ? 'bg-white text-black' : 'bg-neutral-800 text-white hover:bg-neutral-700'}`}>
                Paste tracklist
              </button>
            </div>

            {importMode === 'url' ? (
              <>
                <p className="text-xs text-neutral-400 mb-3">
                  Paste a <strong>Spotify</strong> or <strong>Anghami</strong> playlist URL. Each track will be searched on YouTube.
                  Anghami imports the playlist preview only (3-5 tracks) — for the full list, paste the tracklist instead.
                </p>
                <div className="flex gap-2">
                  <input type="text" value={importUrl} onChange={e => setImportUrl(e.target.value)}
                    placeholder="https://open.spotify.com/playlist/... or https://open.anghami.com/..."
                    className="flex-1 bg-neutral-900 text-white text-sm px-3 py-2 rounded outline-none focus:ring-2 focus:ring-white/20" />
                  <button onClick={handleImport} disabled={importing || !importUrl.trim()}
                    className="bg-green-500 text-black px-4 py-2 rounded text-sm font-semibold hover:bg-green-400 disabled:opacity-50">
                    {importing ? 'Importing...' : 'Import'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-neutral-400 mb-3">
                  Paste one track per line. Most formats are recognized:
                  <span className="block mt-1 font-mono text-neutral-500">Artist - Title<br />Title by Artist<br />Title, Artist</span>
                </p>
                <input type="text" value={pasteName} onChange={e => setPasteName(e.target.value)}
                  placeholder="Playlist name"
                  className="w-full bg-neutral-900 text-white text-sm px-3 py-2 rounded outline-none focus:ring-2 focus:ring-white/20 mb-2" />
                <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
                  placeholder="The Rapture Pt.III - &ME & Black Coffee
BODY by Levi
Fire Fire by Shimza"
                  rows={6}
                  className="w-full bg-neutral-900 text-white text-sm px-3 py-2 rounded outline-none focus:ring-2 focus:ring-white/20 mb-2 font-mono" />
                <button onClick={handleImport} disabled={importing || !pasteText.trim()}
                  className="bg-green-500 text-black px-4 py-2 rounded text-sm font-semibold hover:bg-green-400 disabled:opacity-50">
                  {importing ? 'Importing...' : `Import ${pasteText.split('\n').filter(l => l.trim()).length} tracks`}
                </button>
              </>
            )}

            {importResult && (
              <div className={`mt-3 text-sm ${importResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                {importResult.ok
                  ? <button onClick={() => navigate(`/playlist/${importResult.playlistId}`)} className="hover:underline">
                      Imported "{importResult.name}" — {importResult.added}/{importResult.total} tracks added{importResult.partial ? ' (preview only — paste tracklist for the full playlist)' : ''}
                    </button>
                  : `Error: ${importResult.error}`}
              </div>
            )}
          </div>
        )}

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
