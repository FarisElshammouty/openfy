import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { api } from '../api';

export default function Sidebar() {
  const { playlists, refreshPlaylists } = usePlayer();
  const navigate = useNavigate();
  const location = useLocation();
  const [showLinks, setShowLinks] = useState(false);
  const [savedAlbums, setSavedAlbums] = useState([]);

  // Reload saved albums whenever route changes (e.g. after saving on AlbumView)
  useEffect(() => {
    api.getSavedAlbums().then(setSavedAlbums).catch(() => {});
  }, [location.pathname]);

  const create = async () => {
    const p = await api.createPlaylist(`My Playlist #${playlists.length + 1}`);
    await refreshPlaylists();
    navigate(`/playlist/${p.id}`);
  };

  const navCls = ({ isActive }) =>
    `flex items-center gap-4 px-3 py-2 rounded-md font-semibold transition-colors ${isActive ? 'text-white bg-neutral-800' : 'text-neutral-400 hover:text-white'}`;

  return (
    <aside className="w-[280px] flex flex-col gap-2 shrink-0">
      <nav className="bg-neutral-900 rounded-lg p-3 space-y-1">
        <NavLink to="/" className={navCls}>
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3L4 9v12h5v-7h6v7h5V9z" /></svg>
          Home
        </NavLink>
        <NavLink to="/search" className={navCls}>
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 5L20.49 19l-5-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" /></svg>
          Search
        </NavLink>
        <NavLink to="/stats" className={navCls}>
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z" /></svg>
          Stats
        </NavLink>
      </nav>

      <div className="bg-neutral-900 rounded-lg p-3 flex-1 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-3 px-1">
          <NavLink to="/library" className={({ isActive }) =>
            `flex items-center gap-3 font-semibold transition-colors ${isActive ? 'text-white' : 'text-neutral-400 hover:text-white'}`}>
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z" /></svg>
            Your Library
          </NavLink>
          <button onClick={create} className="text-neutral-400 hover:text-white p-1 rounded-full hover:bg-neutral-800 transition-colors" title="Create playlist">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-0.5">
          <NavLink to="/library" end className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${isActive ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-white'}`}>
            <div className="w-10 h-10 rounded bg-gradient-to-br from-indigo-800 to-indigo-400 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium">Liked Songs</div>
              <div className="text-xs text-neutral-500">Playlist</div>
            </div>
          </NavLink>

          {playlists.map(p => (
            <NavLink key={p.id} to={`/playlist/${p.id}`} className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${isActive ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-white'}`}>
              <div className="w-10 h-10 rounded bg-neutral-800 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-neutral-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-xs text-neutral-500 truncate">Playlist{p.track_count ? ` · ${p.track_count} songs` : ''}</div>
              </div>
            </NavLink>
          ))}

          {savedAlbums.map(a => (
            <NavLink key={`album-${a.id}`} to={`/album/${a.id}`} className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${isActive ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-white'}`}>
              <div className="w-10 h-10 rounded bg-neutral-800 overflow-hidden shrink-0">
                {a.thumbnail ? <img src={a.thumbnail} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : null}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{a.title}</div>
                <div className="text-xs text-neutral-500 truncate">Album{a.artist ? ` · ${a.artist}` : ''}</div>
              </div>
            </NavLink>
          ))}
        </div>

        <div className="relative mt-2 pt-2 border-t border-neutral-800">
          <button onClick={() => setShowLinks(s => !s)}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800/50 transition-colors text-sm font-medium">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
            About
          </button>
          {showLinks && (
            <div className="absolute left-0 right-0 bottom-full mb-2 flex flex-col gap-1 bg-neutral-900 rounded-lg p-2 border border-neutral-800 shadow-xl">
              <a href="https://github.com/FarisElshammouty/openfy" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800/50 transition-colors text-sm">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>
                GitHub
              </a>
              <a href="https://www.linkedin.com/in/faris-elshammouty/" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800/50 transition-colors text-sm">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                LinkedIn
              </a>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
