import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';

const ACCENTS = [
  { key: 'green', color: '#1DB954', label: 'Spotify Green' },
  { key: 'blue', color: '#3B82F6', label: 'Blue' },
  { key: 'purple', color: '#A855F7', label: 'Purple' },
  { key: 'red', color: '#EF4444', label: 'Red' },
  { key: 'orange', color: '#F97316', label: 'Orange' },
  { key: 'pink', color: '#EC4899', label: 'Pink' }
];

const LANGUAGES = [
  { code: null, label: 'Off' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ru', label: 'Russian' }
];

const HOME_SECTIONS = {
  recent: 'Recently played',
  mixes: 'Made for you',
  genres: 'Browse by genre',
  trending: 'Trending now'
};

export default function Settings() {
  const {
    theme, setTheme, accent, setAccent, density, setDensity,
    homeLayout, setHomeLayout, crossfadeDuration, setCrossfadeDuration,
    crossfade, toggleCrossfade,
    audioOutputDeviceId, setAudioOutputDeviceId,
    lyricsTranslate, setLyricsTranslate,
    toggleSettings
  } = usePlayer();

  const [audioDevices, setAudioDevices] = useState([]);
  const [dragOverSection, setDragOverSection] = useState(null);
  const dragSrcRef = useRef(null);

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setAudioDevices(devices.filter(d => d.kind === 'audiooutput'));
    }).catch(() => {});

    const onKey = (e) => { if (e.key === 'Escape') toggleSettings(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleSettings]);

  const toggleSection = (key) => {
    setHomeLayout(layout => {
      const hidden = layout.hidden.includes(key)
        ? layout.hidden.filter(k => k !== key)
        : [...layout.hidden, key];
      return { ...layout, hidden };
    });
  };

  const moveSection = (from, to) => {
    setHomeLayout(layout => {
      const sections = [...layout.sections];
      const [item] = sections.splice(from, 1);
      sections.splice(to, 0, item);
      return { ...layout, sections };
    });
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur flex items-center justify-center p-6"
      onClick={toggleSettings}>
      <div className="bg-neutral-900 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-neutral-800 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between p-5 z-10">
          <h2 className="text-2xl font-bold">Settings</h2>
          <button onClick={toggleSettings} className="p-2 rounded-full hover:bg-neutral-800">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Appearance */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">Appearance</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Theme</div>
                  <div className="text-xs text-neutral-400">Dark or light interface</div>
                </div>
                <div className="flex gap-1 bg-neutral-800 rounded-full p-1">
                  {['dark', 'light'].map(t => (
                    <button key={t} onClick={() => setTheme(t)}
                      className={`text-xs px-3 py-1 rounded-full capitalize transition-colors ${theme === t ? 'bg-white text-black font-semibold' : 'text-neutral-300'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Accent color</div>
                <div className="flex gap-2 flex-wrap">
                  {ACCENTS.map(a => (
                    <button key={a.key} onClick={() => setAccent(a.key)}
                      title={a.label}
                      className={`w-9 h-9 rounded-full transition-transform ${accent === a.key ? 'ring-2 ring-offset-2 ring-offset-neutral-900 ring-white scale-110' : 'hover:scale-105'}`}
                      style={{ background: a.color }} />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Density</div>
                  <div className="text-xs text-neutral-400">List padding and spacing</div>
                </div>
                <div className="flex gap-1 bg-neutral-800 rounded-full p-1">
                  {['compact', 'cozy', 'spacious'].map(d => (
                    <button key={d} onClick={() => setDensity(d)}
                      className={`text-xs px-3 py-1 rounded-full capitalize transition-colors ${density === d ? 'bg-white text-black font-semibold' : 'text-neutral-300'}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Home layout */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">Home layout</h3>
            <p className="text-xs text-neutral-400 mb-3">Drag to reorder, click to show/hide.</p>
            <div className="space-y-1.5">
              {homeLayout.sections.map((key, idx) => (
                <div
                  key={key}
                  draggable
                  onDragStart={() => { dragSrcRef.current = idx; }}
                  onDragOver={e => { e.preventDefault(); setDragOverSection(idx); }}
                  onDragEnd={() => { dragSrcRef.current = null; setDragOverSection(null); }}
                  onDrop={e => {
                    e.preventDefault();
                    if (dragSrcRef.current !== null && dragSrcRef.current !== idx) moveSection(dragSrcRef.current, idx);
                    dragSrcRef.current = null;
                    setDragOverSection(null);
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-md bg-neutral-800/50 ${dragOverSection === idx ? 'ring-1 ring-green-500' : ''}`}
                >
                  <div className="flex items-center gap-3 cursor-grab">
                    <svg className="w-4 h-4 text-neutral-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 15h18v-2H3v2zm0 4h18v-2H3v2zm0-8h18V9H3v2zm0-6v2h18V5H3z" />
                    </svg>
                    <span className="text-sm">{HOME_SECTIONS[key]}</span>
                  </div>
                  <button onClick={() => toggleSection(key)}
                    className={`w-10 h-6 rounded-full relative transition-colors ${homeLayout.hidden.includes(key) ? 'bg-neutral-700' : 'bg-green-500'}`}>
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${homeLayout.hidden.includes(key) ? 'translate-x-1' : 'translate-x-5'}`} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Playback */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">Playback</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Crossfade</div>
                  <div className="text-xs text-neutral-400">Smoothly blend the end of a track into the next</div>
                </div>
                <button onClick={toggleCrossfade}
                  className={`w-10 h-6 rounded-full relative transition-colors ${crossfade ? 'bg-green-500' : 'bg-neutral-700'}`}>
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${crossfade ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>

              {crossfade && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">Crossfade duration</div>
                    <span className="text-xs text-neutral-400 tabular-nums">{crossfadeDuration}s</span>
                  </div>
                  <input type="range" min={0} max={12} step={1} value={crossfadeDuration}
                    onChange={e => setCrossfadeDuration(+e.target.value)}
                    className="w-full" style={{ background: `linear-gradient(to right, #1DB954 ${(crossfadeDuration/12)*100}%, #4d4d4d ${(crossfadeDuration/12)*100}%)` }} />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Audio output</div>
                  <div className="text-xs text-neutral-400">Where audio plays from</div>
                </div>
                <select value={audioOutputDeviceId}
                  onChange={e => setAudioOutputDeviceId(e.target.value)}
                  className="bg-neutral-800 text-white text-sm rounded px-3 py-1.5 outline-none focus:ring-1 focus:ring-white/20 max-w-[260px]">
                  <option value="default">System default</option>
                  {audioDevices.filter(d => d.deviceId !== 'default').map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || 'Unknown device'}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Lyrics */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">Lyrics</h3>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Translate lyrics</div>
                <div className="text-xs text-neutral-400">Auto-translate non-English lyrics</div>
              </div>
              <select value={lyricsTranslate || ''}
                onChange={e => setLyricsTranslate(e.target.value || null)}
                className="bg-neutral-800 text-white text-sm rounded px-3 py-1.5 outline-none focus:ring-1 focus:ring-white/20">
                {LANGUAGES.map(l => (
                  <option key={l.code || 'off'} value={l.code || ''}>{l.label}</option>
                ))}
              </select>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
