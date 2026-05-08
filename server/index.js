import express from 'express';
import cors from 'cors';
import path from 'path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'url';
import { Innertube, ClientType } from 'youtubei.js';
import db from './db.js';
import { initDiscord, updatePresence } from './discord.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const PIPED_INSTANCES = (process.env.PIPED_API || 'https://api.piped.private.coffee,https://pipedapi.wireway.ch').split(',');

app.use(cors());
app.use(express.json());

// ── Piped helpers ───────────────────────────────────────────────────

let activeInstance = PIPED_INSTANCES[0];

async function piped(endpoint) {
  for (const inst of [activeInstance, ...PIPED_INSTANCES.filter(i => i !== activeInstance)]) {
    try {
      const res = await fetch(`${inst}${endpoint}`, {
        headers: { 'User-Agent': 'Openfy/1.0' },
        signal: AbortSignal.timeout(10000)
      });
      if (!res.ok) continue;
      activeInstance = inst;
      return res.json();
    } catch {}
  }
  throw new Error('All Piped instances unavailable');
}

function vid(url) {
  if (!url) return null;
  const m = url.match(/[?&]v=([^&]+)/);
  return m ? m[1] : url.replace('/watch?v=', '');
}

function mapTrack(item) {
  return {
    videoId: vid(item.url),
    title: item.title || '',
    artist: item.uploaderName || item.uploader || '',
    thumbnail: item.thumbnail || '',
    duration: item.duration || 0
  };
}

// ── Stream resolution (InnerTube + Piped) ──────────────────────────

let ytClient = null;
let ytClientAge = 0;
const YT_CLIENT_MAX_AGE = 1800000;

async function getYtClient() {
  if (!ytClient || Date.now() - ytClientAge > YT_CLIENT_MAX_AGE) {
    ytClient = await Innertube.create({ client_type: ClientType.IOS });
    ytClientAge = Date.now();
  }
  return ytClient;
}

const audioUrlCache = new Map();

async function resolveViaPiped(videoId) {
  const cached = audioUrlCache.get(videoId);
  if (cached && Date.now() - cached.ts < 300000) return cached.info;
  for (const inst of [activeInstance, ...PIPED_INSTANCES.filter(i => i !== activeInstance)]) {
    try {
      const r = await fetch(`${inst}/streams/${videoId}`, {
        headers: { 'User-Agent': 'Openfy/1.0' },
        signal: AbortSignal.timeout(10000)
      });
      if (!r.ok) continue;
      const data = await r.json();
      const best = (data.audioStreams || [])
        .filter(s => s.mimeType?.startsWith('audio/'))
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
      if (best?.url) {
        activeInstance = inst;
        const info = { url: best.url, mime: best.mimeType || 'audio/mp4', contentLength: best.contentLength };
        audioUrlCache.set(videoId, { info, ts: Date.now() });
        return info;
      }
    } catch {}
  }
  return null;
}

// ── Lyrics (LRCLIB) ────────────────────────────────────────────────

async function fetchLrclib(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Openfy/1.0' },
      signal: AbortSignal.timeout(10000)
    }).catch(() => null);
    if (r?.ok) return r.json();
  }
  return null;
}

