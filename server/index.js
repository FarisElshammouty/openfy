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

function channelId(url) {
  if (!url) return null;
  const m = url.match(/\/channel\/([^/?#]+)/);
  return m ? m[1] : null;
}

function mapTrack(item) {
  return {
    videoId: vid(item.url),
    title: item.title || '',
    artist: (item.uploaderName || item.uploader || '').replace(/ - Topic$/, ''),
    artistId: channelId(item.uploaderUrl),
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

app.get('/api/recent-searches', (_req, res) => {
  res.json(db.prepare('SELECT query FROM recent_searches ORDER BY last_searched DESC LIMIT 10').all().map(r => r.query));
});

app.post('/api/recent-searches', (req, res) => {
  const q = (req.body?.query || '').trim();
  if (!q || q.length > 200) return res.json({ success: false });
  db.prepare(`
    INSERT INTO recent_searches (query) VALUES (?)
    ON CONFLICT(query) DO UPDATE SET last_searched = datetime('now')
  `).run(q);
  // Keep only the most recent 30
  db.prepare(`
    DELETE FROM recent_searches WHERE query NOT IN (
      SELECT query FROM recent_searches ORDER BY last_searched DESC LIMIT 30
    )
  `).run();
  res.json({ success: true });
});

app.delete('/api/recent-searches', (_req, res) => {
  db.prepare('DELETE FROM recent_searches').run();
  res.json({ success: true });
});

app.get('/api/search/artists', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ items: [] });
    const yt = await getYtClient();
    const r = await yt.music.search(q, { type: 'artist' });
    const items = r.contents?.[0]?.contents || [];
    const text = (v) => typeof v === 'string' ? v : (v?.text || '');
    const thumbArr = (t) => Array.isArray(t) ? t : (t?.contents || []);
    const thumbUrl = (t) => { const a = thumbArr(t); return a[a.length - 1]?.url || a[0]?.url || ''; };
    res.json({
      items: items.map(item => ({
        id: item.id,
        name: text(item.title),
        thumbnail: thumbUrl(item.thumbnail),
        subscribers: text(item.subscribers)
      })).filter(a => a.id)
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/search/albums', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ items: [] });
    const yt = await getYtClient();
    const r = await yt.music.search(q, { type: 'album' });
    const items = r.contents?.[0]?.contents || [];
    const text = (v) => typeof v === 'string' ? v : (v?.text || '');
    const thumbArr = (t) => Array.isArray(t) ? t : (t?.contents || []);
    const thumbUrl = (t) => { const a = thumbArr(t); return a[a.length - 1]?.url || a[0]?.url || ''; };
    res.json({
      items: items.map(item => ({
        id: item.id,
        title: text(item.title),
        artist: text(item.author?.name) || (item.authors?.[0]?.name || ''),
        year: item.year || '',
        thumbnail: thumbUrl(item.thumbnail)
      })).filter(a => a.id && a.title)
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Trending ────────────────────────────────────────────────────────

let trendingCache = null;

app.get('/api/trending', async (_req, res) => {
  if (trendingCache && Date.now() - trendingCache.ts < 1800000) {
    return res.json(trendingCache.data);
  }
  try {
    const yt = await getYtClient();
    const explore = await yt.music.getExplore();
    const text = (v) => typeof v === 'string' ? v : (v?.text || '');
    const sectionTitle = (s) => text(s.title) || text(s.header?.title) || '';
    const thumbArr = (t) => Array.isArray(t) ? t : (t?.contents || []);
    const thumbUrl = (t) => { const a = thumbArr(t); return a[a.length - 1]?.url || a[0]?.url || ''; };

    const section = explore.sections?.find(s => sectionTitle(s) === 'Trending');
    const items = (section?.contents || []).map(item => ({
      videoId: item.id,
      title: text(item.title),
      artist: (item.artists || []).map(a => a.name).join(', '),
      artistId: item.artists?.[0]?.channel_id || '',
      thumbnail: thumbUrl(item.thumbnail),
      duration: item.duration?.seconds || 0
    })).filter(t => t.videoId);

    trendingCache = { data: items, ts: Date.now() };
    res.json(items);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Suggestions ─────────────────────────────────────────────────────

app.get('/api/suggestions/:videoId', async (req, res) => {
  try {
    const data = await piped(`/streams/${req.params.videoId}`);
    // Don't filter out -1 durations; just exclude obvious live streams (>10min) and shorts (<30s when known)
    const items = (data.relatedStreams || []).filter(i => {
      if (i.duration > 600) return false;
      if (i.duration > 0 && i.duration < 30) return false;
      return true;
    });
    res.json(items.slice(0, 25).map(mapTrack).filter(t => t.videoId));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Artist ──────────────────────────────────────────────────────────

const artistCache = new Map();

app.get('/api/artist/:id', async (req, res) => {
  const id = req.params.id;
  const cached = artistCache.get(id);
  if (cached && Date.now() - cached.ts < 1800000) return res.json(cached.data);

  try {
    const yt = await getYtClient();
    const ch = await yt.music.getArtist(id);
    const text = (v) => typeof v === 'string' ? v : (v?.text || '');
    const thumbArr = (t) => Array.isArray(t) ? t : (t?.contents || []);
    const thumbUrl = (t) => { const arr = thumbArr(t); return arr[arr.length - 1]?.url || arr[0]?.url || ''; };
    const bigThumb = (t) => thumbArr(t)[0]?.url || '';

    const sectionTitle = (s) => text(s.title) || text(s.header?.title) || '';
    const sectionByTitle = (titles) => ch.sections?.find(s => titles.includes(sectionTitle(s)));

    const topSongs = (sectionByTitle(['Top songs', 'Songs'])?.contents || []).map(item => ({
      videoId: item.id,
      title: text(item.title),
      artist: (item.artists || []).map(a => a.name).join(', ') || text(ch.header?.title),
      artistId: id,
      thumbnail: thumbUrl(item.thumbnail),
      duration: item.duration?.seconds || 0
    })).filter(t => t.videoId);

    const albums = (sectionByTitle(['Albums'])?.contents || []).map(item => ({
      id: item.id,
      title: text(item.title),
      year: item.year || '',
      thumbnail: thumbUrl(item.thumbnail)
    })).filter(a => a.title);

    const singles = (sectionByTitle(['Singles & EPs', 'Singles'])?.contents || []).map(item => ({
      id: item.id,
      title: text(item.title),
      year: item.year || '',
      thumbnail: thumbUrl(item.thumbnail)
    })).filter(a => a.title);

    const related = (sectionByTitle(['Fans might also like', 'Related artists'])?.contents || []).map(item => ({
      id: item.id,
      name: text(item.title),
      thumbnail: thumbUrl(item.thumbnail)
    })).filter(a => a.name && a.id);

    const data = {
      id,
      name: text(ch.header?.title),
      description: text(ch.header?.description),
      thumbnail: bigThumb(ch.header?.thumbnail),
      topSongs: topSongs.slice(0, 10),
      albums: albums.slice(0, 12),
      singles: singles.slice(0, 12),
      related: related.slice(0, 10)
    };

    artistCache.set(id, { data, ts: Date.now() });
    // Save artist photo for stats top-artists display
    if (data.name && data.thumbnail) {
      try {
        db.prepare(`
          INSERT INTO artist_meta (artist_id, name, thumbnail)
          VALUES (?, ?, ?)
          ON CONFLICT(artist_id) DO UPDATE SET name=excluded.name, thumbnail=excluded.thumbnail, updated_at=datetime('now')
        `).run(id, data.name, data.thumbnail);
      } catch {}
    }
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Album ───────────────────────────────────────────────────────────

const albumCache = new Map();

app.get('/api/album/:id', async (req, res) => {
  const id = req.params.id;
  const cached = albumCache.get(id);
  if (cached && Date.now() - cached.ts < 1800000) return res.json(cached.data);

  try {
    const yt = await getYtClient();
    const album = await yt.music.getAlbum(id);
    const text = (v) => typeof v === 'string' ? v : (v?.text || '');
    const thumbArr = (t) => Array.isArray(t) ? t : (t?.contents || []);
    const bigThumb = (t) => thumbArr(t)[0]?.url || '';

    const albumThumb = bigThumb(album.header?.thumbnail);

    const albumArtists = [];
    const strapline = album.header?.strapline_text_one;
    if (strapline?.text) {
      albumArtists.push({
        name: strapline.text,
        id: strapline.endpoint?.payload?.browseId || ''
      });
    }

    const tracks = (album.contents || []).map(item => ({
      videoId: item.id,
      title: text(item.title),
      artist: (item.artists || []).map(a => a.name).join(', ') || (albumArtists[0]?.name || ''),
      artistId: item.artists?.[0]?.channel_id || albumArtists[0]?.id || '',
      thumbnail: albumThumb,
      duration: item.duration?.seconds || 0
    })).filter(t => t.videoId);

    const subtitleText = text(album.header?.subtitle);
    const yearMatch = subtitleText.match(/\d{4}/);

    const data = {
      id,
      title: text(album.header?.title),
      subtitle: subtitleText,
      year: yearMatch ? yearMatch[0] : '',
      stats: text(album.header?.second_subtitle),
      thumbnail: albumThumb,
      artists: albumArtists,
      tracks
    };

    albumCache.set(id, { data, ts: Date.now() });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Play history ────────────────────────────────────────────────────

app.post('/api/history', (req, res) => {
  const { videoId, title, artist, artistId, thumbnail, duration, listenedSeconds, incremental } = req.body;
  if (!videoId) return res.status(400).json({ error: 'videoId required' });
  const ls = Number.isFinite(listenedSeconds) ? listenedSeconds : 0;

  if (incremental) {
    // Update only listened_seconds (don't bump play_count again)
    db.prepare(`
      UPDATE play_history SET listened_seconds = ? WHERE video_id = ?
    `).run(ls, videoId);
  } else {
    db.prepare(`
      INSERT INTO play_history (video_id, title, artist, artist_id, thumbnail, duration, listened_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(video_id) DO UPDATE SET
        play_count = play_count + 1,
        last_played = datetime('now'),
        listened_seconds = listened_seconds + excluded.listened_seconds,
        title = excluded.title,
        artist = excluded.artist,
        artist_id = excluded.artist_id,
        thumbnail = excluded.thumbnail,
        duration = excluded.duration
    `).run(videoId, title || '', artist || '', artistId || '', thumbnail || '', duration || 0, ls);
  }
  res.json({ success: true });
});

app.delete('/api/history', (_req, res) => {
  db.prepare('DELETE FROM play_history').run();
  res.json({ success: true });
});

app.get('/api/history', (_req, res) => {
  res.json(db.prepare(`
    SELECT video_id AS videoId, title, artist, artist_id AS artistId, thumbnail, duration, play_count AS playCount, last_played AS lastPlayed
    FROM play_history ORDER BY last_played DESC LIMIT 30
  `).all());
});

// "Made for You" mixes — based on top artists from history
let mixesCache = null;

app.get('/api/mixes', async (_req, res) => {
  if (mixesCache && Date.now() - mixesCache.ts < 3600000) {
    return res.json(mixesCache.data);
  }
  try {
    const topArtists = db.prepare(`
      SELECT artist, artist_id AS artistId, MAX(thumbnail) AS thumbnail, SUM(play_count) AS plays
      FROM play_history WHERE artist_id != ''
      GROUP BY artist_id ORDER BY plays DESC LIMIT 5
    `).all();

    const yt = await getYtClient();
    const text = (v) => typeof v === 'string' ? v : (v?.text || '');
    const thumbArr = (t) => Array.isArray(t) ? t : (t?.contents || []);
    const thumbUrl = (t) => { const a = thumbArr(t); return a[a.length - 1]?.url || a[0]?.url || ''; };
    const sectionTitle = (s) => text(s.title) || text(s.header?.title) || '';

    // Build a single artist-based mix in parallel
    async function buildArtistMix(seed) {
      try {
        const ch = await yt.music.getArtist(seed.artistId);
        const top = ch.sections?.find(s => sectionTitle(s) === 'Top songs');
        const related = ch.sections?.find(s => sectionTitle(s) === 'Fans might also like');

        const tracks = [];
        for (const item of (top?.contents || []).slice(0, 3)) {
          if (item.id) tracks.push({
            videoId: item.id,
            title: text(item.title),
            artist: (item.artists || []).map(a => a.name).join(', ') || seed.artist,
            artistId: seed.artistId,
            thumbnail: thumbUrl(item.thumbnail),
            duration: 0
          });
        }

        // Parallel-fetch related artists' top songs
        const relatedArtists = (related?.contents || []).slice(0, 4).filter(r => r.id);
        const relTopLists = await Promise.all(relatedArtists.map(async ra => {
          try {
            const rch = await yt.music.getArtist(ra.id);
            const rtop = rch.sections?.find(s => sectionTitle(s) === 'Top songs');
            return { ra, items: rtop?.contents || [] };
          } catch { return { ra, items: [] }; }
        }));

        for (const { ra, items } of relTopLists) {
          for (const item of items.slice(0, 2)) {
            if (item.id) tracks.push({
              videoId: item.id,
              title: text(item.title),
              artist: (item.artists || []).map(a => a.name).join(', ') || text(ra.title),
              artistId: ra.id,
              thumbnail: thumbUrl(item.thumbnail),
              duration: 0
            });
          }
        }

        for (let i = tracks.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
        }

        return {
          id: `mix-${seed.artistId}`,
          name: `${seed.artist} Mix`,
          subtitle: `Inspired by ${seed.artist} and similar artists`,
          thumbnail: seed.thumbnail,
          tracks: tracks.slice(0, 20)
        };
      } catch { return null; }
    }

    // Fallback: a discovery mix from "Trending" if user has 0 or 1 strong artists
    async function buildDiscoveryMix() {
      try {
        const explore = await yt.music.getExplore();
        const trending = explore.sections?.find(s => sectionTitle(s) === 'Trending');
        const tracks = (trending?.contents || []).map(item => ({
          videoId: item.id,
          title: text(item.title),
          artist: (item.artists || []).map(a => a.name).join(', '),
          artistId: item.artists?.[0]?.channel_id || '',
          thumbnail: thumbUrl(item.thumbnail),
          duration: item.duration?.seconds || 0
        })).filter(t => t.videoId);
        for (let i = tracks.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
        }
        if (!tracks.length) return null;
        return {
          id: 'mix-discover',
          name: 'Discover Mix',
          subtitle: 'Fresh picks from trending music',
          thumbnail: tracks[0]?.thumbnail || '',
          tracks: tracks.slice(0, 20)
        };
      } catch { return null; }
    }

    // Build artist mixes (up to 3) in parallel
    const artistMixes = (await Promise.all(topArtists.slice(0, 3).map(buildArtistMix))).filter(Boolean);

    // Add fallback discovery mix if user has few or no artist mixes
    const mixes = [...artistMixes];
    if (mixes.length < 2) {
      const discovery = await buildDiscoveryMix();
      if (discovery) mixes.push(discovery);
    }

    const data = { mixes };
    mixesCache = { data, ts: Date.now() };
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/stats', (_req, res) => {
  const topTracks = db.prepare(`
    SELECT video_id AS videoId, title, artist, artist_id AS artistId, thumbnail, duration, play_count AS playCount
    FROM play_history WHERE play_count > 0 ORDER BY play_count DESC, last_played DESC LIMIT 10
  `).all();

  // Top artists: prefer artist_meta photo when we have one
  const topArtists = db.prepare(`
    SELECT
      h.artist,
      h.artist_id AS artistId,
      COALESCE(m.thumbnail, MAX(h.thumbnail)) AS thumbnail,
      SUM(h.play_count) AS plays,
      COUNT(*) AS uniqueTracks
    FROM play_history h
    LEFT JOIN artist_meta m ON m.artist_id = h.artist_id
    WHERE h.artist != ''
    GROUP BY h.artist ORDER BY plays DESC LIMIT 10
  `).all();

  // Total seconds from actual listening, falling back to duration*play_count for old rows
  const totals = db.prepare(`
    SELECT
      SUM(play_count) AS totalPlays,
      COUNT(*) AS uniqueTracks,
      SUM(CASE WHEN listened_seconds > 0 THEN listened_seconds ELSE duration * play_count END) AS totalSeconds
    FROM play_history
  `).get();

  res.json({
    topTracks,
    topArtists,
    totalPlays: totals.totalPlays || 0,
    uniqueTracks: totals.uniqueTracks || 0,
    totalSeconds: totals.totalSeconds || 0
  });
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

    // Stream segments as they arrive — first chunks are sent ASAP, rest pre-fetched in parallel
    res.status(200);
    res.set('content-type', 'audio/aac');
    res.set('accept-ranges', 'none');

    // Concurrent prefetch: launch all fetches up-front, but write in order
    const segPromises = segments.map(segUrl =>
      fetch(segUrl, { signal: AbortSignal.timeout(15000) })
        .then(r => r.ok ? r.arrayBuffer() : null)
        .catch(() => null)
    );

    for (let i = 0; i < segPromises.length; i++) {
      if (res.writableEnded) break;
      try {
        const buf = await segPromises[i];
        if (buf) {
          if (!res.write(Buffer.from(buf))) {
            // Backpressure: wait for drain
            await new Promise(resolve => res.once('drain', resolve));
          }
        }
      } catch {}
    }
    res.end();
    return;
  } catch (err) {
    if (!res.headersSent) res.status(502).json({ error: err.message });
  }
});

// ── Image proxy (for color extraction with CORS) ────────────────────

app.get('/api/img-proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).end();
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': '' },
      signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) return res.status(r.status).end();
    res.set('content-type', r.headers.get('content-type') || 'image/jpeg');
    res.set('cache-control', 'public, max-age=86400');
    res.set('access-control-allow-origin', '*');
    const buf = Buffer.from(await r.arrayBuffer());
    res.send(buf);
  } catch {
    res.status(502).end();
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

// ── Playlist import (Spotify / YouTube) ────────────────────────────

async function importSpotify(playlistId) {
  const url = `https://open.spotify.com/embed/playlist/${playlistId}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(15000)
  });
  if (!r.ok) throw new Error('Spotify embed fetch failed');
  const html = await r.text();
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('Could not parse Spotify playlist');
  const data = JSON.parse(m[1]);
  const entity = data.props?.pageProps?.state?.data?.entity;
  if (!entity) throw new Error('No playlist data');
  const tracks = entity.trackList || entity.tracks || [];
  return {
    name: entity.title || entity.name || 'Imported Playlist',
    tracks: tracks.map(t => ({
      title: t.title || t.name || '',
      artist: t.subtitle || (t.artists || []).map(a => a.name).join(', ')
    })).filter(t => t.title)
  };
}

async function searchYoutubeForTrack(query) {
  try {
    const data = await piped(`/search?q=${encodeURIComponent(query)}&filter=music_songs`);
    const item = data.items?.[0];
    if (!item) return null;
    return mapTrack(item);
  } catch {
    return null;
  }
}

app.post('/api/import-playlist', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });
  try {
    let source;
    const sm = url.match(/spotify\.com\/(?:embed\/)?playlist\/([a-zA-Z0-9]+)/);
    if (sm) {
      source = await importSpotify(sm[1]);
    } else {
      return res.status(400).json({ error: 'Only Spotify playlist URLs supported for now' });
    }

    if (!source.tracks.length) return res.status(400).json({ error: 'No tracks found' });

    const result = db.prepare('INSERT INTO playlists (name, description) VALUES (?, ?)')
      .run(source.name, 'Imported from Spotify');
    const playlistId = Number(result.lastInsertRowid);

    let added = 0;
    let position = 0;
    for (const t of source.tracks) {
      const query = `${t.title} ${t.artist}`.trim();
      const found = await searchYoutubeForTrack(query);
      if (!found) continue;
      try {
        db.prepare('INSERT INTO playlist_tracks (playlist_id,video_id,title,artist,thumbnail,duration,position) VALUES(?,?,?,?,?,?,?)')
          .run(playlistId, found.videoId, found.title, found.artist, found.thumbnail || '', found.duration || 0, position++);
        added++;
      } catch {}
    }

    res.json({
      playlistId,
      name: source.name,
      total: source.tracks.length,
      added
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Saved albums ────────────────────────────────────────────────────

app.get('/api/saved-albums', (_req, res) => {
  res.json(db.prepare(`
    SELECT album_id AS id, title, artist, artist_id AS artistId, thumbnail, year, saved_at AS savedAt
    FROM saved_albums ORDER BY saved_at DESC
  `).all());
});

app.post('/api/saved-albums', (req, res) => {
  const { id, title, artist, artistId, thumbnail, year } = req.body;
  if (!id || !title) return res.status(400).json({ error: 'id and title required' });
  db.prepare(`
    INSERT OR REPLACE INTO saved_albums (album_id, title, artist, artist_id, thumbnail, year)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, title, artist || '', artistId || '', thumbnail || '', year || '');
  res.json({ success: true });
});

app.delete('/api/saved-albums/:id', (req, res) => {
  db.prepare('DELETE FROM saved_albums WHERE album_id=?').run(req.params.id);
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
  const tryListen = (port, fallback) => {
    const server = app.listen(port, () => {
      const actualPort = server.address().port;
      console.log(`\n  Openfy running at http://localhost:${actualPort}`);
      console.log(`  Piped instances: ${PIPED_INSTANCES.join(', ')}\n`);
      resolve(actualPort);
    });
    server.on('error', err => {
      if (err.code === 'EADDRINUSE' && fallback) {
        console.log(`  Port ${port} in use, picking a free port...`);
        tryListen(0, false);
      } else {
        throw err;
      }
    });
  };
  tryListen(PORT, true);
});

export { serverReady };
