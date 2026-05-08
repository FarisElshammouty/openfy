import { WebSocketServer } from 'ws';
import { networkInterfaces } from 'os';

const sessions = new Map();

export function getLocalIP() {
  for (const nets of Object.values(networkInterfaces())) {
    for (const net of nets) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

function genId() {
  return Math.random().toString(36).slice(2, 8);
}

export function createSession() {
  const id = genId();
  sessions.set(id, { id, host: null, listeners: new Set(), state: null });
  return id;
}

export function getSession(id) {
  return sessions.get(id) || null;
}

export function deleteSession(id) {
  const s = sessions.get(id);
  if (!s) return;
  const msg = JSON.stringify({ type: 'ended' });
  for (const ws of s.listeners) {
    try { ws.send(msg); ws.close(); } catch {}
  }
  if (s.host) try { s.host.close(); } catch {}
  sessions.delete(id);
}

export function attachWebSocket(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost');
    const m = url.pathname.match(/^\/ws\/listen\/([a-z0-9]+)$/);
    if (!m) { socket.destroy(); return; }

    const session = sessions.get(m[1]);
    if (!session) { socket.destroy(); return; }

    const role = url.searchParams.get('role');
    wss.handleUpgrade(req, socket, head, ws => onConnect(ws, session, role));
  });
}

function broadcast(session, data) {
  const msg = typeof data === 'string' ? data : JSON.stringify(data);
  for (const ws of session.listeners) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

function notifyHost(session) {
  if (session.host?.readyState === 1) {
    session.host.send(JSON.stringify({ type: 'listeners', count: session.listeners.size }));
  }
}

function onConnect(ws, session, role) {
  if (role === 'host') {
    session.host = ws;

    ws.on('message', raw => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'state') {
          session.state = { ...msg.data, ts: Date.now() };
          broadcast(session, { type: 'state', data: session.state });
        }
      } catch {}
    });

    ws.on('close', () => {
      broadcast(session, { type: 'ended' });
      sessions.delete(session.id);
    });

  } else {
    session.listeners.add(ws);
    if (session.state) {
      ws.send(JSON.stringify({ type: 'state', data: session.state }));
    }
    notifyHost(session);

    ws.on('close', () => {
      session.listeners.delete(ws);
      notifyHost(session);
    });
  }
}