app.get('/api/lyrics', async (req, res) => {
  try {
    const { title, artist } = req.query;
    if (!title) return res.json({ syncedLyrics: null, plainLyrics: null });

    const clean = (s) => s.replace(/\s*\(.*?\)\s*/g, '').replace(/\s*\[.*?\]\s*/g, '')
      .replace(/\s*\|.*$/, '').replace(/\s*ft\..*$/i, '').replace(/\s*feat\..*$/i, '').trim();
    const cleanArtist = (s) => s.replace(/ - Topic$/, '').replace(/VEVO$/i, '').trim();

    const t = clean(title);
    const a = cleanArtist(artist || '');

    const params = new URLSearchParams({ track_name: t });
    if (a) params.set('artist_name', a);

    const data = await fetchLrclib(`https://lrclib.net/api/get?${params}`);
    if (data?.syncedLyrics || data?.plainLyrics)
      return res.json({ syncedLyrics: data.syncedLyrics || null, plainLyrics: data.plainLyrics || null });

    const q = `${t} ${a}`.trim();
    const results = await fetchLrclib(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`);
    if (Array.isArray(results)) {
      const best = results.find(x => x.syncedLyrics) || results[0];
      if (best) return res.json({ syncedLyrics: best.syncedLyrics || null, plainLyrics: best.plainLyrics || null });
    }

    res.json({ syncedLyrics: null, plainLyrics: null });
  } catch {
    res.json({ syncedLyrics: null, plainLyrics: null });
  }
});

// ── Search ──────────────────────────────────────────────────────────

app.get('/api/search', async (req, res) => {
  try {
    const { q, filter = 'music_songs' } = req.query;
    if (!q) return res.json({ items: [] });
    const data = await piped(`/search?q=${encodeURIComponent(q)}&filter=${filter}`);
    res.json({ items: (data.items || []).map(mapTrack).filter(t => t.videoId) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Trending ────────────────────────────────────────────────────────

app.get('/api/trending', async (req, res) => {
  try {
    const { region = 'US' } = req.query;
    const data = await piped(`/trending?region=${region}`);
    res.json((data || []).filter(i => i.duration > 30 && i.duration < 600).map(mapTrack).filter(t => t.videoId));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Suggestions ─────────────────────────────────────────────────────

app.get('/api/suggestions/:videoId', async (req, res) => {
  try {
    const data = await piped(`/streams/${req.params.videoId}`);
    res.json((data.relatedStreams || []).filter(i => i.duration > 30 && i.duration < 600).slice(0, 25).map(mapTrack).filter(t => t.videoId));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Audio stream proxy ──────────────────────────────────────────────

app.get('/api/stream/:videoId', async (req, res) => {
  const videoId = req.params.videoId;

  // Strategy 1: Piped proxied stream (Piped instances proxy through their own servers)
  try {
    const audio = await resolveViaPiped(videoId);
    if (audio) {
      const headers = { 'User-Agent': 'Openfy/1.0' };
      if (req.headers.range) headers['Range'] = req.headers.range;
      const upstream = await fetch(audio.url, { headers, signal: AbortSignal.timeout(15000) });
      if (upstream.ok || upstream.status === 206) {
        res.set('content-type', audio.mime);
        res.set('accept-ranges', 'bytes');
        if (req.headers.range) {
          res.status(206);
          const cl = upstream.headers.get('content-length');
          const cr = upstream.headers.get('content-range');
          if (cl) res.set('content-length', cl);
          if (cr) res.set('content-range', cr);
        } else {
          res.status(200);
          const cr = upstream.headers.get('content-range');
          const total = cr?.match(/\/(\d+)/)?.[1];
          res.set('content-length', total || upstream.headers.get('content-length') || '');
        }
        const ns = Readable.fromWeb(upstream.body);
        ns.on('error', () => { if (!res.headersSent) res.status(502).end(); else res.destroy(); });
        ns.pipe(res);
        return;
      }
      audioUrlCache.delete(videoId);
    }
  } catch {
    audioUrlCache.delete(videoId);
  }

  // Strategy 2: InnerTube IOS direct download (test first chunk before committing)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const yt = await getYtClient();
      const info = await yt.getBasicInfo(videoId);
      const format = info.chooseFormat({ type: 'audio', quality: 'best' });
      const mime = format.mime_type || 'audio/mp4';
      const total = format.content_length;

      const dlOpts = { type: 'audio', quality: 'best' };
      if (req.headers.range) {
        const m = req.headers.range.match(/bytes=(\d+)-(\d*)/);
        if (m) dlOpts.range = { start: parseInt(m[1], 10), end: m[2] ? parseInt(m[2], 10) : undefined };
      }

      const stream = await yt.download(videoId, dlOpts);
      const reader = stream.getReader();
      const firstRead = await reader.read();
      if (firstRead.done || !firstRead.value?.length) throw new Error('Empty stream');

      if (req.headers.range && dlOpts.range) {
        const start = dlOpts.range.start;
        const end = dlOpts.range.end ?? (total ? total - 1 : undefined);
        res.status(206);
        res.set('content-type', mime);
        res.set('accept-ranges', 'bytes');
        if (total && end !== undefined) {
          res.set('content-length', String(end - start + 1));
          res.set('content-range', `bytes ${start}-${end}/${total}`);
        }
      } else {
        res.status(200);
        res.set('content-type', mime);
        res.set('accept-ranges', 'bytes');
        if (total) res.set('content-length', String(total));
      }

      res.write(Buffer.from(firstRead.value));
      const remaining = new ReadableStream({ pull(ctrl) { return reader.read().then(r => r.done ? ctrl.close() : ctrl.enqueue(r.value)); } });
      const nodeStream = Readable.fromWeb(remaining);
      nodeStream.on('error', () => res.destroy());
      nodeStream.pipe(res);
      return;
    } catch (err) {
      if (attempt === 0) {
        ytClient = null;
        continue;
      }
    }
  }

  // Strategy 3: HLS manifest fallback (works when direct download returns 403)
  try {
    const yt = await getYtClient();
    const info = await yt.getBasicInfo(videoId);
    const hlsUrl = info.streaming_data?.hls_manifest_url;
    if (!hlsUrl) throw new Error('No HLS manifest');

    const masterRes = await fetch(hlsUrl, { signal: AbortSignal.timeout(10000) });
    if (!masterRes.ok) throw new Error('HLS manifest fetch failed');
    const masterText = await masterRes.text();

    let audioPlaylistUrl = null;
    for (const line of masterText.split('\n')) {
      if (line.includes('TYPE=AUDIO') && line.includes('URI=')) {
        const m = line.match(/URI="([^"]+)"/);
        if (m) { audioPlaylistUrl = m[1]; break; }
      }
    }
    if (!audioPlaylistUrl) throw new Error('No audio playlist in HLS');

    const plRes = await fetch(audioPlaylistUrl, { signal: AbortSignal.timeout(10000) });
    if (!plRes.ok) throw new Error('Audio playlist fetch failed');
    const plText = await plRes.text();

    const segments = plText.split('\n').filter(l => l.startsWith('https://'));
    if (!segments.length) throw new Error('No segments in HLS playlist');

    const chunks = await Promise.all(segments.map(async (segUrl) => {
      const segRes = await fetch(segUrl, { signal: AbortSignal.timeout(15000) });
      if (!segRes.ok) return null;
      return Buffer.from(await segRes.arrayBuffer());
    }));
    const body = Buffer.concat(chunks.filter(Boolean));

    res.status(200);
    res.set('content-type', 'audio/aac');
    res.set('content-length', String(body.length));
    res.set('accept-ranges', 'bytes');
    res.end(body);
    return;
  } catch (err) {
    if (!res.headersSent) res.status(502).json({ error: err.message });
  }
});

// ── Playlists ───────────────────────────────────────────────────────

app.get('/api/playlists', (_req, res) => {
  res.json(db.prepare(`
    SELECT p.*, COUNT(pt.id) AS track_count
    FROM playlists p LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
    GROUP BY p.id ORDER BY p.updated_at DESC
  `).all());
});

app.post('/api/playlists', (req, res) => {
  const { name, description = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = db.prepare('INSERT INTO playlists (name, description) VALUES (?, ?)').run(name, description);
  res.json({ id: Number(r.lastInsertRowid), name, description, track_count: 0 });
});

app.get('/api/playlists/:id', (req, res) => {
  const pl = db.prepare('SELECT * FROM playlists WHERE id = ?').get(req.params.id);
  if (!pl) return res.status(404).json({ error: 'Not found' });
  const tracks = db.prepare(
    'SELECT video_id AS videoId, title, artist, thumbnail, duration FROM playlist_tracks WHERE playlist_id = ? ORDER BY position'
  ).all(req.params.id);
  res.json({ ...pl, tracks });
});

app.put('/api/playlists/:id', (req, res) => {
  const { name, description } = req.body;
  db.prepare("UPDATE playlists SET name=COALESCE(?,name), description=COALESCE(?,description), updated_at=datetime('now') WHERE id=?")
    .run(name, description, req.params.id);
  res.json({ success: true });
});

app.delete('/api/playlists/:id', (req, res) => {
  db.prepare('DELETE FROM playlists WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/playlists/:id/tracks', (req, res) => {
  const { videoId, title, artist, thumbnail, duration } = req.body;
  const max = db.prepare('SELECT COALESCE(MAX(position),0) AS m FROM playlist_tracks WHERE playlist_id=?').get(req.params.id);
  try {
    db.prepare('INSERT INTO playlist_tracks (playlist_id,video_id,title,artist,thumbnail,duration,position) VALUES(?,?,?,?,?,?,?)')
      .run(req.params.id, videoId, title || '', artist || '', thumbnail || '', duration || 0, max.m + 1);
    db.prepare("UPDATE playlists SET updated_at=datetime('now') WHERE id=?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Already added' });
    throw err;
  }
});

app.delete('/api/playlists/:id/tracks/:videoId', (req, res) => {
  db.prepare('DELETE FROM playlist_tracks WHERE playlist_id=? AND video_id=?').run(req.params.id, req.params.videoId);
  db.prepare("UPDATE playlists SET updated_at=datetime('now') WHERE id=?").run(req.params.id);
  res.json({ success: true });
});

// ── Liked tracks ────────────────────────────────────────────────────

app.get('/api/liked', (_req, res) => {
  res.json(db.prepare('SELECT video_id AS videoId, title, artist, thumbnail, duration FROM liked_tracks ORDER BY added_at DESC').all());
});

app.post('/api/liked', (req, res) => {
  const { videoId, title, artist, thumbnail, duration } = req.body;
  db.prepare('INSERT OR IGNORE INTO liked_tracks (video_id,title,artist,thumbnail,duration) VALUES(?,?,?,?,?)')
    .run(videoId, title || '', artist || '', thumbnail || '', duration || 0);
  res.json({ success: true });
});

app.delete('/api/liked/:videoId', (req, res) => {
  db.prepare('DELETE FROM liked_tracks WHERE video_id=?').run(req.params.videoId);
  res.json({ success: true });
});

// ── Discord RPC ────────────────────────────────────────────────────

initDiscord();

app.post('/api/discord/presence', (req, res) => {
  updatePresence(req.body);
  res.json({ success: true });
});

// ── Production ──────────────────────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const serverReady = new Promise(resolve => {
  app.listen(PORT, () => {
    console.log(`\n  Openfy running at http://localhost:${PORT}`);
    console.log(`  Piped instances: ${PIPED_INSTANCES.join(', ')}\n`);
    resolve();
  });
});

export { serverReady };
