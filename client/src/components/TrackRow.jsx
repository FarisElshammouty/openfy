import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { api } from '../api';

const MENU_W = 208; // w-52

function fmt(sec) {
  if (!sec || isNaN(sec)) return '';
  return `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}`;
}

export default function TrackRow({ track, index, tracks, onAdd, onRemove }) {
  const { currentTrack, isPlaying, playTrack, togglePlay, isLiked, toggleLike, insertNext, addToQueue, playlists } = usePlayer();
  const navigate = useNavigate();
  const active = currentTrack?.videoId === track.videoId;
  const liked = isLiked(track.videoId);
  const [menu, setMenu] = useState(null); // { x, y } | { right: true } | null
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(null); };
    const esc = (e) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [menu]);

  const handleAddToPlaylist = async (playlistId) => {
    try { await api.addToPlaylist(playlistId, track); } catch {}
    setMenu(null);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const goToArtist = (e) => {
    e?.stopPropagation();
    if (track.artistId) navigate(`/artist/${track.artistId}`);
    setMenu(null);
  };

  // The menu is rendered through a portal into <body> so it always sits in
  // the root stacking context. If it stayed inside the row, later rows in
  // the DOM (and the row's own click handler) would capture the clicks.
  const menuStyle = menu
    ? {
        position: 'fixed',
        left: Math.max(8, Math.min(menu.x, window.innerWidth - MENU_W - 8)),
        top: Math.max(8, Math.min(menu.y, window.innerHeight - 360))
      }
    : null;

  return (
    <div
      onClick={() => active ? togglePlay() : playTrack(track, tracks)}
      onContextMenu={handleContextMenu}
      className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer group transition-colors ${active ? 'bg-white/10' : 'hover:bg-white/[0.06]'}`}
    >
      <div className="w-8 text-center text-sm text-neutral-400 shrink-0">
        <span className="group-hover:hidden">
          {active && isPlaying ? (
            <span className="flex items-center justify-center gap-[3px] h-4">
              <span className="w-[3px] bg-green-500 rounded-sm eq-bar inline-block" />
              <span className="w-[3px] bg-green-500 rounded-sm eq-bar inline-block" />
              <span className="w-[3px] bg-green-500 rounded-sm eq-bar inline-block" />
            </span>
          ) : (
            <span className={active ? 'text-green-500' : ''}>{index + 1}</span>
          )}
        </span>
        <span className="hidden group-hover:inline text-white">
          <svg className="w-4 h-4 mx-auto" viewBox="0 0 24 24" fill="currentColor">
            {active && isPlaying
              ? <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              : <path d="M8 5v14l11-7z" />}
          </svg>
        </span>
      </div>

      <img src={track.thumbnail} alt="" className="w-10 h-10 rounded object-cover bg-neutral-800 shrink-0" />

      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium truncate ${active ? 'text-green-500' : ''}`}>{track.title}</div>
        <div className="text-xs text-neutral-400 truncate">
          {track.artistId ? (
            <span onClick={goToArtist} className="hover:underline hover:text-white cursor-pointer">{track.artist}</span>
          ) : track.artist}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={e => { e.stopPropagation(); toggleLike(track); }}
          className={`p-1.5 rounded-full transition-all ${liked ? 'text-green-500' : 'text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-white'}`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </button>

        <div className="relative">
          <button
            onClick={e => {
              e.stopPropagation();
              if (menu) { setMenu(null); return; }
              const r = e.currentTarget.getBoundingClientRect();
              setMenu({ x: r.right - MENU_W, y: r.bottom + 4 });
            }}
            className="p-1.5 rounded-full text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-white transition-all"
            title="More"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="text-sm text-neutral-400 w-12 text-right shrink-0">{fmt(track.duration)}</div>

      {menu && createPortal(
        <div ref={menuRef} style={menuStyle}
          className="bg-neutral-800 rounded-lg shadow-2xl py-1 z-[200] w-52 border border-neutral-700 max-h-[80vh] overflow-y-auto force-dark"
          onClick={e => e.stopPropagation()}
          onContextMenu={e => e.preventDefault()}>
          <button onClick={() => { insertNext(track); setMenu(null); }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-700 flex items-center gap-2.5 text-neutral-200">
            <svg className="w-4 h-4 text-neutral-400 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
            Play Next
          </button>
          <button onClick={() => { addToQueue(track); setMenu(null); }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-700 flex items-center gap-2.5 text-neutral-200">
            <svg className="w-4 h-4 text-neutral-400 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" /></svg>
            Add to Queue
          </button>
          <button onClick={() => { toggleLike(track); setMenu(null); }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-700 flex items-center gap-2.5 text-neutral-200">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
            {liked ? 'Remove from Liked' : 'Save to Liked'}
          </button>
          {track.artistId && (
            <button onClick={goToArtist}
              className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-700 flex items-center gap-2.5 text-neutral-200">
              <svg className="w-4 h-4 text-neutral-400 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
              Go to Artist
            </button>
          )}
          <button onClick={() => {
              navigator.clipboard.writeText(`https://music.youtube.com/watch?v=${track.videoId}`).catch(() => {});
              setMenu(null);
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-700 flex items-center gap-2.5 text-neutral-200">
            <svg className="w-4 h-4 text-neutral-400 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" /></svg>
            Copy link
          </button>
          {playlists.length > 0 && (
            <>
              <div className="border-t border-neutral-700 my-1" />
              <p className="px-3 py-1 text-xs text-neutral-500 font-semibold uppercase tracking-wider">Add to Playlist</p>
              {playlists.map(p => (
                <button key={p.id} onClick={() => handleAddToPlaylist(p.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-700 flex items-center gap-2.5 text-neutral-200 truncate">
                  <svg className="w-4 h-4 text-neutral-400 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </>
          )}
          {onAdd && (
            <button onClick={() => { onAdd(track); setMenu(null); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-700 flex items-center gap-2.5 text-neutral-200 border-t border-neutral-700 mt-1">
              <svg className="w-4 h-4 text-neutral-400 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
              Add
            </button>
          )}
          {onRemove && (
            <button onClick={() => { onRemove(track.videoId); setMenu(null); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-700 flex items-center gap-2.5 text-red-400 border-t border-neutral-700 mt-1">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
              Remove
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
