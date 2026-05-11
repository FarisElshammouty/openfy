import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { upgradeThumbnail } from '../utils/thumb';

const MODES = [
  { key: 'bars', label: 'Bars' },
  { key: 'circular', label: 'Circular' },
  { key: 'wave', label: 'Wave' },
  { key: 'particles', label: 'Particles' },
  { key: 'bars3d', label: '3D' },
  { key: 'sunburst', label: 'Sunburst' },
  { key: 'vinyl', label: 'Vinyl' },
  { key: 'kaleidoscope', label: 'Kaleidoscope' },
  { key: 'landscape', label: 'Landscape' },
  { key: 'oscilloscope', label: 'Scope' }
];

// ─── Helpers ──────────────────────────────────────────────────────────────

// Log-spaced frequency bands (musically meaningful). Returns array of avg
// magnitudes (0-255) for each band.
function logBands(freqData, numBands, sampleRate = 44100, fftSize = 512) {
  const minHz = 30;
  const maxHz = Math.min(20000, sampleRate / 2);
  const minLog = Math.log10(minHz);
  const maxLog = Math.log10(maxHz);
  const binHz = sampleRate / fftSize;
  const out = new Array(numBands);

  for (let i = 0; i < numBands; i++) {
    const lo = Math.pow(10, minLog + (i / numBands) * (maxLog - minLog));
    const hi = Math.pow(10, minLog + ((i + 1) / numBands) * (maxLog - minLog));
    const loBin = Math.max(0, Math.floor(lo / binHz));
    const hiBin = Math.min(freqData.length - 1, Math.ceil(hi / binHz));
    let sum = 0;
    let count = 0;
    for (let j = loBin; j <= hiBin; j++) {
      sum += freqData[j];
      count++;
    }
    out[i] = count > 0 ? sum / count : 0;
  }
  return out;
}

// Smooth bar values across frames with attack + decay (peak-decay style).
function smoothBands(target, prev, attack = 0.5, decay = 0.08) {
  for (let i = 0; i < target.length; i++) {
    const t = target[i];
    if (t > prev[i]) prev[i] = prev[i] * (1 - attack) + t * attack;
    else prev[i] = prev[i] * (1 - decay) + t * decay;
  }
  return prev;
}

// Color for a frequency band based on its position (bass=red, mid=yellow/green, treble=blue/purple).
function freqBandColor(t, alpha = 1) {
  // t in [0,1]. Hue rotates from 0 (red) through 60 (yellow), 120 (green), 220 (blue), 280 (purple).
  const hue = 360 - t * 280; // 360→80
  return `hsla(${hue}, 90%, 55%, ${alpha})`;
}

// Detect a beat by tracking bass-band energy over the last ~1s and looking for spikes.
function makeOnsetDetector() {
  const history = [];
  let lastBeat = 0;
  return (freqData) => {
    let bass = 0;
    for (let i = 0; i < 12; i++) bass += freqData[i];
    bass /= 12;
    history.push(bass);
    if (history.length > 50) history.shift();
    const avg = history.reduce((a, b) => a + b, 0) / history.length;
    const now = performance.now();
    if (bass > avg * 1.4 && bass > 60 && now - lastBeat > 200) {
      lastBeat = now;
      return Math.min(1, (bass - avg) / 80);
    }
    return 0;
  };
}

