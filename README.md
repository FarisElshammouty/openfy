<div align="center">

<img src="assets/icon.png" alt="Openfy" width="120" height="120">

# Openfy

### Free, open-source music streaming for desktop

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)](https://electronjs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Release](https://img.shields.io/github/v/release/FarisElshammouty/openfy?color=green)](https://github.com/FarisElshammouty/openfy/releases/latest)

**Search anything. Play instantly. No ads, no accounts, no limits.**

Openfy is a Spotify-inspired desktop music player that streams audio for free using open APIs. Built with Electron, React, and Express.

<br>

<img src="assets/openfy-lyrics.png" alt="Openfy - Liked Songs with synced lyrics" width="820">

<sub>Liked Songs playlist with real-time synced lyrics and dynamic theme</sub>

---

</div>

## Download

Grab the latest portable Windows exe from the [Releases](https://github.com/FarisElshammouty/openfy/releases/latest) page. No install required.

## Features

### Playback
- Instant search across millions of tracks (Piped + InnerTube, automatic failover)
- Gapless queue with Play Next / Add to Queue
- Crossfade between tracks (configurable duration)
- Shuffle, repeat (one/all), playback speed control
- Sleep timer (by minutes or end-of-track)
- Audio output device picker
- Keyboard shortcuts (Space, arrows, M for mute, F for fullscreen NowPlaying)
- Media Session API integration works with Windows/macOS hardware media keys, lock screen, and taskbar thumbnail controls

### Library
- Create and manage playlists, drag-to-reorder tracks
- Like/unlike with one click
- Save albums and follow artists
- **Smart playlists** with auto-updating rules (most played, recently added, never played, by artist/genre, etc.)
- **Import** from Spotify, YouTube Music, Anghami, or paste any track list by dropping the URL
- All data stored locally in SQLite. No account, no cloud, no tracking

### Lyrics
- Real-time synced lyrics with click-to-seek
- Sourced from LRCLIB, with NetEase and YouTube Music fallbacks so lyrics keep working if one provider is down
- **Live translation** of lyrics on the fly via MyMemory API

### Now Playing & Visuals
- Dynamic gradient that adapts to album art color in real time
- Fullscreen Now Playing view with blurred art backdrop
- **10 audio visualizer modes**: frequency bars, particles, waveform, radial, beat-reactive, and more
- Mini-player mode (always-on-top, draggable)

### Stats & Discovery
- Listening stats: top artists, top tracks, listening hours, listening streaks
- "Made for you" mixes generated from your library
- History tab with everything you've played
- Customizable home page (reorder or hide sections)

### Desktop Integration
- System tray with media controls (play/pause, next, previous, show, quit)
- Minimize to tray instead of closing
- Discord Rich Presence shows what you're listening to with album art
- Custom `openfy://` protocol for deep linking
- Light & dark themes with custom accent colors
- Compact / cozy density modes

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Tailwind CSS, Vite, React Router |
| Audio Engine | Web Audio API (AudioContext, AnalyserNode, MediaStreamDestination) |
| Backend | Express, better-sqlite3, youtubei.js |
| Desktop | Electron 33, electron-builder |
| Audio Sources | Piped instances (auto-failover), InnerTube (iOS client), HLS fallback |
| Lyrics | LRCLIB, MyMemory (translation) |
| Imports | Spotify (`__NEXT_DATA__`), YouTube Music, Anghami (OG scraping) |
| Social | Discord RPC (@xhayper/discord-rpc) |
| Persistence | SQLite: playlists, liked, history, saved albums, smart playlists, recent searches |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- npm

### Install & Run

```bash
# Clone
git clone https://github.com/FarisElshammouty/openfy.git
cd openfy

# Install dependencies (root + client)
npm run install:all

# Start dev (server + Vite together)
npm run dev
```

The Vite dev server proxies `/api` to the Express server on port 3001.

### Build Desktop App

```bash
# Generate the app icon once (only needed if assets/icon.png is missing)
node scripts/make-icon.js

# Build portable Windows exe
npm run electron:portable

# Build Windows NSIS installer
npm run electron:build
```

Output goes to `dist-electron/`.

> If you see a `NODE_MODULE_VERSION` mismatch from `better-sqlite3`, run `npx electron-rebuild -f -w better-sqlite3` before building the exe, or `npm rebuild better-sqlite3` to use it in dev again.

## Project Structure

```
openfy/
├── client/                # React frontend (Vite)
│   └── src/
│       ├── components/    # UI: Player, Search, Library, NowPlaying, Visualizer, Stats, Settings, Welcome, …
│       ├── context/       # PlayerContext (audio engine, queue, crossfade, themes, settings)
│       └── api.js         # Thin fetch client
├── server/                # Express backend
│   ├── index.js           # Routes, Piped/InnerTube streaming proxy, import scrapers
│   ├── db.js              # SQLite (playlists, liked, history, smart playlists, …)
│   └── discord.js         # Discord RPC
├── electron/              # Electron main + preload (tray, mini-player, deep links)
├── scripts/
│   └── make-icon.js       # One-off icon generator (Jimp)
└── assets/                # icon.png + screenshots
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | `3001` | Backend server port (auto-falls-back if occupied) |
| `PIPED_API` | `https://api.piped.private.coffee,…` | Comma-separated Piped instance URLs |
| `DB_PATH` | `./openfy.db` (Electron: `userData/openfy.db`) | SQLite path |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / pause |
| `→ / ←` | Seek 5s forward / back |
| `Ctrl/Cmd + →` | Next track |
| `Ctrl/Cmd + ←` | Previous track |
| `↑ / ↓` | Volume up / down |
| `M` | Mute |
| `L` | Toggle lyrics panel |
| `Q` | Toggle queue panel |
| `F` | Fullscreen Now Playing |

## Roadmap

- [ ] macOS + Linux builds
- [ ] Last.fm scrobbling
- [ ] Equalizer presets
- [ ] Plugin system

## License

MIT. See [LICENSE](LICENSE).

## Acknowledgments

Built on [Piped](https://github.com/TeamPiped/Piped), [youtubei.js](https://github.com/LuanRT/YouTube.js), [LRCLIB](https://lrclib.net), and the open web.
