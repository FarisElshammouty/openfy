const { app, BrowserWindow, shell, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const DEFAULT_PORT = 3001;
let serverPort = DEFAULT_PORT;
const PROTOCOL = 'openfy';
const logFile = path.join(app.getPath('userData'), 'openfy-debug.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
}

const origLog = console.log;
const origErr = console.error;
console.log = (...args) => { log(args.join(' ')); origLog(...args); };
console.error = (...args) => { log('ERROR: ' + args.join(' ')); origErr(...args); };

process.on('uncaughtException', err => { log(`UNCAUGHT: ${err.stack || err}`); });
process.on('unhandledRejection', err => { log(`UNHANDLED: ${err.stack || err}`); });

log('App starting');
log(`execPath: ${process.execPath}`);
log(`__dirname: ${__dirname}`);
log(`userData: ${app.getPath('userData')}`);
log(`argv: ${process.argv.join(' ')}`);

process.env.DB_PATH = path.join(app.getPath('userData'), 'openfy.db');
process.env.NODE_ENV = 'production';
process.env.PORT = String(DEFAULT_PORT);

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

let mainWindow;
let tray = null;
let deepLinkUrl = null;
let isQuitting = false;
let currentTrackInfo = null;

function createTrayIcon() {
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const cx = x - size / 2 + 0.5;
      const cy = y - size / 2 + 0.5;
      const dist = Math.sqrt(cx * cx + cy * cy);
      if (dist < size / 2 - 0.5) {
        canvas[i] = 0x1D;
        canvas[i + 1] = 0xB9;
        canvas[i + 2] = 0x54;
        canvas[i + 3] = 255;
      } else if (dist < size / 2 + 0.5) {
        const alpha = Math.max(0, Math.min(255, (size / 2 + 0.5 - dist) * 255));
        canvas[i] = 0x1D;
        canvas[i + 1] = 0xB9;
        canvas[i + 2] = 0x54;
        canvas[i + 3] = Math.round(alpha);
      }
    }
  }
  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

function updateTrayMenu() {
  if (!tray) return;
  const trackLabel = currentTrackInfo?.title
    ? `${currentTrackInfo.title} - ${currentTrackInfo.artist || 'Unknown'}`
    : 'Not playing';
  const playLabel = currentTrackInfo?.playing ? 'Pause' : 'Play';

  tray.setToolTip(currentTrackInfo?.title ? `Openfy - ${currentTrackInfo.title}` : 'Openfy');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: trackLabel, enabled: false },
    { type: 'separator' },
    { label: playLabel, click: () => mainWindow?.webContents.send('media-control', 'play-pause') },
    { label: 'Next', click: () => mainWindow?.webContents.send('media-control', 'next') },
    { label: 'Previous', click: () => mainWindow?.webContents.send('media-control', 'prev') },
    { type: 'separator' },
    { label: 'Show Openfy', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } }
  ]));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    title: 'Openfy',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  mainWindow.loadURL(`http://localhost:${serverPort}`);
  log('Window created, loading localhost:' + serverPort);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  if (deepLinkUrl) {
    handleDeepLink(deepLinkUrl);
    deepLinkUrl = null;
  }
}

function setupTray() {
  try {
    const icon = createTrayIcon();
    tray = new Tray(icon);
    tray.on('click', () => { mainWindow?.show(); mainWindow?.focus(); });
    updateTrayMenu();
    log('System tray created');
  } catch (err) {
    log(`Tray failed: ${err.message}`);
  }
}

function handleDeepLink(url) {
  if (!mainWindow) { deepLinkUrl = url; return; }
  try {
    const routePath = '/' + url.replace(/^openfy:\/\//, '');
    log('Deep link route: ' + routePath);
    if (routePath.startsWith('/play/')) {
      mainWindow.loadURL(`http://localhost:${serverPort}${routePath}`);
    }
  } catch {}
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// IPC: track info from renderer
ipcMain.on('track-info', (_event, info) => {
  currentTrackInfo = info;
  updateTrayMenu();
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  log('Another instance running, quitting');
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    const url = commandLine.find(arg => arg.startsWith(`${PROTOCOL}://`));
    if (url) handleDeepLink(url);
    else if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    log('app.whenReady fired');

    const protocolArg = process.argv.find(arg => arg.startsWith(`${PROTOCOL}://`));
    if (protocolArg) deepLinkUrl = protocolArg;

    try {
      log('Importing server...');
      const { serverReady } = await import('../server/index.js');
      log('Server module imported, waiting for ready...');
      const actualPort = await serverReady;
      if (actualPort) serverPort = actualPort;
      log('Server ready on port ' + serverPort);
      createWindow();
      setupTray();
    } catch (err) {
      log(`Server failed: ${err.stack || err}`);
      const { dialog } = require('electron');
      dialog.showErrorBox('Openfy', `Failed to start: ${err.message}\n\nIf another Openfy instance is running, close it and try again.`);
      app.quit();
    }
  });
}

app.on('window-all-closed', () => {
  if (isQuitting) app.quit();
});

app.on('before-quit', () => { isQuitting = true; });