function loadImage(url) {
  return new Promise((resolve) => {
    if (!url) { resolve(null); return; }
    const proxied = `/api/img-proxy?url=${encodeURIComponent(url)}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = proxied;
  });
}

function parseLRC(lrc) {
  if (!lrc) return [];
  return lrc.split('\n').map(line => {
    const m = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/);
    if (!m) return null;
    const time = parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3]) / (m[3].length === 3 ? 1000 : 100);
    return { time, text: m[4] };
  }).filter(l => l && l.text.trim());
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function Visualizer() {
  const {
    currentTrack, progress, duration, isPlaying, dominantColor,
    togglePlay, playNext, playPrev, toggleVisualizer,
    getAnalyser, getAnalyserStream, isLiked, toggleLike,
    getLyricsCached
  } = usePlayer();

  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const [mode, setMode] = useState('bars');
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showLyricsOverlay, setShowLyricsOverlay] = useState(true);
  const [recording, setRecording] = useState(false);
  const [snapshotFlash, setSnapshotFlash] = useState(false);
  const hideControlsTimer = useRef(null);

  // Persistent refs across renders
  const smoothedRef = useRef(new Float32Array(96));
  const beatRef = useRef(makeOnsetDetector());
  const particlesRef = useRef([]);
  const imageRef = useRef(null);
  const vinylRotRef = useRef(0);
  const kaleidoRotRef = useRef(0);
  const landscapeBufRef = useRef([]);
  const recorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const [synced, setSynced] = useState([]);

  // Load album art (proxied for CORS)
  useEffect(() => {
    if (!currentTrack?.thumbnail) { imageRef.current = null; return; }
    loadImage(upgradeThumbnail(currentTrack.thumbnail, 720)).then(img => { imageRef.current = img; });
  }, [currentTrack?.thumbnail]);

  // Load synced lyrics
  useEffect(() => {
    if (!currentTrack) { setSynced([]); return; }
    setSynced([]);
    getLyricsCached(currentTrack).then(data => {
      if (data.syncedLyrics) setSynced(parseLRC(data.syncedLyrics));
    }).catch(() => {});
  }, [currentTrack?.videoId, getLyricsCached]);

  const currentLyric = synced.length > 0
    ? synced.reduce((acc, l) => (progress >= l.time ? l : acc), null)
    : null;

  // Auto-hide controls
  useEffect(() => {
    const showControls = () => {
      setControlsVisible(true);
      clearTimeout(hideControlsTimer.current);
      hideControlsTimer.current = setTimeout(() => setControlsVisible(false), 3000);
    };
    showControls();
    window.addEventListener('mousemove', showControls);
    return () => { window.removeEventListener('mousemove', showControls); clearTimeout(hideControlsTimer.current); };
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') toggleVisualizer(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleVisualizer]);

  // Stop any in-flight recording when the visualizer unmounts so MediaRecorder + canvas stream don't leak
  useEffect(() => () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch {}
    }
    recorderRef.current = null;
  }, []);

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ─── Main render loop ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const analyser = getAnalyser();

    const accent = dominantColor || { r: 29, g: 185, b: 84 };
    const accentStr = `rgb(${accent.r}, ${accent.g}, ${accent.b})`;
    const accentRgba = (a) => `rgba(${accent.r},${accent.g},${accent.b},${a})`;

    // Placeholder when no analyser
    if (!analyser) {
      const draw = (t) => {
        const w = window.innerWidth, h = window.innerHeight;
        ctx.clearRect(0, 0, w, h);
        const pulse = (Math.sin(t / 600) + 1) / 2;
        const grd = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 3);
        grd.addColorStop(0, accentRgba(0.3 + pulse * 0.3));
        grd.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
        animRef.current = requestAnimationFrame(draw);
      };
      animRef.current = requestAnimationFrame(draw);
      return () => cancelAnimationFrame(animRef.current);
    }

    const bufferLen = analyser.frequencyBinCount;
    const freqData = new Uint8Array(bufferLen);
    const waveData = new Uint8Array(analyser.fftSize);

    const draw = () => {
      const w = window.innerWidth, h = window.innerHeight;
      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(waveData);
      const beat = beatRef.current(freqData);

      // ─── Mode dispatch ─────────────────────────────────────────────────
      if (mode === 'bars') drawBars(ctx, freqData, w, h, smoothedRef.current);
      else if (mode === 'circular') drawCircular(ctx, freqData, w, h, smoothedRef.current, imageRef.current, accent);
      else if (mode === 'wave') drawWave(ctx, waveData, w, h, accent);
      else if (mode === 'particles') drawParticles(ctx, freqData, w, h, particlesRef.current, beat, accent);
      else if (mode === 'bars3d') drawBars3D(ctx, freqData, w, h, smoothedRef.current);
      else if (mode === 'sunburst') drawSunburst(ctx, freqData, w, h, smoothedRef.current, imageRef.current, accent, beat);
      else if (mode === 'vinyl') drawVinyl(ctx, freqData, w, h, imageRef.current, vinylRotRef, isPlaying, accent);
      else if (mode === 'kaleidoscope') drawKaleidoscope(ctx, freqData, w, h, imageRef.current, kaleidoRotRef, accent, beat);
      else if (mode === 'landscape') drawLandscape(ctx, freqData, w, h, landscapeBufRef.current, accent);
      else if (mode === 'oscilloscope') drawOscilloscope(ctx, waveData, w, h);

      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [mode, dominantColor, getAnalyser, isPlaying]);

  // ─── Snapshot ─────────────────────────────────────────────────────────────
  const snapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `openfy-${(currentTrack?.title || 'visualizer').replace(/[^a-z0-9]/gi, '_')}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
    setSnapshotFlash(true);
    setTimeout(() => setSnapshotFlash(false), 200);
  };

  // ─── Recording ────────────────────────────────────────────────────────────
  const startRecording = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const videoStream = canvas.captureStream(30);
      const audioStream = getAnalyserStream();
      const tracks = [...videoStream.getVideoTracks()];
      if (audioStream) tracks.push(...audioStream.getAudioTracks());
      const combined = new MediaStream(tracks);
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(combined, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `openfy-${(currentTrack?.title || 'visualizer').replace(/[^a-z0-9]/gi, '_')}.webm`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      setRecording(true);
    } catch (e) {
      console.error('Recording failed:', e);
      alert('Recording failed: ' + e.message);
    }
  };
  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  if (!currentTrack) {
    return (
      <div className="force-dark fixed inset-0 z-50 bg-black flex items-center justify-center text-white/40">
        <div className="text-center">
          <p className="text-lg mb-2">No track playing</p>
          <button onClick={toggleVisualizer} className="text-sm underline">Close</button>
        </div>
      </div>
    );
  }

  const liked = isLiked(currentTrack.videoId);
  const pct = duration > 0 ? (progress / duration) * 100 : 0;
  const fmt = (s) => !s || isNaN(s) ? '0:00' : `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="force-dark fixed inset-0 z-50 bg-black overflow-hidden">
      {/* Blurred album art backdrop (for non-image-heavy modes) */}
      {currentTrack?.thumbnail && !['vinyl', 'kaleidoscope'].includes(mode) && (
        <img src={upgradeThumbnail(currentTrack.thumbnail, 720)} referrerPolicy="no-referrer" alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none"
          style={{ filter: 'blur(50px) saturate(1.4)' }} />
      )}

      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Snapshot flash */}
      {snapshotFlash && <div className="absolute inset-0 bg-white animate-[ping_0.2s] pointer-events-none" />}

      {/* Lyrics overlay (bottom-center, fades in/out per line) */}
      {showLyricsOverlay && currentLyric && (
        <div className="absolute bottom-32 left-0 right-0 text-center pointer-events-none px-8">
          <p className="text-3xl font-bold text-white drop-shadow-2xl transition-opacity duration-300"
            style={{ textShadow: '0 4px 24px rgba(0,0,0,0.8)' }}>
            {currentLyric.text}
          </p>
        </div>
      )}

      {/* Upper-left: rich now-playing card */}
      <div className={`absolute top-6 left-6 transition-opacity duration-500 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center gap-4 bg-black/40 backdrop-blur-md rounded-2xl p-3 pr-5 border border-white/10">
          <img src={upgradeThumbnail(currentTrack.thumbnail, 240)} referrerPolicy="no-referrer"
            alt="" className="w-16 h-16 rounded-md object-cover shadow-xl" />
          <div className="text-white max-w-xs">
            <div className="text-[10px] uppercase tracking-wider text-white/60 mb-0.5">Visualizer</div>
            <div className="font-bold text-base truncate">{currentTrack.title}</div>
            <div className="text-sm text-white/70 truncate mb-1.5">{currentTrack.artist}</div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/60 tabular-nums">{fmt(progress)}</span>
              <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden min-w-[120px]">
                <div className="h-full bg-white" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] text-white/60 tabular-nums">{fmt(duration)}</span>
            </div>
          </div>
          <button onClick={() => toggleLike(currentTrack)} title={liked ? 'Unlike' : 'Like'}
            className={`shrink-0 ${liked ? 'text-green-400' : 'text-white/60 hover:text-white'}`}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Top-right: snapshot, record, lyrics-toggle, close */}
      <div className={`absolute top-6 right-6 flex items-center gap-2 transition-opacity duration-500 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
        <button onClick={() => setShowLyricsOverlay(s => !s)} title={showLyricsOverlay ? 'Hide lyrics' : 'Show lyrics'}
          className={`p-2 rounded-full ${showLyricsOverlay ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 9H7v-2h6v2zm3 4H7v-2h9v2zm-3-8V3.5L18.5 9H13z" /></svg>
        </button>
        <button onClick={snapshot} title="Save snapshot"
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" /></svg>
        </button>
        <button onClick={recording ? stopRecording : startRecording}
          title={recording ? 'Stop recording' : 'Record video'}
          className={`p-2 rounded-full ${recording ? 'bg-red-500 text-white animate-pulse' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
          {recording
            ? <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
            : <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6" /></svg>}
        </button>
        <button onClick={toggleVisualizer} title="Exit (Esc)"
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
        </button>
      </div>

      {/* Bottom: mode picker + transport */}
      <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 transition-opacity duration-500 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex gap-1 bg-black/60 backdrop-blur rounded-full p-1 flex-wrap justify-center max-w-3xl">
          {MODES.map(m => (
            <button key={m.key} onClick={() => setMode(m.key)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${mode === m.key ? 'bg-white text-black font-semibold' : 'text-white/80 hover:text-white'}`}>
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <button onClick={playPrev} className="text-white/80 hover:text-white">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
          </button>
          <button onClick={togglePlay}
            className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform">
            {isPlaying
              ? <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
              : <svg className="w-7 h-7 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>}
          </button>
          <button onClick={playNext} className="text-white/80 hover:text-white">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Mode renderers ────────────────────────────────────────────────────────

function drawBars(ctx, freqData, w, h, smoothed) {
  // Soft trail fade
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.fillRect(0, 0, w, h);

  const bands = 80;
  const target = logBands(freqData, bands);
  const smooth = smoothBands(target, smoothed.subarray(0, bands), 0.55, 0.06);
  const barWidth = w / bands;

  ctx.shadowBlur = 18;

  for (let i = 0; i < bands; i++) {
    const v = smooth[i] / 255;
    const barH = Math.pow(v, 1.2) * h * 0.7;
    const x = i * barWidth;
    const t = i / bands;
    const color = freqBandColor(t, 0.9);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.fillRect(x + 1, h - barH, barWidth - 2, barH);
  }
  ctx.shadowBlur = 0;
}

function drawCircular(ctx, freqData, w, h, smoothed, image, accent) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2;
  const baseR = Math.min(w, h) * 0.16;
  const bins = 96;
  const target = logBands(freqData, bins);
  const smooth = smoothBands(target, smoothed.subarray(0, bins), 0.5, 0.1);

  // Album art in center
  if (image) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, baseR - 6, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(image, cx - baseR, cy - baseR, baseR * 2, baseR * 2);
    ctx.restore();
  }

  // Glow ring
  const glowGrd = ctx.createRadialGradient(cx, cy, baseR * 0.5, cx, cy, baseR * 2.2);
  glowGrd.addColorStop(0, 'rgba(0,0,0,0)');
  glowGrd.addColorStop(0.6, `rgba(${accent.r},${accent.g},${accent.b},0.3)`);
  glowGrd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrd;
  ctx.beginPath();
  ctx.arc(cx, cy, baseR * 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Bars radiating outward
  ctx.shadowBlur = 8;
  for (let i = 0; i < bins; i++) {
    const v = smooth[i] / 255;
    const len = Math.pow(v, 1.2) * baseR * 1.3;
    const angle = (i / bins) * Math.PI * 2 - Math.PI / 2;
    const x1 = cx + Math.cos(angle) * baseR;
    const y1 = cy + Math.sin(angle) * baseR;
    const x2 = cx + Math.cos(angle) * (baseR + len);
    const y2 = cy + Math.sin(angle) * (baseR + len);
    const color = freqBandColor(i / bins, 0.95);
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.lineWidth = (2 * Math.PI * baseR) / bins * 0.75;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

function drawWave(ctx, waveData, w, h, accent) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fillRect(0, 0, w, h);
  ctx.shadowBlur = 14;
  ctx.shadowColor = `rgb(${accent.r},${accent.g},${accent.b})`;

  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass === 0 ? `rgb(${accent.r},${accent.g},${accent.b})` : `rgba(${accent.r},${accent.g},${accent.b},0.4)`;
    ctx.lineWidth = pass === 0 ? 3 : 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const slice = w / waveData.length;
    for (let i = 0; i < waveData.length; i++) {
      const v = (waveData[i] - 128) / 128;
      const y = h / 2 + (pass === 0 ? 1 : -1) * v * h * 0.32;
      if (i === 0) ctx.moveTo(0, y);
      else ctx.lineTo(i * slice, y);
    }
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

function drawParticles(ctx, freqData, w, h, particles, beat, accent) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
  ctx.fillRect(0, 0, w, h);

  // Average high-band energy for the core pulse
  let highEnergy = 0;
  for (let i = freqData.length / 2; i < freqData.length * 0.75; i++) highEnergy += freqData[i];
  highEnergy /= (freqData.length * 0.25 * 255);

  // Spawn on actual beats (onset detection passed in via `beat`)
  if (beat > 0 && particles.length < 400) {
    const count = Math.floor(8 + beat * 24);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + beat * 14 + Math.random() * 4;
      const t = Math.random();
      particles.push({
        x: w / 2, y: h / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1, size: 2 + Math.random() * 4,
        hue: 360 - t * 280
      });
    }
  }

  ctx.shadowBlur = 10;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.985; p.vy *= 0.985;
    p.life -= 0.012;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    const color = `hsla(${p.hue},90%,55%,${p.life})`;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Central pulsing core
  const coreR = 30 + highEnergy * 80 + beat * 60;
  const grd = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, coreR);
  grd.addColorStop(0, `rgba(${accent.r},${accent.g},${accent.b},${0.4 + highEnergy * 0.4 + beat * 0.3})`);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, coreR, 0, Math.PI * 2);
  ctx.fill();
}

