const API = '/api';

async function request(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  search: (q) => request(`/search?q=${encodeURIComponent(q)}`),
  trending: (region) => request(`/trending?region=${region || 'US'}`),
  suggestions: (videoId) => request(`/suggestions/${videoId}`),

  getPlaylists: () => request('/playlists'),
  getPlaylist: (id) => request(`/playlists/${id}`),
  createPlaylist: (name, desc) =>
    request('/playlists', { method: 'POST', body: JSON.stringify({ name, description: desc }) }),
  updatePlaylist: (id, data) =>
    request(`/playlists/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePlaylist: (id) => request(`/playlists/${id}`, { method: 'DELETE' }),
  addToPlaylist: (pid, track) =>
    request(`/playlists/${pid}/tracks`, { method: 'POST', body: JSON.stringify(track) }),
  removeFromPlaylist: (pid, videoId) =>
    request(`/playlists/${pid}/tracks/${videoId}`, { method: 'DELETE' }),

  getLiked: () => request('/liked'),
  likeSong: (track) => request('/liked', { method: 'POST', body: JSON.stringify(track) }),
  unlikeSong: (videoId) => request(`/liked/${videoId}`, { method: 'DELETE' }),

  getArtist: (id) => request(`/artist/${id}`),
  getAlbum: (id) => request(`/album/${id}`),
  getHistory: () => request('/history'),
  recordPlay: (track) => fetch(`${API}/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(track)
  }).catch(() => {}),

  streamUrl: (videoId) => `${API}/stream/${videoId}`,

  updateDiscordPresence: (data) =>
    fetch(`${API}/discord/presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).catch(() => {}),

  getLyrics: (title, artist) =>
    request(`/lyrics?title=${encodeURIComponent(title || '')}&artist=${encodeURIComponent(artist || '')}`)
};
