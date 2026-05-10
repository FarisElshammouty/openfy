import { usePlayer } from '../context/PlayerContext';

export default function MiniPlayer() {
  const { currentTrack, isPlaying, progress, duration, dominantColor,
    togglePlay, playNext, playPrev, toggleMiniPlayer } = usePlayer();

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  const bg = dominantColor
    ? `linear-gradient(135deg, rgb(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b}) 0%, rgb(15,15,15) 80%)`
    : '#171717';

  return (
    <div className="fixed inset-0 z-[100] text-white select-none flex flex-col" style={{ background: bg, WebkitAppRegion: 'drag' }}>
      <div className="flex-1 flex items-center gap-3 px-3 py-3 min-h-0">
        {currentTrack ? (
          <>
            <img src={currentTrack.thumbnail} alt="" referrerPolicy="no-referrer"
              className="w-16 h-16 rounded shrink-0 object-cover bg-neutral-800 shadow-lg" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">{currentTrack.title}</div>
              <div className="text-xs text-white/70 truncate">{currentTrack.artist}</div>
              <div className="flex items-center gap-2 mt-2" style={{ WebkitAppRegion: 'no-drag' }}>
                <button onClick={playPrev} className="text-white/80 hover:text-white">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
                </button>
                <button onClick={togglePlay} className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform">
                  {isPlaying
                    ? <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                    : <svg className="w-4 h-4 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>}
                </button>
                <button onClick={playNext} className="text-white/80 hover:text-white">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="w-full text-center text-sm text-white/60">No track playing</div>
        )}
        <button onClick={toggleMiniPlayer} title="Exit mini player"
          className="absolute top-1.5 right-1.5 p-1 rounded hover:bg-white/10" style={{ WebkitAppRegion: 'no-drag' }}>
          <svg className="w-4 h-4 text-white/60 hover:text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 5h6v2H7v4H5V5zm14 0v6h-2V7h-4V5h6zm-6 14v-2h4v-4h2v6h-6zm-8 0v-6h2v4h4v2H5z" />
          </svg>
        </button>
      </div>
      <div className="h-1 bg-black/40">
        <div className="h-full bg-white transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