function drawBars3D(ctx, freqData, w, h, smoothed) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fillRect(0, 0, w, h);

  const bands = 40;
  const target = logBands(freqData, bands);
  const smooth = smoothBands(target, smoothed.subarray(0, bands), 0.5, 0.08);

  const cx = w / 2;
  const baseY = h * 0.75;
  const vp = { x: cx, y: h * 0.25 }; // vanishing point
  const barWidth = w * 0.7 / bands;
  const startX = cx - (bands * barWidth) / 2;

  for (let i = 0; i < bands; i++) {
    const v = smooth[i] / 255;
    const barH = Math.pow(v, 1.3) * h * 0.45;
    const x = startX + i * barWidth;
    const x2 = x + barWidth - 2;
    // Back face (toward vanishing point)
    const depthFactor = 0.4;
    const bx = x + (vp.x - x) * depthFactor;
    const bx2 = x2 + (vp.x - x2) * depthFactor;
    const by_top = (baseY - barH) + (vp.y - (baseY - barH)) * depthFactor;
    const by_bot = baseY + (vp.y - baseY) * depthFactor;

    const t = i / bands;
    const front = freqBandColor(t, 0.95);
    const back = freqBandColor(t, 0.4);

    // Top face
    ctx.fillStyle = back;
    ctx.beginPath();
    ctx.moveTo(x, baseY - barH);
    ctx.lineTo(bx, by_top);
    ctx.lineTo(bx2, by_top);
    ctx.lineTo(x2, baseY - barH);
    ctx.closePath();
    ctx.fill();

    // Right face
    ctx.fillStyle = back;
    ctx.beginPath();
    ctx.moveTo(x2, baseY - barH);
    ctx.lineTo(bx2, by_top);
    ctx.lineTo(bx2, by_bot);
    ctx.lineTo(x2, baseY);
    ctx.closePath();
    ctx.fill();

    // Front face
    ctx.fillStyle = front;
    ctx.fillRect(x, baseY - barH, barWidth - 2, barH);
  }

  // Floor reflection (subtle gradient)
  const refl = ctx.createLinearGradient(0, baseY, 0, h);
  refl.addColorStop(0, 'rgba(255,255,255,0.05)');
  refl.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = refl;
  ctx.fillRect(0, baseY, w, h - baseY);
}

