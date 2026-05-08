import { Client } from '@xhayper/discord-rpc';

const CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1501992392834945174';

let rpc = null;
let connected = false;
let connecting = false;

async function connect() {
  if (connecting) return;
  connecting = true;
  try {
    rpc = new Client({ clientId: CLIENT_ID });
    rpc.on('disconnected', () => { connected = false; rpc = null; console.log('  Discord RPC disconnected'); });
    await rpc.login();
    connected = true;
    console.log('  Discord RPC connected');
  } catch (err) {
    console.log('  Discord RPC failed:', err.message || err);
    connected = false;
    rpc = null;
  }
  connecting = false;
}

export async function initDiscord() {
  if (!CLIENT_ID) {
    console.log('  Discord RPC: Set DISCORD_CLIENT_ID to enable');
    return;
  }
  await connect();
  setInterval(() => { if (!connected && !connecting) connect(); }, 30_000);
}

export function updatePresence({ title, artist, thumbnail, videoId, duration, elapsed, playing, sessionUrl, openUrl }) {
  if (!rpc || !connected) return;

  if (!playing || !title) {
    rpc.user?.clearActivity().catch(() => {});
    return;
  }

  const now = Date.now();
  const buttons = [];

  if (sessionUrl) {
    buttons.push({ label: 'Listen Along', url: sessionUrl });
  }
  buttons.push({ label: 'Listen on Openfy', url: openUrl || `https://music.youtube.com/watch?v=${videoId}` });

  const activity = {
    name: 'Openfy',
    type: 2,
    details: title,
    state: `by ${artist || 'Unknown'}`,
    startTimestamp: new Date(now - (elapsed || 0) * 1000),
    endTimestamp: duration ? new Date(now + (duration - (elapsed || 0)) * 1000) : undefined,
    largeImageUrl: thumbnail || undefined,
    largeImageText: title,
    smallImageKey: 'https://img.icons8.com/fluency/512/music.png',
    smallImageText: 'Openfy',
    buttons
  };

  rpc.user?.setActivity(activity)
    .then(() => console.log('  Discord RPC: activity set OK'))
    .catch(err => console.log('  Discord RPC: setActivity error:', err.message));
}
