import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'openfy.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS playlist_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    video_id TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT DEFAULT '',
    thumbnail TEXT DEFAULT '',
    duration REAL DEFAULT 0,
    position INTEGER NOT NULL,
    added_at TEXT DEFAULT (datetime('now')),
    UNIQUE(playlist_id, video_id)
  );

  CREATE TABLE IF NOT EXISTS liked_tracks (
    video_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT DEFAULT '',
    thumbnail TEXT DEFAULT '',
    duration REAL DEFAULT 0,
    added_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS play_history (
    video_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT DEFAULT '',
    artist_id TEXT DEFAULT '',
    thumbnail TEXT DEFAULT '',
    duration REAL DEFAULT 0,
    play_count INTEGER DEFAULT 1,
    listened_seconds REAL DEFAULT 0,
    last_played TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS artist_meta (
    artist_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    thumbnail TEXT DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS recent_searches (
    query TEXT PRIMARY KEY,
    last_searched TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS saved_albums (
    album_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT DEFAULT '',
    artist_id TEXT DEFAULT '',
    thumbnail TEXT DEFAULT '',
    year TEXT DEFAULT '',
    saved_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS smart_playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    rules_json TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_pt_playlist ON playlist_tracks(playlist_id);
  CREATE INDEX IF NOT EXISTS idx_history_played ON play_history(last_played DESC);
  CREATE INDEX IF NOT EXISTS idx_recent_searched ON recent_searches(last_searched DESC);
`);

// Migrate: add listened_seconds column if missing (for existing DBs)
try {
  const cols = db.prepare("PRAGMA table_info(play_history)").all();
  if (!cols.some(c => c.name === 'listened_seconds')) {
    db.exec(`ALTER TABLE play_history ADD COLUMN listened_seconds REAL DEFAULT 0`);
  }
} catch {}

export default db;