function drawSunburst(ctx, freqData, w, h, smoothed, image, accent, beat) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2;
  const baseR = Math.min(w, h) * 0.22 + beat * 12;
  const bins = 128;
  const target = logBands(freqData, bins);
  const smooth = smoothBands(target, smoothed.subarray(0, bins), 0.55, 0.1);

  // Rotating album art in center
  if (image) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(performance.now() / 8000);
    ctx.beginPath();
    ctx.arc(0, 0, baseR - 8, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(image, -baseR, -baseR, baseR * 2, baseR * 2);
    ctx.restore();

    // Frame
    ctx.strokeStyle = `rgba(${accent.r},${accent.g},${accent.b},0.6)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, baseR - 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Sunburst rays
  ctx.shadowBlur = 16;
  for (let i = 0; i < bins; i++) {
    const v = smooth[i] / 255;
    const len = Math.pow(v, 1.4) * Math.min(w, h) * 0.35;
    const angle = (i / bins) * Math.PI * 2 - Math.PI / 2;
    const x1 = cx + Math.cos(angle) * baseR;
    const y1 = cy + Math.sin(angle) * baseR;
    const x2 = cx + Math.cos(angle) * (baseR + len);
    const y2 = cy + Math.sin(angle) * (baseR + len);
    const color = freqBandColor(i / bins, 0.85);
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

function drawVinyl(ctx, freqData, w, h, image, vinylRotRef, isPlaying, accent) {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) * 0.4;

  if (isPlaying) vinylRotRef.current += 0.012; // ~33 RPM-ish

  // Vinyl disc
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(vinylRotRef.current);

  // Outer black disc
  const discGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  discGrd.addColorStop(0, '#222');
  discGrd.addColorStop(0.4, '#0a0a0a');
  discGrd.addColorStop(1, '#000');
  ctx.fillStyle = discGrd;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Grooves — pulse with bass
  let bassE = 0;
  for (let i = 0; i < 8; i++) bassE += freqData[i];
  bassE /= (8 * 255);
  ctx.strokeStyle = `rgba(255,255,255,${0.04 + bassE * 0.08})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < 30; i++) {
    const groove = r * 0.4 + (r * 0.55) * (i / 30);
    ctx.beginPath();
    ctx.arc(0, 0, groove, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Label (album art) in center
  const labelR = r * 0.35;
  if (image) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, labelR, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(image, -labelR, -labelR, labelR * 2, labelR * 2);
    ctx.restore();
  } else {
    ctx.fillStyle = `rgb(${accent.r},${accent.g},${accent.b})`;
    ctx.beginPath();
    ctx.arc(0, 0, labelR, 0, Math.PI * 2);
    ctx.fill();
  }
  // Spindle hole
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Highlight reflections (don't rotate with disc)
  const refl = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  refl.addColorStop(0, 'rgba(255,255,255,0.0)');
  refl.addColorStop(0.45, 'rgba(255,255,255,0.06)');
  refl.addColorStop(0.55, 'rgba(255,255,255,0.0)');
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = refl;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawKaleidoscope(ctx, freqData, w, h, image, kaleidoRotRef, accent, beat) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(0, 0, w, h);

  if (!image) {
    // No image — fall back to a colored radial pulse
    let bassE = 0;
    for (let i = 0; i < 8; i++) bassE += freqData[i];
    bassE /= (8 * 255);
    const grd = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) / 2);
    grd.addColorStop(0, `rgba(${accent.r},${accent.g},${accent.b},${0.5 + bassE * 0.5})`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    return;
  }

  const cx = w / 2, cy = h / 2;
  let bassE = 0;
  for (let i = 0; i < 16; i++) bassE += freqData[i];
  bassE /= (16 * 255);

  kaleidoRotRef.current += 0.004 + bassE * 0.02 + beat * 0.05;

  const slices = 8;
  const sliceAngle = (Math.PI * 2) / slices;
  const imgSize = Math.min(w, h) * (0.8 + bassE * 0.2);

  for (let i = 0; i < slices; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(kaleidoRotRef.current + i * sliceAngle);
    if (i % 2 === 1) ctx.scale(-1, 1); // mirror alternate slices

    // Clip to wedge
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, Math.max(w, h), 0, sliceAngle);
    ctx.closePath();
    ctx.clip();

    // Draw a shifted slice of the image
    ctx.drawImage(image, -imgSize * 0.3, -imgSize * 0.3, imgSize, imgSize);
    ctx.restore();
  }

  // Vignette
  const vg = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.3, cx, cy, Math.max(w, h) * 0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.7)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

