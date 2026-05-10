import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import Sidebar from './components/Sidebar';
import Player from './components/Player';
import Home from './components/Home';
import Search from './components/Search';
import Library from './components/Library';
import PlaylistView from './components/PlaylistView';
import ArtistView from './components/ArtistView';
import AlbumView from './components/AlbumView';
import AutoPlay from './components/AutoPlay';
import QueuePanel from './components/QueuePanel';
import Lyrics from './components/Lyrics';
import NowPlaying from './components/NowPlaying';
import Karaoke from './components/Karaoke';
import MiniPlayer from './components/MiniPlayer';
import Stats from './components/Stats';

function NavControls() {
  const navigate = useNavigate();
  const location = useLocation();
  const canGoBack = location.pathname !== '/';
  return (
    <div className="absolute top-3 left-4 z-20 flex gap-2">
      <button onClick={() => navigate(-1)} disabled={!canGoBack}
        className={`w-8 h-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center transition-opacity ${canGoBack ? 'hover:bg-black/80 cursor-pointer' : 'opacity-40 cursor-default'}`}
        title="Back">
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z" /></svg>
      </button>
      <button onClick={() => navigate(1)}
        className="w-8 h-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center hover:bg-black/80 transition-opacity"
        title="Forward">
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" /></svg>
      </button>
    </div>
  );
}

function MainLayout() {
  const { dominantColor, showQueue, showLyrics, showNowPlaying, showKaraoke, miniPlayer } = usePlayer();

  if (miniPlayer) return <MiniPlayer />;

  const gradientStyle = dominantColor ? {
    background: `linear-gradient(to bottom, rgba(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b}, 0.35) 0%, rgb(23, 23, 23) 350px)`
  } : undefined;

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden select-none">
      <div className="flex flex-1 overflow-hidden p-2 gap-2">
        <Sidebar />
        <main className="flex-1 overflow-y-auto rounded-lg transition-colors duration-700 bg-neutral-900 relative"
          style={gradientStyle}>
          <NavControls />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/library" element={<Library />} />
            <Route path="/playlist/:id" element={<PlaylistView />} />
            <Route path="/artist/:id" element={<ArtistView />} />
            <Route path="/album/:id" element={<AlbumView />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/play/:videoId" element={<AutoPlay />} />
          </Routes>
        </main>
        {showQueue && <QueuePanel />}
        {showLyrics && <Lyrics />}
      </div>
      <Player />
      {showNowPlaying && <NowPlaying />}
      {showKaraoke && <Karaoke />}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <PlayerProvider>
        <MainLayout />
      </PlayerProvider>
    </BrowserRouter>
  );
}
