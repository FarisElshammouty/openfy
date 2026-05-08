import { NavLink, useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { api } from '../api';

export default function Sidebar() {
  const { playlists, refreshPlaylists } = usePlayer();
  const navigate = useNavigate();

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
        </div>
      </div>
    </aside>
  );
}
