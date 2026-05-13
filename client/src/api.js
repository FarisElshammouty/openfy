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
  searchArtists: (q) => request(`/search/artists?q=${encodeURIComponent(q)}`),
  searchAlbums: (q) => request(`/search/albums?q=${encodeURIComponent(q)}`),
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
  reorderPlaylist: (pid, videoIds) =>
    request(`/playlists/${pid}/reorder`, { method: 'PUT', body: JSON.stringify({ videoIds }) }),

  getLiked: () => request('/liked'),
  likeSong: (track) => request('/liked', { method: 'POST', body: JSON.stringify(track) }),
  unlikeSong: (videoId) => request(`/liked/${videoId}`, { method: 'DELETE' }),

  getArtist: (id) => request(`/artist/${id}`),
  getAlbum: (id) => request(`/album/${id}`),
  getSavedAlbums: () => request('/saved-albums'),
  saveAlbum: (album) => request('/saved-albums', { method: 'POST', body: JSON.stringify(album) }),
  unsaveAlbum: (id) => request(`/saved-albums/${id}`, { method: 'DELETE' }),

  getSmartPlaylists: () => request('/smart-playlists'),
  createSmartPlaylist: (name, rules) => request('/smart-playlists', { method: 'POST', body: JSON.stringify({ name, rules }) }),
  deleteSmartPlaylist: (id) => request(`/smart-playlists/${id}`, { method: 'DELETE' }),
  getSmartPlaylistTracks: (id) => request(`/smart-playlists/${id}/tracks`),
  getHistory: () => request('/history'),
  getStats: () => request('/stats'),
  getMixes: () => request('/mixes'),
  clearHistory: () => request('/history', { method: 'DELETE' }),
  getRecentSearches: () => request('/recent-searches'),
  saveRecentSearch: (query) => fetch(`${API}/recent-searches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  }).catch(() => {}),
  clearRecentSearches: () => request('/recent-searches', { method: 'DELETE' }),
  imgProxyUrl: (url) => `${API}/img-proxy?url=${encodeURIComponent(url)}`,
  importPlaylist: (url) => request('/import-playlist', { method: 'POST', body: JSON.stringify({ url }) }),
  importTracklist: (name, text) => request('/import-tracklist', { method: 'POST', body: JSON.stringify({ name, text }) }),
  recordPlay: (track) => fetch(`${API}/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(track)
  }).catch(() => {}),

  streamUrl: (videoId) => `${API}/stream/${videoId}`,
  resolveAlternate: (videoId) => request(`/resolve-alternate/${videoId}`),

  updateDiscordPresence: (data) =>
    fetch(`${API}/discord/presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).catch(() => {}),

  getLyrics: (title, artist) =>
    request(`/lyrics?title=${encodeURIComponent(title || '')}&artist=${encodeURIComponent(artist || '')}`),
  translate: (text, target) => request('/translate', { method: 'POST', body: JSON.stringify({ text, target }) })
};
