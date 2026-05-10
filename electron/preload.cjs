const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onMediaControl: (callback) => {
    ipcRenderer.on('media-control', (_event, action) => callback(action));
  },
  sendTrackInfo: (info) => {
    ipcRenderer.send('track-info', info);
  },
  enterMiniPlayer: () => ipcRenderer.send('mini-player', 'enter'),
  exitMiniPlayer: () => ipcRenderer.send('mini-player', 'exit')
});
