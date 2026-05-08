import { usePlayer } from '../context/PlayerContext';

function fmt(s) {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

export default function Player() {
  const {
    currentTrack, isPlaying, volume, progress, duration, shuffle, repeat,
    crossfade, showQueue, showLyrics,
    togglePlay, playNext, playPrev, seek, setVolume, toggleShuffle, toggleRepeat,
    toggleCrossfade, toggleQueue, toggleLyrics,
    isLiked, toggleLike
  } = usePlayer();

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <footer className="h-[90px] bg-black border-t border-neutral-800 flex items-center px-4 gap-4 shrink-0">
      {/* Now playing */}
      <div className="flex items-center gap-3 w-[30%] min-w-0">
        {currentTrack ? (
          <>
            <img src={currentTrack.thumbnail} alt="" className="w-14 h-14 rounded object-cover bg-neutral-800 shrink-0" />
            <div className="min-w-0 mr-2">
              <div className="text-sm font-medium truncate">{currentTrack.title}</div>
              <div className="text-xs text-neutral-400 truncate">{currentTrack.artist}</div>
            </div>
            <button onClick={() => toggleLike(currentTrack)}
              className={`shrink-0 transition-colors ${isLiked(currentTrack.videoId) ? 'text-green-500' : 'text-neutral-400 hover:text-white'}`}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill={isLiked(currentTrack.videoId) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </button>
          </>
        ) : <div className="text-sm text-neutral-500">No track playing</div>}
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center w-[40%] max-w-[720px]">
        <div className="flex items-center gap-5 mb-1">
          <button onClick={toggleShuffle} className={`transition-colors ${shuffle ? 'text-green-500' : 'text-neutral-400 hover:text-white'}`} title="Shuffle">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" /></svg>
          </button>
          <button onClick={playPrev} className="text-neutral-400 hover:text-white transition-colors" title="Previous">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
          </button>
          <button onClick={togglePlay} className="w-9 h-9 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform" title="Play/Pause">
            {isPlaying
              ? <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
              : <svg className="w-5 h-5 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>}
          </button>
          <button onClick={playNext} className="text-neutral-400 hover:text-white transition-colors" title="Next">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
          </button>
          <button onClick={toggleRepeat} className={`transition-colors relative ${repeat !== 'off' ? 'text-green-500' : 'text-neutral-400 hover:text-white'}`} title="Repeat">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" /></svg>
            {repeat === 'one' && <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-green-500 text-black rounded-full w-3 h-3 flex items-center justify-center">1</span>}
          </button>
        </div>
        <div className="flex items-center gap-2 w-full">
          <span className="text-[11px] text-neutral-400 w-10 text-right tabular-nums">{fmt(progress)}</span>
          <input type="range" min={0} max={duration || 0} value={progress} onChange={e => seek(+e.target.value)}
            className="flex-1" style={{ background: `linear-gradient(to right, #1DB954 ${pct}%, #4d4d4d ${pct}%)` }} />
          <span className="text-[11px] text-neutral-400 w-10 tabular-nums">{fmt(duration)}</span>
        </div>
      </div>

      {/* Right: Lyrics, Queue, Crossfade, Share, Volume */}
      <div className="flex items-center gap-1.5 w-[30%] justify-end">
        {/* Lyrics toggle */}
        <button onClick={toggleLyrics} title="Lyrics"
          className={`p-1.5 rounded transition-colors ${showLyrics ? 'text-green-500' : 'text-neutral-400 hover:text-white'}`}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 9H7v-2h6v2zm3 4H7v-2h9v2zm-3-8V3.5L18.5 9H13z" />
          </svg>
        </button>

        {/* Queue toggle */}
        <button onClick={toggleQueue} title="Queue"
          className={`p-1.5 rounded transition-colors ${showQueue ? 'text-green-500' : 'text-neutral-400 hover:text-white'}`}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
          </svg>
        </button>

        {/* Crossfade toggle */}
        <button onClick={toggleCrossfade} title={crossfade ? 'Crossfade on' : 'Crossfade off'}
          className={`p-1.5 rounded transition-colors ${crossfade ? 'text-green-500' : 'text-neutral-400 hover:text-white'}`}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 9V7c0-2.76-2.24-5-5-5S6 4.24 6 7v2c-1.1 0-2 .9-2 2v1h2.17C6.06 12.34 6 12.67 6 13c0 3.31 2.69 6 6 6s6-2.69 6-6c0-.33-.06-.66-.17-1H20v-1c0-1.1-.9-2-2-2h-2zm-6-2c0-1.65 1.35-3 3-3s3 1.35 3 3v2H8V7h2zm4 8.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
          </svg>
        </button>

        {/* Volume */}
        <button onClick={() => setVolume(volume === 0 ? 0.7 : 0)} className="text-neutral-400 hover:text-white transition-colors ml-1">
          {volume === 0
            ? <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A9 9 0 0021 12c0-4.28-3-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a9 9 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
            : volume < 0.5
            ? <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.5 12A4.5 4.5 0 0016 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" /></svg>
            : <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>}
        </button>
        <input type="range" min={0} max={1} step={0.01} value={volume} onChange={e => setVolume(+e.target.value)}
          className="w-24" style={{ background: `linear-gradient(to right, #1DB954 ${volume * 100}%, #4d4d4d ${volume * 100}%)` }} />
      </div>
    </footer>
  );
}
