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
  const [micEnabled, setMicEnabled] = useState(false);
  const [micLevel, setMicLevel] = useState(0); // 0-1 instantaneous level
  const [score, setScore] = useState(null); // 0-100 cumulative
  const activeRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const animRef = useRef(null);
  // Score tracking: how many lyric lines had detectable singing
  const scoreStateRef = useRef({ linesScored: new Set(), totalLines: 0, hitLines: 0 });

  useEffect(() => {
    if (!currentTrack) return;
    setSynced([]); setPlain('');
    setScore(null);
    scoreStateRef.current = { linesScored: new Set(), totalLines: 0, hitLines: 0 };
    getLyricsCached(currentTrack).then(data => {
      if (data.syncedLyrics) setSynced(parseLRC(data.syncedLyrics));
      else if (data.plainLyrics) setPlain(data.plainLyrics);
    }).catch(() => {});
  }, [currentTrack?.videoId, getLyricsCached]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') toggleKaraoke(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleKaraoke]);

  const currentLine = synced.reduce((acc, l, i) => (progress >= l.time ? i : acc), -1);

  useEffect(() => {
    if (activeRef.current) activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentLine]);

  // Score: for each lyric line, check if user is making sound during it
  useEffect(() => {
    if (!micEnabled || currentLine < 0 || !synced[currentLine]) return;
    const s = scoreStateRef.current;
    if (s.linesScored.has(currentLine)) return;
    // Threshold: average mic level above 0.05 (anything beyond background noise)
    if (micLevel > 0.05) {
      s.linesScored.add(currentLine);
      s.hitLines += 1;
      s.totalLines = Math.max(s.totalLines, currentLine + 1);
      setScore(Math.round((s.hitLines / s.totalLines) * 100));
    }
  }, [micLevel, currentLine, micEnabled, synced]);

  // Update totalLines as currentLine progresses
  useEffect(() => {
    if (!micEnabled || currentLine < 0) return;
    const s = scoreStateRef.current;
    s.totalLines = Math.max(s.totalLines, currentLine + 1);
    if (s.totalLines > 0) setScore(Math.round((s.hitLines / s.totalLines) * 100));
  }, [currentLine, micEnabled]);

  const enableMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      analyserRef.current = analyser;

      const buf = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        // RMS
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        setMicLevel(rms);
        animRef.current = requestAnimationFrame(tick);
      };
      tick();
      setMicEnabled(true);
    } catch (e) {
      console.error('Mic error:', e);
    }
  };

  const disableMic = () => {
    cancelAnimationFrame(animRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();
    streamRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
    setMicEnabled(false);
    setMicLevel(0);
  };

  useEffect(() => () => disableMic(), []); // cleanup on unmount

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

      {/* Mic + score */}
      <div className="absolute top-6 right-20 flex items-center gap-3">
        {score !== null && (
          <div className="text-right">
            <div className="text-xs text-white/60 uppercase tracking-wider">Score</div>
            <div className="text-2xl font-black tabular-nums">{score}</div>
          </div>
        )}
        <button onClick={micEnabled ? disableMic : enableMic}
          title={micEnabled ? 'Turn off mic' : 'Sing along — turn on mic'}
          className={`p-2 rounded-full transition-colors ${micEnabled ? 'bg-green-500 text-black' : 'bg-white/10 hover:bg-white/20'}`}>
          {micEnabled
            ? <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" /></svg>
            : <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.55-.9l4.2 4.2L21 19.73 4.27 3z" /></svg>}
        </button>
      </div>

      {/* Mic level visualizer */}
      {micEnabled && (
        <div className="absolute top-20 right-6 w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 transition-[width] duration-75" style={{ width: `${Math.min(100, micLevel * 500)}%` }} />
        </div>
      )}

      <div className="w-full max-w-4xl h-full overflow-hidden flex items-center">
        {synced.length > 0 ? (
          <div className="overflow-y-auto max-h-full w-full px-12 lyrics-scroll" style={{ scrollbarWidth: 'none' }}>
            <div className="space-y-8 py-[40vh]">
              {synced.map((line, i) => {
                const sung = micEnabled && scoreStateRef.current.linesScored.has(i);
                return (
                  <p key={i} ref={i === currentLine ? activeRef : null}
                    onClick={() => seek(line.time)}
                    className={`text-center cursor-pointer transition-all duration-300 ${
                      i === currentLine
                        ? 'text-white text-5xl font-black'
                        : Math.abs(i - currentLine) === 1
                        ? 'text-white/60 text-3xl font-bold'
                        : 'text-white/30 text-2xl font-semibold'
                    } ${sung && i < currentLine ? 'text-green-400' : ''}`}>
                    {line.text}
                  </p>
                );
              })}
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