function drawLandscape(ctx, freqData, w, h, buf, accent) {
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0, 0, w, h);

  const bands = 48;
  const slice = logBands(freqData, bands);
  buf.push(slice);
  const maxRows = 40;
  if (buf.length > maxRows) buf.shift();

  // Draw "mountain ranges" from back (older) to front (newest)
  for (let row = 0; row < buf.length; row++) {
    const data = buf[row];
    const z = row / buf.length; // 0=oldest, 1=newest
    const scale = 0.4 + z * 0.6;
    const yBase = h * (0.35 + (1 - z) * 0.35);
    const xPad = w * (0.05 + (1 - z) * 0.15);
    const usableW = w - xPad * 2;

    ctx.beginPath();
    ctx.moveTo(xPad, yBase);
    for (let i = 0; i < bands; i++) {
      const v = data[i] / 255;
      const x = xPad + (i / (bands - 1)) * usableW;
      const y = yBase - Math.pow(v, 1.3) * h * 0.3 * scale;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(xPad + usableW, yBase);
    ctx.closePath();

    const a = 0.15 + z * 0.5;
    ctx.fillStyle = `rgba(${accent.r},${accent.g},${accent.b},${a})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${accent.r + 40},${accent.g + 40},${accent.b + 40},${a + 0.2})`;
    ctx.lineWidth = 1 + z;
    ctx.stroke();
  }
}

function drawOscilloscope(ctx, waveData, w, h) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = 'rgba(0,255,80,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const x = (i / 10) * w;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    const y = (i / 10) * h;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  // Center lines
  ctx.strokeStyle = 'rgba(0,255,80,0.2)';
  ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();

  // Trace with phosphor glow
  ctx.strokeStyle = '#00ff66';
  ctx.shadowColor = '#00ff66';
  ctx.shadowBlur = 12;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const slice = w / waveData.length;
  for (let i = 0; i < waveData.length; i++) {
    const v = (waveData[i] - 128) / 128;
    const y = h / 2 + v * h * 0.4;
    if (i === 0) ctx.moveTo(0, y);
    else ctx.lineTo(i * slice, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}
