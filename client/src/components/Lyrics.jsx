import { useState, useEffect, useRef } from 'react';
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

export default function Lyrics() {
  const { currentTrack, progress, toggleLyrics, seek, getLyricsCached } = usePlayer();
  const [synced, setSynced] = useState([]);
  const [plain, setPlain] = useState('');
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [source, setSource] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const containerRef = useRef(null);
  const activeLineRef = useRef(null);

  useEffect(() => {
    if (!currentTrack) { setSynced([]); setPlain(''); return; }
    setSynced([]); setPlain(''); setNotFound(false); setUnavailable(false); setSource(''); setLoading(true);
    getLyricsCached(currentTrack).then(data => {
      if (data.syncedLyrics) { setSynced(parseLRC(data.syncedLyrics)); setSource(data.source || ''); }
      else if (data.plainLyrics) { setPlain(data.plainLyrics); setSource(data.source || ''); }
      else if (data.unavailable) setUnavailable(true);
      else setNotFound(true);
    }).catch(() => setUnavailable(true)).finally(() => setLoading(false));
  }, [currentTrack?.videoId, getLyricsCached, retryKey]);

  const currentLine = synced.reduce((acc, line, i) => (progress >= line.time ? i : acc), -1);

  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentLine]);

  return (
    <div className="w-[400px] shrink-0 bg-neutral-900 rounded-lg flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 pb-2">
        <h2 className="font-bold text-lg">Lyrics</h2>
        <button onClick={toggleLyrics} className="text-neutral-400 hover:text-white p-1 rounded-full hover:bg-neutral-800">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
        </button>
      </div>

      <div ref={containerRef} className="overflow-y-auto flex-1 px-6 py-4 lyrics-scroll">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-neutral-600 border-t-green-500 rounded-full animate-spin" />
          </div>
        )}

        {!loading && synced.length > 0 && (
          <div className="space-y-4 pb-32 pt-8">
            {synced.map((line, i) => (
              <p
                key={i}
                ref={i === currentLine ? activeLineRef : null}
                onClick={() => seek(line.time)}
                className={`transition-all duration-300 cursor-pointer hover:text-white ${
                  i === currentLine
                    ? 'text-white text-2xl font-bold scale-100'
                    : i < currentLine
                    ? 'text-neutral-600 text-lg'
                    : 'text-neutral-500 text-lg'
                }`}
              >
                {line.text}
              </p>
            ))}
          </div>
        )}

        {!loading && !synced.length && plain && (
          <div className="space-y-3 pb-16 pt-4">
            {plain.split('\n').map((line, i) => (
              <p key={i} className={`text-lg ${line.trim() ? 'text-neutral-300' : 'h-4'}`}>
                {line || ' '}
              </p>
            ))}
          </div>
        )}

        {!loading && source && (synced.length > 0 || plain) && (
          <p className="text-[11px] text-neutral-600 text-center pb-6">Lyrics via {source}</p>
        )}

        {!loading && notFound && (
          <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
            <svg className="w-12 h-12 mb-3 text-neutral-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
            <p className="text-sm">No lyrics found</p>
            <p className="text-xs text-neutral-600 mt-1">{currentTrack?.title}</p>
          </div>
        )}

        {!loading && unavailable && (
          <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
            <svg className="w-12 h-12 mb-3 text-neutral-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
            <p className="text-sm">Couldn't reach the lyrics service</p>
            <p className="text-xs text-neutral-600 mt-1">All lyrics sources are unreachable right now</p>
            <button onClick={() => setRetryKey(k => k + 1)}
              className="mt-4 px-4 py-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold transition-colors">
              Retry
            </button>
          </div>
        )}

        {!loading && !currentTrack && (
          <div className="flex items-center justify-center py-20 text-neutral-500 text-sm">
            Play a song to see lyrics
          </div>
        )}
      </div>
    </div>
  );
}
