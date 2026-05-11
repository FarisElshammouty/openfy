import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { upgradeThumbnail } from '../utils/thumb';

function parseLRC(lrc) {
  if (!lrc) return [];
  return lrc.split('\n').map(line => {
    const m = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/);
    if (!m) return null;
    const time = parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3]) / (m[3].length === 3 ? 1000 : 100);
    return { time, text: m[4] };
  }).filter(l => l && l.text.trim());
}

export default function NowPlaying() {
  const { currentTrack, progress, duration, isPlaying, dominantColor, togglePlay, playNext, playPrev, toggleNowPlaying, seek, isLiked, toggleLike, queue, queueIndex, playTrack, insertNext, addToQueue, getLyricsCached } = usePlayer();
  const [synced, setSynced] = useState([]);
  const [plain, setPlain] = useState('');
  const [upNextMenu, setUpNextMenu] = useState(null); // { x, y, track }
  const upNextMenuRef = useRef(null);
  const navigate = useNavigate();
  const activeRef = useRef(null);

  useEffect(() => {
    if (!upNextMenu) return;
    const close = (e) => { if (upNextMenuRef.current && !upNextMenuRef.current.contains(e.target)) setUpNextMenu(null); };
    const esc = (e) => { if (e.key === 'Escape') setUpNextMenu(null); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [upNextMenu]);

  useEffect(() => {
    if (!currentTrack) { setSynced([]); setPlain(''); return; }
    setSynced([]); setPlain('');
    getLyricsCached(currentTrack).then(data => {
      if (data.syncedLyrics) setSynced(parseLRC(data.syncedLyrics));
      else if (data.plainLyrics) setPlain(data.plainLyrics);
    }).catch(() => {});
  }, [currentTrack?.videoId, getLyricsCached]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') toggleNowPlaying(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleNowPlaying]);

  const currentLine = synced.reduce((acc, l, i) => (progress >= l.time ? i : acc), -1);

  useEffect(() => {
    if (activeRef.current) activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentLine]);

  if (!currentTrack) return null;

  const liked = isLiked(currentTrack.videoId);

  const bg = dominantColor
    ? `linear-gradient(135deg, rgb(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b}) 0%, rgb(20, 20, 20) 80%)`
    : 'linear-gradient(135deg, #404040 0%, #171717 80%)';

  const fmt = (s) => !s || isNaN(s) ? '0:00' : `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  const goToArtist = () => {
    if (currentTrack.artistId) {
      navigate(`/artist/${currentTrack.artistId}`);
      toggleNowPlaying();
    }
  };

  const upNext = queue.slice(queueIndex + 1, queueIndex + 4);

  return (
    <div className="force-dark fixed inset-0 z-40 flex flex-col text-white" style={{ background: bg }}>
      {/* Header */}
      <div className="flex items-center justify-between p-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-white/70">Playing from</p>
          <p className="font-semibold">{currentTrack.artist || 'Unknown'}</p>
        </div>
        <button onClick={toggleNowPlaying} className="p-2 rounded-full hover:bg-white/10" title="Close (Esc)">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 12.75h-15a.75.75 0 010-1.5h15a.75.75 0 010 1.5z" /></svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex items-center px-12 pb-12 gap-12 min-h-0">
        {/* Left: Album art + info */}
        <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto">
          <img src={upgradeThumbnail(currentTrack.thumbnail, 720)} referrerPolicy="no-referrer" alt="" className="w-full max-w-sm aspect-square rounded-lg shadow-2xl object-cover" />
          <div className="mt-8 w-full text-center">
            <h1 className="text-3xl font-bold truncate">{currentTrack.title}</h1>
            <p className={`text-lg text-white/70 truncate ${currentTrack.artistId ? 'cursor-pointer hover:text-white hover:underline' : ''}`}
              onClick={goToArtist}>{currentTrack.artist}</p>
          </div>

          {/* Progress */}
          <div className="w-full mt-6">
            <input type="range" min={0} max={duration || 0} value={progress} onChange={e => seek(+e.target.value)}
              className="w-full" style={{ background: `linear-gradient(to right, #fff ${(progress / (duration || 1)) * 100}%, rgba(255,255,255,0.3) ${(progress / (duration || 1)) * 100}%)` }} />
            <div className="flex justify-between mt-1 text-xs text-white/60 tabular-nums">
              <span>{fmt(progress)}</span>
              <span>{fmt(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-6 mt-4">
            <button onClick={() => toggleLike(currentTrack)}
              className={`p-2 transition-colors ${liked ? 'text-green-400' : 'text-white/70 hover:text-white'}`}>
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </button>
            <button onClick={playPrev} className="text-white/80 hover:text-white p-2">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
            </button>
            <button onClick={togglePlay} className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform">
              {isPlaying
                ? <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                : <svg className="w-7 h-7 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>}
            </button>
            <button onClick={playNext} className="text-white/80 hover:text-white p-2">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
            </button>
            <div className="w-10" />
          </div>
        </div>

        {/* Right: Lyrics + Up Next */}
        <div className="flex-1 flex flex-col gap-6 max-w-xl h-full min-h-0">
          {synced.length > 0 || plain ? (
            <div className="flex-1 overflow-y-auto pr-4 lyrics-scroll">
              {synced.length > 0 ? (
                <div className="space-y-3 py-12">
                  {synced.map((line, i) => (
                    <p
                      key={i}
                      ref={i === currentLine ? activeRef : null}
                      onClick={() => seek(line.time)}
                      className={`transition-all duration-300 cursor-pointer hover:text-white text-2xl font-bold leading-snug ${
                        i === currentLine ? 'text-white scale-100' : i < currentLine ? 'text-white/30' : 'text-white/50'
                      }`}>
                      {line.text}
                    </p>
                  ))}
                </div>
              ) : (
                <div className="space-y-2 py-4 text-lg text-white/80 whitespace-pre-line">{plain}</div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-white/40 text-sm">No lyrics available</div>
          )}

          {/* Up Next */}
          {upNext.length > 0 && (
            <div className="bg-black/30 backdrop-blur rounded-lg p-4 shrink-0">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white/70 mb-3">Up next</h3>
              <div className="space-y-2">
                {upNext.map(t => (
                  <button key={t.videoId}
                    onClick={() => playTrack(t, queue)}
                    onContextMenu={(e) => { e.preventDefault(); setUpNextMenu({ x: e.clientX, y: e.clientY, track: t }); }}
                    className="w-full flex items-center gap-3 hover:bg-white/10 p-1 rounded transition-colors text-left">
                    <img src={t.thumbnail} alt="" referrerPolicy="no-referrer" className="w-10 h-10 rounded object-cover bg-neutral-800" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{t.title}</div>
                      <div className="text-xs text-white/60 truncate">{t.artist}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {upNextMenu && (
        <div ref={upNextMenuRef}
          style={{ position: 'fixed', left: Math.min(upNextMenu.x, window.innerWidth - 220), top: Math.min(upNextMenu.y, window.innerHeight - 220) }}
          className="bg-neutral-800 rounded-lg shadow-2xl py-1 z-50 w-52 border border-neutral-700"
        >
          <button onClick={() => { playTrack(upNextMenu.track, queue); setUpNextMenu(null); }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-700 flex items-center gap-2.5 text-neutral-200">
            <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            Play now
          </button>
          <button onClick={() => { insertNext(upNextMenu.track); setUpNextMenu(null); }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-700 flex items-center gap-2.5 text-neutral-200">
            <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
            Play Next
          </button>
          <button onClick={() => { toggleLike(upNextMenu.track); setUpNextMenu(null); }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-700 flex items-center gap-2.5 text-neutral-200">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill={isLiked(upNextMenu.track.videoId) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
            {isLiked(upNextMenu.track.videoId) ? 'Remove from Liked' : 'Save to Liked'}
          </button>
          {upNextMenu.track.artistId && (
            <button onClick={() => { navigate(`/artist/${upNextMenu.track.artistId}`); toggleNowPlaying(); setUpNextMenu(null); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-700 flex items-center gap-2.5 text-neutral-200">
              <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
              Go to Artist
            </button>
          )}
        </div>
      )}
    </div>
  );
}
