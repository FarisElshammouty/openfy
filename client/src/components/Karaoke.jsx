import { useEffect, useState, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';

function parseLRC(lrc) {
  if (!lrc) return [];
  return lrc.split('\n').map(line => {
    const m = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/);
    if (!m) return null;
    const time = parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3]) / (m[3].length === 3 ? 1000 : 100);
    return { time, text: m[4] };
  }).filter(l => l && l.text.trim());
}

export default function Karaoke() {
  const { currentTrack, progress, seek, dominantColor, toggleKaraoke, togglePlay, isPlaying, getLyricsCached } = usePlayer();
  const [synced, setSynced] = useState([]);
  const [plain, setPlain] = useState('');
  const activeRef = useRef(null);

  useEffect(() => {
    if (!currentTrack) return;
    setSynced([]); setPlain('');
    getLyricsCached(currentTrack).then(data => {
      if (data.syncedLyrics) setSynced(parseLRC(data.syncedLyrics));
      else if (data.plainLyrics) setPlain(data.plainLyrics);
    }).catch(() => {});
  }, [currentTrack?.videoId, getLyricsCached]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') toggleKaraoke();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleKaraoke]);

  const currentLine = synced.reduce((acc, l, i) => (progress >= l.time ? i : acc), -1);

  useEffect(() => {
    if (activeRef.current) activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentLine]);

  if (!currentTrack) return null;

  const bg = dominantColor
    ? `radial-gradient(ellipse at top, rgba(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b}, 0.5), rgba(0,0,0,1) 80%), #000`
    : 'radial-gradient(ellipse at top, #2a2a2a, #000 80%), #000';

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center text-white bg-black" style={{ background: bg }}>
      <button onClick={toggleKaraoke}
        className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 z-10" title="Exit karaoke (Esc)">
        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
      </button>

      <div className="absolute top-6 left-6 text-sm">
        <div className="text-white/70 uppercase tracking-wider text-xs">Karaoke</div>
        <div className="font-semibold mt-0.5">{currentTrack.title}</div>
        <div className="text-white/60 text-xs">{currentTrack.artist}</div>
      </div>

      <div className="w-full max-w-4xl h-full overflow-hidden flex items-center">
        {synced.length > 0 ? (
          <div className="overflow-y-auto max-h-full w-full px-12 lyrics-scroll" style={{ scrollbarWidth: 'none' }}>
            <div className="space-y-8 py-[40vh]">
              {synced.map((line, i) => (
                <p key={i} ref={i === currentLine ? activeRef : null}
                  onClick={() => seek(line.time)}
                  className={`text-center cursor-pointer transition-all duration-300 ${
                    i === currentLine
                      ? 'text-white text-5xl font-black'
                      : Math.abs(i - currentLine) === 1
                      ? 'text-white/60 text-3xl font-bold'
                      : 'text-white/30 text-2xl font-semibold'
                  }`}>
                  {line.text}
                </p>
              ))}
            </div>
          </div>
        ) : plain ? (
          <div className="overflow-y-auto max-h-full w-full px-12 text-2xl text-center whitespace-pre-line text-white/80 leading-relaxed">{plain}</div>
        ) : (
          <div className="w-full text-center text-white/40 text-xl">No lyrics available</div>
        )}
      </div>

      <button onClick={togglePlay}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform">
        {isPlaying
          ? <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
          : <svg className="w-8 h-8 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>}
      </button>
    </div>
  );
}
