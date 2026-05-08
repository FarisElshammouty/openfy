import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;
const sessions = new Map();

const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.url.startsWith('/listen/')) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(readFileSync(join(__dirname, 'public', 'listen.html')));
    return;
  }

  if (req.url === '/health') {
    const list = [...sessions.entries()].map(([id, s]) => ({ id, hasHost: !!s.host, listeners: s.listeners.size }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', sessions: list }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Openfy Relay');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const m = url.pathname.match(/^\/ws\/(.+)$/);
  if (!m) return ws.close();

  const id = m[1];
  const role = url.searchParams.get('role') || 'listener';

  if (!sessions.has(id)) sessions.set(id, { host: null, listeners: new Set(), state: null });
  const s = sessions.get(id);

  if (role === 'host') {
    s.host = ws;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'state') {
          s.state = msg.data;
          for (const l of s.listeners) {
            if (l.readyState === 1) l.send(raw.toString());
          }
        }
      } catch {}
    });

    ws.on('close', () => {
      s.host = null;
      const ended = JSON.stringify({ type: 'ended' });
      for (const l of s.listeners) {
        if (l.readyState === 1) l.send(ended);
      }
      if (s.listeners.size === 0) sessions.delete(id);
    });

    ws.send(JSON.stringify({ type: 'listeners', count: s.listeners.size }));

  } else {
    s.listeners.add(ws);

    if (s.state) ws.send(JSON.stringify({ type: 'state', data: s.state }));

    if (s.host?.readyState === 1) {
      s.host.send(JSON.stringify({ type: 'listeners', count: s.listeners.size }));
    }

    ws.on('close', () => {
      s.listeners.delete(ws);
      if (s.host?.readyState === 1) {
        s.host.send(JSON.stringify({ type: 'listeners', count: s.listeners.size }));
      }
      if (s.listeners.size === 0 && !s.host) sessions.delete(id);
    });
  }
});

setInterval(() => {
  for (const [id, s] of sessions) {
    if (!s.host && s.listeners.size === 0) sessions.delete(id);
  }
}, 300000);

server.listen(PORT, () => console.log(`Openfy Relay on port ${PORT}`));
