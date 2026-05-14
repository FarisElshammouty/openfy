import { useState, useEffect } from 'react';
import { api } from '../api';

const STORAGE_KEY = 'openfy.welcomeSeen.v1';

export default function Welcome() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch { return; }

    // Don't show the welcome to existing users who already have data.
    Promise.all([
      api.getPlaylists().catch(() => []),
      api.getLiked().catch(() => []),
      api.getHistory().catch(() => [])
    ]).then(([pl, liked, hist]) => {
      const hasData = (pl?.length || 0) + (liked?.length || 0) + (hist?.length || 0) > 0;
      if (hasData) {
        try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
        return;
      }
      setOpen(true);
    }).catch(() => setOpen(true));
  }, []);

  if (!open) return null;

  const close = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
    setOpen(false);
  };

  const slides = [
    {
      title: 'Welcome to Openfy',
      body: 'Free, open-source music streaming powered by YouTube. No ads, no account, no tracking. Just search, play, and build your library.',
      icon: (
        <svg className="w-12 h-12 text-green-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
      )
    },
    {
      title: 'Build your library',
      body: 'Like songs, create playlists, save albums, or import any Spotify, YouTube Music, or Anghami playlist by pasting its link in the Library tab.',
      icon: (
        <svg className="w-12 h-12 text-green-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
        </svg>
      )
    },
    {
      title: 'Make it yours',
      body: 'Synced lyrics, karaoke mode, audio visualizer, custom themes & accents, Discord rich presence, sleep timer, mini-player. All in Settings.',
      icon: (
        <svg className="w-12 h-12 text-green-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94 0 .31.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
        </svg>
      )
    }
  ];

  const slide = slides[step];
  const isLast = step === slides.length - 1;

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 force-dark"
      onClick={close}>
      <div className="bg-neutral-900 rounded-xl max-w-md w-full p-8 shadow-2xl border border-neutral-800"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500/20 to-teal-500/20 flex items-center justify-center mb-5 border border-green-500/30">
            {slide.icon}
          </div>
          <h2 className="text-2xl font-bold mb-3 text-white">{slide.title}</h2>
          <p className="text-neutral-400 text-sm leading-relaxed mb-6">{slide.body}</p>

          <div className="flex gap-2 mb-6">
            {slides.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-green-500' : 'w-1.5 bg-neutral-700'}`} />
            ))}
          </div>

          <div className="flex gap-3 w-full">
            <button onClick={close}
              className="flex-1 px-4 py-2.5 rounded-full text-neutral-400 hover:text-white text-sm font-semibold transition-colors">
              Skip
            </button>
            <button onClick={() => isLast ? close() : setStep(step + 1)}
              className="flex-1 px-4 py-2.5 rounded-full bg-green-500 hover:bg-green-400 text-black text-sm font-bold transition-colors">
              {isLast ? "Let's go" : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
