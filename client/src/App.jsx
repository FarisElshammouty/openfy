import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import Sidebar from './components/Sidebar';
import Player from './components/Player';
import Home from './components/Home';
import Search from './components/Search';
import Library from './components/Library';
import PlaylistView from './components/PlaylistView';
import ArtistView from './components/ArtistView';
import AutoPlay from './components/AutoPlay';
import QueuePanel from './components/QueuePanel';
import Lyrics from './components/Lyrics';
import NowPlaying from './components/NowPlaying';

function MainLayout() {
  const { dominantColor, showQueue, showLyrics, showNowPlaying } = usePlayer();

  const gradientStyle = dominantColor ? {
    background: `linear-gradient(to bottom, rgba(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b}, 0.35) 0%, rgb(23, 23, 23) 350px)`
  } : undefined;

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden select-none">
      <div className="flex flex-1 overflow-hidden p-2 gap-2">
        <Sidebar />
        <main className="flex-1 overflow-y-auto rounded-lg transition-colors duration-700 bg-neutral-900"
          style={gradientStyle}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/library" element={<Library />} />
            <Route path="/playlist/:id" element={<PlaylistView />} />
            <Route path="/artist/:id" element={<ArtistView />} />
            <Route path="/play/:videoId" element={<AutoPlay />} />
          </Routes>
        </main>
        {showQueue && <QueuePanel />}
        {showLyrics && <Lyrics />}
      </div>
      <Player />
      {showNowPlaying && <NowPlaying />}
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
