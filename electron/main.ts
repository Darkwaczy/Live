import { app, BrowserWindow, ipcMain, screen } from 'electron';
import path from 'path';
import * as db from './db.js';


const isDev = process.env.NODE_ENV !== 'production';

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 920,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  return win;
}

app.on('ready', () => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('app:get-version', async () => {
  return app.getVersion();
});

ipcMain.handle('db:save-session', async (event, session) => {
  return db.saveSession(session);
});

ipcMain.handle('db:save-live-state', async (event, liveState) => {
  return db.saveLiveState(liveState);
});

ipcMain.handle('db:save-note', async (event, note) => {
  return db.saveNote(note);
});

ipcMain.handle('db:get-notes', async (event, sessionId) => {
  return db.getNotes(sessionId);
});

ipcMain.handle('db:get-live-state', async (event, sessionId) => {
  return db.getLiveState(sessionId);
});

ipcMain.handle('db:get-session', async (event, sessionId) => {
  return db.getSession(sessionId);
});

// Professional Projector Auto-Launch (Like EasyWorship/ProPresenter)
ipcMain.handle('app:open-projector', async () => {
  const displays = screen.getAllDisplays();
  const externalDisplay = displays.find((display) => {
    return display.bounds.x !== 0 || display.bounds.y !== 0;
  });

  // Default to primary if no external found, but on external monitor bounds if found
  const bounds = externalDisplay ? externalDisplay.bounds : screen.getPrimaryDisplay().bounds;

  const projectorWin = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    fullscreen: !!externalDisplay, // Fullscreen on the TV, normal window if only laptop
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const urlPath = isDev ? 'http://localhost:5173?projector' : `file://${path.join(__dirname, '../dist/index.html?projector')}`;
  
  if (isDev) {
    projectorWin.loadURL(urlPath);
  } else {
    // In production, we need to handle the query param for a local file
    projectorWin.loadFile(path.join(__dirname, '../dist/index.html'), { query: { projector: 'true' } });
  }

  return true;
});


// Placeholder: could forward system settings, persistence API, offline sync and audio device info.
