import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../api';

const Ctx = createContext(null);

export function usePlayer() {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePlayer must be inside PlayerProvider');
  return c;
}

function extractDominantColor(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    // Route through our server proxy so the canvas isn't tainted by the YouTube CDN
    const proxied = url && /^https?:\/\//.test(url) && !url.startsWith(location.origin)
      ? `/api/img-proxy?url=${encodeURIComponent(url)}`
      : url;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 8;
        canvas.height = 8;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 8, 8);
        const data = ctx.getImageData(0, 0, 8, 8).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const bright = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (bright > 30 && bright < 220) {
            r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
          }
        }
        if (count > 0) resolve({ r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) });
        else resolve({ r: 40, g: 40, b: 40 });
      } catch { resolve({ r: 40, g: 40, b: 40 }); }
    };
    img.onerror = () => resolve({ r: 40, g: 40, b: 40 });
    img.src = proxied;
  });
}

export function PlayerProvider({ children }) {
  const audioRef = useRef(new Audio());
  const fadeOutRef = useRef(null);
  const prevVideoRef = useRef(null);
  const crossfadeStartedRef = useRef(false);

  const loadPref = (key, fallback) => {
    try { const v = localStorage.getItem(key); return v != null ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  };
  const savePref = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

  const lastTrack = loadPref('openfy.lastTrack', null);
  const [theme, setTheme] = useState(loadPref('openfy.theme', 'dark'));
  const [accent, setAccent] = useState(loadPref('openfy.accent', 'green'));
  const [density, setDensity] = useState(loadPref('openfy.density', 'cozy'));
  const [homeLayout, setHomeLayout] = useState(loadPref('openfy.homeLayout', {
    sections: ['recent', 'mixes', 'genres', 'trending'],
    hidden: []
  }));
  const [crossfadeDuration, setCrossfadeDuration] = useState(loadPref('openfy.crossfadeDuration', 3));
  const [audioOutputDeviceId, setAudioOutputDeviceId] = useState(loadPref('openfy.audioOutput', 'default'));
  const [lyricsTranslate, setLyricsTranslate] = useState(loadPref('openfy.lyricsTranslate', null)); // null or target lang code
  const [showSettings, setShowSettings] = useState(false);
  const [showVisualizer, setShowVisualizer] = useState(false);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const streamDestRef = useRef(null);
  const [queue, setQueue] = useState(lastTrack ? [lastTrack] : []);
  const [queueIndex, setQueueIndex] = useState(lastTrack ? 0 : -1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVol] = useState(loadPref('openfy.volume', 0.7));
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(lastTrack?.duration || 0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('off');
  const [crossfade, setCrossfade] = useState(loadPref('openfy.crossfade', false));
  const initialLoadRef = useRef(!!lastTrack); // suppress autoplay on initial restore
  const [likedIds, setLikedIds] = useState(new Set());
  const [playlists, setPlaylists] = useState([]);
  const [dominantColor, setDominantColor] = useState(null);
  const [showQueue, setShowQueue] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const [showKaraoke, setShowKaraoke] = useState(false);
  const [miniPlayer, setMiniPlayer] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [sleepTimer, setSleepTimer] = useState(null); // { endTime, mode: 'time' | 'end-of-track' }
  const sleepTimerRef = useRef(null);
  const lyricsCacheRef = useRef(new Map()); // videoId -> { synced, plain, notFound }
  const listenedSecondsRef = useRef(0);
  const lastTimeRef = useRef(0);
  const recordedRef = useRef(false); // recorded play to history (>=30s threshold)
  const stuckTimerRef = useRef(null);
  const stuckCheckRef = useRef({ lastProgress: 0, stuckSince: 0 });

  const sr = useRef({ queue: [], shuffle: false, repeat: 'off' });
  sr.current = { queue, shuffle, repeat };
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const crossfadeRef = useRef(crossfade);
  crossfadeRef.current = crossfade;

  const currentTrack = queueIndex >= 0 && queueIndex < queue.length ? queue[queueIndex] : null;
  const CROSSFADE_MS = crossfadeDuration * 1000;

  useEffect(() => {
    api.getLiked().then(t => setLikedIds(new Set(t.map(x => x.videoId)))).catch(() => {});
    api.getPlaylists().then(setPlaylists).catch(() => {});
  }, []);

  // Audio event listeners
  useEffect(() => {
    const a = audioRef.current;
    a.volume = volume;
    const onTime = () => setProgress(a.currentTime);
    const onDur = () => {
      const d = a.duration;
      setDuration(Number.isFinite(d) && d > 0 ? d : 0);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('durationchange', onDur);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    return () => { a.removeEventListener('timeupdate', onTime); a.removeEventListener('durationchange', onDur); a.removeEventListener('play', onPlay); a.removeEventListener('pause', onPause); };
  }, []);

  // Track ended handler
  useEffect(() => {
    const a = audioRef.current;
    const onEnd = () => {
      if (crossfadeStartedRef.current) { crossfadeStartedRef.current = false; return; }
      // Sleep timer end-of-track mode
      if (sleepTimer?.mode === 'end-of-track') {
        setSleepTimer(null);
        return;
      }
      const { queue: q, shuffle: s, repeat: r } = sr.current;
      if (r === 'one') { a.currentTime = 0; a.play(); return; }
      if (s && q.length > 1) {
        setQueueIndex(p => { let n; do { n = Math.floor(Math.random() * q.length); } while (n === p); return n; });
        return;
      }
      setQueueIndex(p => { const n = p + 1; return n >= q.length ? (r === 'all' ? 0 : p) : n; });
    };
    a.addEventListener('ended', onEnd);
    return () => a.removeEventListener('ended', onEnd);
  }, [sleepTimer]);

  // Crossfade pre-trigger - start next track early
  useEffect(() => {
    if (!crossfade || !isPlaying || !duration || duration < 15) return;
    const threshold = duration - CROSSFADE_MS / 1000;
    const check = () => {
      const a = audioRef.current;
      if (a.currentTime >= threshold && !crossfadeStartedRef.current) {
        crossfadeStartedRef.current = true;
        const { queue: q, shuffle: s, repeat: r } = sr.current;
        if (r === 'one') return;
        if (s && q.length > 1) {
          setQueueIndex(p => { let n; do { n = Math.floor(Math.random() * q.length); } while (n === p); return n; });
        } else {
          setQueueIndex(p => { const n = p + 1; return n >= q.length ? (r === 'all' ? 0 : p) : n; });
        }
      }
    };
    const id = setInterval(check, 200);
    return () => clearInterval(id);
  }, [crossfade, isPlaying, duration]);

  // Track change - load + crossfade
  useEffect(() => {
    if (!currentTrack) return;
    const a = audioRef.current;
    const prev = prevVideoRef.current;
    prevVideoRef.current = currentTrack.videoId;
    crossfadeStartedRef.current = false;
    listenedSecondsRef.current = 0;
    lastTimeRef.current = 0;
    recordedRef.current = false;
    stuckCheckRef.current = { lastProgress: 0, stuckSince: 0 };

    // Pre-seed duration from track metadata so the progress bar isn't 0:00 while streaming
    if (currentTrack.duration > 0) setDuration(currentTrack.duration);
    setProgress(0);
    a.playbackRate = playbackRate;

    if (fadeOutRef.current) {
      clearInterval(fadeOutRef.current.timer);
      fadeOutRef.current.audio.pause();
      try { fadeOutRef.current.audio.removeAttribute('src'); fadeOutRef.current.audio.load(); } catch {}
      fadeOutRef.current = null;
    }

    const newSrc = api.streamUrl(currentTrack.videoId);
    // Capture the OLD audio src for the fade-out clone (before we reassign `a.src`)
    const oldSrc = a.src;
    const shouldCrossfade = crossfadeRef.current && prev && prev !== currentTrack.videoId && !a.paused && oldSrc;

    if (shouldCrossfade) {
      const fadeAudio = new Audio();
      fadeAudio.src = oldSrc;
      const fadeStartVol = a.volume;
      fadeAudio.currentTime = a.currentTime;
      fadeAudio.volume = fadeStartVol;
      fadeAudio.play().catch(() => {});

      a.src = newSrc;
      a.volume = 0;
      a.play().catch(() => {});

      const steps = 30;
      const stepTime = CROSSFADE_MS / steps;
      let step = 0;
      const timer = setInterval(() => {
        step++;
        const pct = step / steps;
        fadeAudio.volume = Math.max(0, fadeStartVol * (1 - pct));
        a.volume = volumeRef.current * Math.min(1, pct);
        if (step >= steps) {
          clearInterval(timer);
          fadeAudio.pause();
          try { fadeAudio.removeAttribute('src'); fadeAudio.load(); } catch {}
          fadeOutRef.current = null;
        }
      }, stepTime);
      fadeOutRef.current = { audio: fadeAudio, timer };
    } else {
      a.src = newSrc;
      if (!initialLoadRef.current) {
        a.play().catch(() => {});
      }
      initialLoadRef.current = false;
    }

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title, artist: currentTrack.artist,
        artwork: currentTrack.thumbnail ? [{ src: currentTrack.thumbnail, sizes: '512x512', type: 'image/jpeg' }] : []
      });
    }
  }, [currentTrack?.videoId]);

  // Track listened seconds + record play after 30s threshold
  useEffect(() => {
    if (!currentTrack) return;
    const a = audioRef.current;
    const tick = () => {
      if (!a.paused) {
        const now = a.currentTime;
        const last = lastTimeRef.current;
        // Only count forward progress (ignore seeks); cap delta at 1.5s to avoid jumps
        if (now > last && now - last < 1.5) {
          listenedSecondsRef.current += (now - last);
        }
        lastTimeRef.current = now;
      }
      // Record after 30s of actual listening
      if (!recordedRef.current && listenedSecondsRef.current >= 30) {
        recordedRef.current = true;
        api.recordPlay({
          videoId: currentTrack.videoId,
          title: currentTrack.title,
          artist: currentTrack.artist,
          artistId: currentTrack.artistId,
          thumbnail: currentTrack.thumbnail,
          duration: a.duration || currentTrack.duration || 0,
          listenedSeconds: 30
        });
      }
    };
    const id = setInterval(tick, 1000);
    return () => {
      clearInterval(id);
      // On unmount/track change, send any extra listened seconds beyond 30
      if (recordedRef.current && listenedSecondsRef.current > 30) {
        api.recordPlay({
          videoId: currentTrack.videoId,
          title: currentTrack.title,
          artist: currentTrack.artist,
          artistId: currentTrack.artistId,
          thumbnail: currentTrack.thumbnail,
          duration: a.duration || currentTrack.duration || 0,
          listenedSeconds: listenedSecondsRef.current,
          incremental: true
        });
      }
    };
  }, [currentTrack?.videoId]);

  // Auto-skip if stream stalls (progress doesn't advance for 20s while supposedly playing)
  useEffect(() => {
    if (!currentTrack) return;
    const a = audioRef.current;
    if (stuckTimerRef.current) clearInterval(stuckTimerRef.current);
    stuckTimerRef.current = setInterval(() => {
      if (a.paused) { stuckCheckRef.current.stuckSince = 0; return; }
      const now = Date.now();
      if (a.currentTime === stuckCheckRef.current.lastProgress) {
        if (!stuckCheckRef.current.stuckSince) stuckCheckRef.current.stuckSince = now;
        if (now - stuckCheckRef.current.stuckSince > 20000) {
          // 20s stuck — give up and skip
          console.warn('[Openfy] stream stuck, skipping');
          playNext();
          stuckCheckRef.current.stuckSince = 0;
        }
      } else {
        stuckCheckRef.current.lastProgress = a.currentTime;
        stuckCheckRef.current.stuckSince = 0;
      }
    }, 2000);
    return () => clearInterval(stuckTimerRef.current);
  }, [currentTrack?.videoId]);

  useEffect(() => { audioRef.current.volume = volume; savePref('openfy.volume', volume); }, [volume]);
  useEffect(() => { savePref('openfy.crossfade', crossfade); }, [crossfade]);
  useEffect(() => { savePref('openfy.lastTrack', currentTrack || null); }, [currentTrack]);
  useEffect(() => {
    savePref('openfy.theme', theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    savePref('openfy.accent', accent);
    document.documentElement.dataset.accent = accent;
  }, [accent]);
  useEffect(() => {
    savePref('openfy.density', density);
    document.documentElement.dataset.density = density;
  }, [density]);
  useEffect(() => { savePref('openfy.homeLayout', homeLayout); }, [homeLayout]);
  useEffect(() => { savePref('openfy.crossfadeDuration', crossfadeDuration); }, [crossfadeDuration]);
  useEffect(() => { savePref('openfy.lyricsTranslate', lyricsTranslate); }, [lyricsTranslate]);

  // Apply audio output device
  useEffect(() => {
    savePref('openfy.audioOutput', audioOutputDeviceId);
    if (audioRef.current.setSinkId && audioOutputDeviceId) {
      audioRef.current.setSinkId(audioOutputDeviceId).catch(() => {});
    }
  }, [audioOutputDeviceId]);

  // Media Session handlers + position state
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', () => audioRef.current.play());
    navigator.mediaSession.setActionHandler('pause', () => audioRef.current.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => playPrev());
    navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) { audioRef.current.currentTime = details.seekTime; setProgress(details.seekTime); }
    });
  }, []);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !duration) return;
    try {
      navigator.mediaSession.setPositionState({ duration, playbackRate: 1, position: Math.min(progress, duration) });
    } catch {}
  }, [progress, duration]);

  // Dominant color extraction
  useEffect(() => {
    if (currentTrack?.thumbnail) {
      extractDominantColor(currentTrack.thumbnail).then(setDominantColor);
    } else {
      setDominantColor(null);
    }
  }, [currentTrack?.thumbnail]);

  // Discord presence
  useEffect(() => {
    const sendPresence = () => {
      const a = audioRef.current;
      if (currentTrack && isPlaying) {
        api.updateDiscordPresence({
          title: currentTrack.title, artist: currentTrack.artist,
          thumbnail: currentTrack.thumbnail, videoId: currentTrack.videoId,
          duration: a?.duration || currentTrack.duration || 0,
          elapsed: a?.currentTime || 0, playing: true
        });
      } else {
        api.updateDiscordPresence({ playing: false });
      }
    };
    sendPresence();
    const a = audioRef.current;
    if (a) { a.addEventListener('seeked', sendPresence); return () => a.removeEventListener('seeked', sendPresence); }
  }, [currentTrack, isPlaying]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const a = audioRef.current;
      if (e.code === 'Space' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        a.paused ? a.play().catch(() => {}) : a.pause();
      } else if (e.code === 'ArrowRight' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        playNext();
      } else if (e.code === 'ArrowLeft' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        playPrev();
      } else if (e.code === 'ArrowRight' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        a.currentTime = Math.min((a.duration || 0), a.currentTime + 5);
      } else if (e.code === 'ArrowLeft' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        a.currentTime = Math.max(0, a.currentTime - 5);
      } else if (e.code === 'ArrowUp' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setVolume(v => Math.min(1, v + 0.05));
      } else if (e.code === 'ArrowDown' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setVolume(v => Math.max(0, v - 0.05));
      } else if (e.code === 'KeyQ' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleQueue();
      } else if (e.code === 'KeyL' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleLyrics();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Electron IPC
  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.onMediaControl((action) => {
      switch (action) {
        case 'play-pause': audioRef.current.paused ? audioRef.current.play().catch(() => {}) : audioRef.current.pause(); break;
        case 'next': playNext(); break;
        case 'prev': playPrev(); break;
      }
    });
  }, []);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.sendTrackInfo(currentTrack
        ? { title: currentTrack.title, artist: currentTrack.artist, playing: isPlaying }
        : { title: null, artist: null, playing: false });
    }
  }, [currentTrack, isPlaying]);

  const togglePlay = useCallback(() => { audioRef.current.paused ? audioRef.current.play().catch(() => {}) : audioRef.current.pause(); }, []);

  const playTrack = useCallback((track, list) => {
    const l = list || [track];
    const i = l.findIndex(t => t.videoId === track.videoId);
    setQueue(l);
    setQueueIndex(i >= 0 ? i : 0);
  }, []);

  const playNext = useCallback(() => {
    const { queue: q, shuffle: s, repeat: r } = sr.current;
    if (!q.length) return;
    if (s) { setQueueIndex(p => { let n; do { n = Math.floor(Math.random() * q.length); } while (n === p && q.length > 1); return n; }); }
    else { setQueueIndex(p => { const n = p + 1; return n >= q.length ? (r === 'all' ? 0 : p) : n; }); }
  }, []);

  const playPrev = useCallback(() => {
    if (audioRef.current.currentTime > 3) { audioRef.current.currentTime = 0; return; }
    const { queue: q, repeat: r } = sr.current;
    setQueueIndex(p => { const n = p - 1; return n < 0 ? (r === 'all' ? q.length - 1 : 0) : n; });
  }, []);

  const seek = useCallback(t => { audioRef.current.currentTime = t; setProgress(t); }, []);
  const setVolume = useCallback(v => setVol(v), []);

  // Queue operations
  const addToQueue = useCallback(track => setQueue(p => [...p, track]), []);
  const insertNext = useCallback(track => {
    setQueue(q => {
      const newQ = [...q];
      const insertAt = (queueIndex >= 0 ? queueIndex : -1) + 1;
      newQ.splice(insertAt, 0, track);
      return newQ;
    });
  }, [queueIndex]);

  const removeFromQueue = useCallback((idx) => {
    setQueue(q => { const n = [...q]; n.splice(idx, 1); return n; });
    setQueueIndex(p => idx < p ? p - 1 : p);
  }, []);

  const moveInQueue = useCallback((from, to) => {
    setQueue(q => {
      const n = [...q]; const [item] = n.splice(from, 1); n.splice(to, 0, item); return n;
    });
    setQueueIndex(p => {
      if (from === p) return to;
      if (from < p && to >= p) return p - 1;
      if (from > p && to <= p) return p + 1;
      return p;
    });
  }, []);

  const clearQueue = useCallback(() => {
    const a = audioRef.current;
    a.pause();
    try { a.removeAttribute('src'); a.load(); } catch {}
    setQueue([]); setQueueIndex(-1); setProgress(0); setDuration(0);
  }, []);
  const toggleShuffle = useCallback(() => setShuffle(p => !p), []);
  const toggleRepeat = useCallback(() => setRepeat(p => p === 'off' ? 'all' : p === 'all' ? 'one' : 'off'), []);
  const toggleCrossfade = useCallback(() => setCrossfade(p => !p), []);
  const toggleQueue = useCallback(() => { setShowQueue(p => !p); if (!showQueue) setShowLyrics(false); }, [showQueue]);
  const toggleLyrics = useCallback(() => {
    setShowLyrics(p => !p);
    if (!showLyrics) { setShowQueue(false); setShowNowPlaying(false); setShowKaraoke(false); }
  }, [showLyrics]);
  const toggleNowPlaying = useCallback(() => {
    setShowNowPlaying(p => !p);
    if (!showNowPlaying) { setShowLyrics(false); setShowKaraoke(false); }
  }, [showNowPlaying]);
  const toggleKaraoke = useCallback(() => {
    setShowKaraoke(p => !p);
    if (!showKaraoke) { setShowLyrics(false); setShowNowPlaying(false); }
  }, [showKaraoke]);

  const toggleSettings = useCallback(() => setShowSettings(p => !p), []);

  // Web Audio analyser — initialised lazily on first request. The audio element can
  // only have ONE MediaElementSource, so we create it once and reuse.
  const getAnalyser = useCallback(() => {
    if (analyserRef.current) {
      // Resume context if it got suspended by browser policy
      audioCtxRef.current?.resume?.().catch(() => {});
      return analyserRef.current;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaElementSource(audioRef.current);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
      ctx.resume().catch(() => {});
      return analyser;
    } catch (e) {
      console.warn('[Openfy] Could not init Web Audio analyser:', e.message);
      return null;
    }
  }, []);

  // Get a MediaStream from the analyser node (for recording the visualizer with audio)
  const getAnalyserStream = useCallback(() => {
    const analyser = getAnalyser();
    if (!analyser || !audioCtxRef.current) return null;
    if (!streamDestRef.current) {
      streamDestRef.current = audioCtxRef.current.createMediaStreamDestination();
      analyser.connect(streamDestRef.current);
    }
    return streamDestRef.current.stream;
  }, [getAnalyser]);

  const toggleVisualizer = useCallback(() => {
    setShowVisualizer(p => {
      const next = !p;
      if (next) {
        getAnalyser();
        // If audio was playing, re-prime the routing graph synchronously so
        // analyser data flows on first open (Chromium quirk).
        const audio = audioRef.current;
        if (!audio.paused) {
          audio.pause();
          audio.play().catch(() => {});
        }
        setShowNowPlaying(false);
        setShowKaraoke(false);
      }
      return next;
    });
  }, [getAnalyser]);

  const toggleMiniPlayer = useCallback(() => {
    setMiniPlayer(p => {
      const next = !p;
      if (window.electronAPI) {
        next ? window.electronAPI.enterMiniPlayer() : window.electronAPI.exitMiniPlayer();
      }
      return next;
    });
  }, []);

  const setPlaybackRate = useCallback((r) => {
    audioRef.current.playbackRate = r;
    setPlaybackRateState(r);
  }, []);

  const startSleepTimer = useCallback((minutes, mode = 'time') => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    if (minutes === null) {
      setSleepTimer(null);
      sleepTimerRef.current = null;
      return;
    }
    if (mode === 'end-of-track') {
      setSleepTimer({ endTime: null, mode: 'end-of-track', preset: null });
    } else {
      const endTime = Date.now() + minutes * 60000;
      setSleepTimer({ endTime, mode: 'time', preset: minutes });
      sleepTimerRef.current = setTimeout(() => {
        audioRef.current.pause();
        setSleepTimer(null);
        sleepTimerRef.current = null;
      }, minutes * 60000);
    }
  }, []);

  const isLiked = useCallback(vid => likedIds.has(vid), [likedIds]);
  const toggleLike = useCallback(async (track) => {
    if (likedIds.has(track.videoId)) {
      await api.unlikeSong(track.videoId);
      setLikedIds(p => { const n = new Set(p); n.delete(track.videoId); return n; });
    } else {
      await api.likeSong(track);
      setLikedIds(p => new Set(p).add(track.videoId));
    }
  }, [likedIds]);

  const refreshPlaylists = useCallback(async () => { setPlaylists(await api.getPlaylists()); }, []);

  // Shared lyrics cache so Lyrics/NowPlaying/Karaoke don't all re-fetch
  const getLyricsCached = useCallback(async (track) => {
    if (!track) return { syncedLyrics: null, plainLyrics: null };
    const cache = lyricsCacheRef.current;
    const cacheKey = `${track.videoId}:${lyricsTranslate || 'orig'}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const baseKey = `${track.videoId}:orig`;
    let data;
    if (cache.has(baseKey)) {
      data = cache.get(baseKey);
    } else {
      data = await api.getLyrics(track.title, track.artist);
      cache.set(baseKey, data);
    }

    if (!lyricsTranslate || (!data.syncedLyrics && !data.plainLyrics)) {
      return data;
    }

    // Translate the lyric LINES, preserving timestamps for synced
    try {
      let translatedSynced = data.syncedLyrics;
      let translatedPlain = data.plainLyrics;

      if (data.syncedLyrics) {
        const lines = data.syncedLyrics.split('\n');
        const textLines = lines.map(l => {
          const m = l.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/);
          return m ? m[4] : '';
        });
        const joined = textLines.join('\n');
        const { translated } = await api.translate(joined, lyricsTranslate);
        const translatedLines = translated.split('\n');
        translatedSynced = lines.map((l, i) => {
          const m = l.match(/(\[\d{2}:\d{2}\.\d{2,3}\])\s*(.*)/);
          if (m && translatedLines[i] != null) return `${m[1]} ${translatedLines[i]}`;
          return l;
        }).join('\n');
      } else if (data.plainLyrics) {
        const { translated } = await api.translate(data.plainLyrics, lyricsTranslate);
        translatedPlain = translated;
      }

      const result = { syncedLyrics: translatedSynced, plainLyrics: translatedPlain };
      cache.set(cacheKey, result);
      return result;
    } catch {
      return data;
    }
  }, [lyricsTranslate]);

  return (
    <Ctx.Provider value={{
      currentTrack, queue, queueIndex, isPlaying, volume, progress, duration, shuffle, repeat,
      crossfade, dominantColor, showQueue, showLyrics, showNowPlaying, showKaraoke, miniPlayer,
      playbackRate, sleepTimer,
      // Settings
      theme, setTheme, accent, setAccent, density, setDensity,
      homeLayout, setHomeLayout, crossfadeDuration, setCrossfadeDuration,
      audioOutputDeviceId, setAudioOutputDeviceId, lyricsTranslate, setLyricsTranslate,
      showSettings, toggleSettings,
      showVisualizer, toggleVisualizer, getAnalyser, getAnalyserStream,
      togglePlay, playTrack, playNext, playPrev, seek, setVolume,
      addToQueue, insertNext, removeFromQueue, moveInQueue, clearQueue,
      toggleShuffle, toggleRepeat, toggleCrossfade, toggleQueue, toggleLyrics, toggleNowPlaying, toggleKaraoke, toggleMiniPlayer,
      setPlaybackRate, startSleepTimer,
      isLiked, toggleLike, playlists, refreshPlaylists, getLyricsCached
    }}>
      {children}
    </Ctx.Provider>
  );
}
