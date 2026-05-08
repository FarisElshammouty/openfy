import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

const isElectron = navigator.userAgent.includes('Electron');

function fmt(s) {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

export default function ListenAlong() {
  const { sessionId } = useParams();
  const audioRef = useRef(new Audio());
  const videoIdRef = useRef(null);
  const [track, setTrack] = useState(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [connected, setConnected] = useState(false);
  const [ended, setEnded] = useState(false);
  const [started, setStarted] = useState(isElectron);
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    if (!isElectron && !redirected) {
      setRedirected(true);
      window.location.href = `openfy://listen/${sessionId}`;
    }
  }, [sessionId, redirected]);

  useEffect(() => {
    const a = audioRef.current;
    a.volume = volume;
    const onTime = () => setProgress(a.currentTime);
    const onDur = () => setDuration(a.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('durationchange', onDur);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('durationchange', onDur);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.pause();
      a.src = '';
    };
  }, []);

  useEffect(() => { audioRef.current.volume = volume; }, [volume]);

  useEffect(() => {
    let ws;
    let cancelled = false;

    async function connectWs() {
      let wsUrl;
      try {
        const relay = await api.getRelayInfo();
        if (relay.wsUrl) {
          wsUrl = `${relay.wsUrl}/ws/${sessionId}?role=listener`;
        }
      } catch {}

      if (!wsUrl) {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${proto}//${location.host}/ws/listen/${sessionId}?role=listener`;
      }

      if (cancelled) return;

      ws = new WebSocket(wsUrl);

      ws.onopen = () => setConnected(true);
      ws.onclose = () => setConnected(false);

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'ended') { setEnded(true); return; }
        if (msg.type !== 'state') return;

        const s = msg.data;
        const a = audioRef.current;

        if (s.videoId !== videoIdRef.current) {
          videoIdRef.current = s.videoId;
          a.src = api.streamUrl(s.videoId);
          setTrack({ videoId: s.videoId, title: s.title, artist: s.artist, thumbnail: s.thumbnail });
        }

        setDuration(s.duration || 0);

        if (s.playing && a.paused && started) a.play().catch(() => {});
        if (!s.playing && !a.paused) a.pause();

        const elapsed = (Date.now() - s.ts) / 1000;
        const expected = s.currentTime + (s.playing ? elapsed : 0);
        if (Math.abs(a.currentTime - expected) > 2) {
          a.currentTime = Math.max(0, expected);
        }
      };
    }

    connectWs();
    return () => { cancelled = true; if (ws) ws.close(); };
  }, [sessionId, started]);

  const handleStart = () => {
    setStarted(true);
    audioRef.current.play().catch(() => {});
  };

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  if (ended) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Session ended</h1>
          <p className="text-neutral-400">The host stopped the listening session.</p>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-neutral-800 to-black text-white flex flex-col items-center justify-center p-8">
        <div className="flex items-center gap-2 mb-6">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-sm text-neutral-300">
            {connected ? 'Connected' : 'Connecting...'}
          </span>
        </div>

        {track && (
          <div className="flex flex-col items-center mb-8">
            <img src={track.thumbnail} alt="" className="w-48 h-48 rounded-lg object-cover shadow-2xl mb-4 bg-neutral-800" />
            <h2 className="text-lg font-bold text-center truncate max-w-xs">{track.title}</h2>
            <p className="text-neutral-400 text-sm">{track.artist}</p>
          </div>
        )}

        <a href={`openfy://listen/${sessionId}`}
          className="bg-green-500 hover:bg-green-400 text-black font-bold text-lg px-10 py-4 rounded-full transition-transform hover:scale-105 mb-4 inline-block">
          Open in Openfy
        </a>
        <button onClick={handleStart}
          className="text-neutral-400 hover:text-white text-sm underline transition-colors">
          or listen in browser
        </button>

        <p className="text-xs text-neutral-600 mt-12">Powered by Openfy</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-800 to-black text-white flex flex-col items-center justify-center p-8">
      <div className="flex items-center gap-2 mb-8">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
        <span className="text-sm text-neutral-300">
          {connected ? 'Listening along' : 'Connecting...'}
        </span>
      </div>

      {track ? (
        <div className="flex flex-col items-center max-w-md w-full">
          <img src={track.thumbnail} alt="" className="w-72 h-72 rounded-lg object-cover shadow-2xl mb-8 bg-neutral-800" />
          <h1 className="text-2xl font-bold text-center mb-1 truncate w-full">{track.title}</h1>
          <p className="text-neutral-400 text-center mb-8">{track.artist}</p>

          <div className="w-full mb-2">
            <div className="w-full h-1 bg-neutral-700 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-neutral-400 tabular-nums">{fmt(progress)}</span>
              <span className="text-xs text-neutral-400 tabular-nums">{fmt(duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-center my-4">
            {playing
              ? <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
              : <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>}
          </div>

          <div className="flex items-center gap-3 w-48">
            <svg className="w-4 h-4 text-neutral-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
            <input type="range" min={0} max={1} step={0.01} value={volume} onChange={e => setVolume(+e.target.value)}
              className="flex-1" style={{ background: `linear-gradient(to right, #1DB954 ${volume * 100}%, #4d4d4d ${volume * 100}%)` }} />
          </div>
        </div>
      ) : (
        <div className="text-neutral-500">Waiting for host to play something...</div>
      )}

      <p className="text-xs text-neutral-600 mt-12">Powered by Openfy</p>
    </div>
  );
}
