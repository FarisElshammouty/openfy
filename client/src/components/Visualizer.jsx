import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { upgradeThumbnail } from '../utils/thumb';

const MODES = [
  { key: 'bars', label: 'Bars' },
  { key: 'circular', label: 'Circular' },
  { key: 'wave', label: 'Wave' },
  { key: 'particles', label: 'Particles' }
];

export default function Visualizer() {
  const { currentTrack, isPlaying, dominantColor, togglePlay, playNext, playPrev, toggleVisualizer, getAnalyser } = usePlayer();
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const [mode, setMode] = useState('bars');
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideControlsTimer = useRef(null);
  const particlesRef = useRef([]);

  // Auto-hide controls after 3s of mouse-still
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

  // Resize canvas to viewport
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const analyser = getAnalyser();

    // No analyser? Show a placeholder pulsing circle so the screen isn't empty
    if (!analyser) {
      const draw = (t) => {
        const w = window.innerWidth, h = window.innerHeight;
        ctx.clearRect(0, 0, w, h);
        const pulse = (Math.sin(t / 600) + 1) / 2;
        const r = dominantColor || { r: 100, g: 100, b: 100 };
        const grd = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 3);
        grd.addColorStop(0, `rgba(${r.r},${r.g},${r.b},${0.4 + pulse * 0.3})`);
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

    const accent = dominantColor || { r: 29, g: 185, b: 84 };
    const accentStr = `rgb(${accent.r}, ${accent.g}, ${accent.b})`;
    const accentDim = `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.3)`;

    const draw = () => {
      const w = window.innerWidth, h = window.innerHeight;

      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(waveData);

      if (mode === 'bars') {
        // Frequency bars rising from bottom, mirrored — fades trail behind
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(0, 0, w, h);

        const useBins = Math.min(bufferLen, 96);
        const barWidth = w / useBins;
        for (let i = 0; i < useBins; i++) {
          const v = freqData[i] / 255;
          const barH = v * h * 0.6;
          const x = i * barWidth;
          const grd = ctx.createLinearGradient(0, h - barH, 0, h);
          grd.addColorStop(0, accentStr);
          grd.addColorStop(1, accentDim);
          ctx.fillStyle = grd;
          ctx.fillRect(x + 1, h - barH, barWidth - 2, barH);
        }
      } else if (mode === 'circular') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2, cy = h / 2;
        const baseR = Math.min(w, h) * 0.18;
        const bins = 64;

        // Circular bars radiating outward
        for (let i = 0; i < bins; i++) {
          const v = freqData[Math.floor(i * bufferLen / bins / 2)] / 255;
          const len = v * baseR * 1.2;
          const angle = (i / bins) * Math.PI * 2 - Math.PI / 2;
          const x1 = cx + Math.cos(angle) * baseR;
          const y1 = cy + Math.sin(angle) * baseR;
          const x2 = cx + Math.cos(angle) * (baseR + len);
          const y2 = cy + Math.sin(angle) * (baseR + len);
          ctx.strokeStyle = accentStr;
          ctx.lineWidth = (2 * Math.PI * baseR) / bins * 0.7;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }

        // Inner glow disk
        const glowGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR);
        glowGrd.addColorStop(0, `rgba(${accent.r},${accent.g},${accent.b},0.3)`);
        glowGrd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glowGrd;
        ctx.beginPath();
        ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
        ctx.fill();
      } else if (mode === 'wave') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = accentStr;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        const slice = w / waveData.length;
        for (let i = 0; i < waveData.length; i++) {
          const v = (waveData[i] - 128) / 128;
          const y = h / 2 + v * h * 0.35;
          if (i === 0) ctx.moveTo(0, y);
          else ctx.lineTo(i * slice, y);
        }
        ctx.stroke();

        // Mirror with lower opacity
        ctx.strokeStyle = `rgba(${accent.r},${accent.g},${accent.b},0.4)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < waveData.length; i++) {
          const v = (waveData[i] - 128) / 128;
          const y = h / 2 - v * h * 0.35;
          if (i === 0) ctx.moveTo(0, y);
          else ctx.lineTo(i * slice, y);
        }
        ctx.stroke();
      } else if (mode === 'particles') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.fillRect(0, 0, w, h);

        // Avg energy in low/high bands
        let lowEnergy = 0, highEnergy = 0;
        const half = bufferLen / 4;
        for (let i = 0; i < half; i++) lowEnergy += freqData[i];
        for (let i = half * 2; i < half * 3; i++) highEnergy += freqData[i];
        lowEnergy /= half * 255;
        highEnergy /= half * 255;

        // Spawn particles on beat
        if (lowEnergy > 0.45 && particlesRef.current.length < 250) {
          const count = Math.floor(lowEnergy * 8);
          for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + lowEnergy * 10;
            particlesRef.current.push({
              x: w / 2, y: h / 2,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 1,
              size: 2 + Math.random() * 4
            });
          }
        }

        // Update + draw particles
        particlesRef.current = particlesRef.current.filter(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.99;
          p.vy *= 0.99;
          p.life -= 0.012;
          if (p.life <= 0) return false;
          ctx.fillStyle = `rgba(${accent.r},${accent.g},${accent.b},${p.life})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          return true;
        });

        // Central pulsing core
        const coreR = 30 + highEnergy * 80;
        const grd = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, coreR);
        grd.addColorStop(0, `rgba(${accent.r},${accent.g},${accent.b},${0.4 + highEnergy * 0.5})`);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, coreR, 0, Math.PI * 2);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [mode, dominantColor, getAnalyser]);

  if (!currentTrack) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center text-white/40">
        <div className="text-center">
          <p className="text-lg mb-2">No track playing</p>
          <button onClick={toggleVisualizer} className="text-sm underline">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Track info overlay (auto-hides) */}
      <div className={`absolute top-6 left-6 flex items-center gap-4 transition-opacity duration-500 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
        <img src={upgradeThumbnail(currentTrack.thumbnail, 240)} referrerPolicy="no-referrer"
          alt="" className="w-16 h-16 rounded-md object-cover shadow-2xl" />
        <div className="text-white">
          <div className="text-xs uppercase tracking-wider text-white/60">Visualizer</div>
          <div className="font-bold text-lg">{currentTrack.title}</div>
          <div className="text-sm text-white/70">{currentTrack.artist}</div>
        </div>
      </div>

      {/* Close button */}
      <button onClick={toggleVisualizer} title="Exit visualizer (Esc)"
        className={`absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-opacity duration-500 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
      </button>

      {/* Mode picker + controls (bottom center) */}
      <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 transition-opacity duration-500 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex gap-1 bg-black/60 backdrop-blur rounded-full p-1">
          {MODES.map(m => (
            <button key={m.key} onClick={() => setMode(m.key)}
              className={`text-xs px-4 py-1.5 rounded-full transition-colors ${mode === m.key ? 'bg-white text-black font-semibold' : 'text-white/80 hover:text-white'}`}>
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
