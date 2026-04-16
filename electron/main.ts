import { app, BrowserWindow, ipcMain, screen, shell } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import * as db from './db.js';
import * as bibleDb from './bibleDb.js';
import { SidecarManager } from './sidecar.js';


const isDev = process.env.NODE_ENV !== 'production';

let mainWindow: BrowserWindow | null = null;
let projectorWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
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
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    // In production, the executable is inside dist-electron/electron,
    // so we need to go up two levels to reach the root dist folder.
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

app.on('ready', () => {
  createWindow();
  
  // Start all sidecars (N-ATLAS and NDI Broadcast)
  SidecarManager.getInstance().startAll().catch(err => {
    console.error('[Main] Failed to start sidecars:', err);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  SidecarManager.getInstance().stopAll();
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

// Advanced SQLite Handlers for Bible Data
ipcMain.handle('db:search-bible', async (event, queryText, limit) => {
  return bibleDb.searchBibleQuotes(queryText, limit);
});

ipcMain.handle('db:get-cross-references', async (event, book, chapter, verse, limit) => {
  return bibleDb.getCrossReferences(book, chapter, verse, limit);
});

// Professional Projector Auto-Launch (Like EasyWorship/ProPresenter)
ipcMain.handle('app:open-projector', async () => {
  // Toggle Off: If it's already open, close it.
  if (projectorWindow) {
    projectorWindow.close();
    return false;
  }

  const displays = screen.getAllDisplays();
  const externalDisplay = displays.find((display) => {
    return display.bounds.x !== 0 || display.bounds.y !== 0;
  });

  // Default to primary if no external found, but on external monitor bounds if found
  const bounds = externalDisplay ? externalDisplay.bounds : screen.getPrimaryDisplay().bounds;

  projectorWindow = new BrowserWindow({
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
    projectorWindow.loadURL(urlPath);
  } else {
    // In production, the executable is inside dist-electron/electron,
    // so we need to go up two levels to reach the root dist folder.
    projectorWindow.loadFile(path.join(__dirname, '../../dist/index.html'), { query: { projector: 'true' } });
  }

  // Notify the renderer that the projector is open
  if (mainWindow) {
    mainWindow.webContents.send('projector-status-changed', true);
  }

  projectorWindow.on('closed', () => {
    projectorWindow = null;
    // Notify the renderer that the projector is closed
    if (mainWindow) {
      mainWindow.webContents.send('projector-status-changed', false);
    }
  });

  return true;
});

ipcMain.handle('app:get-projector-status', async () => {
  return !!projectorWindow;
});

const execAsync = promisify(exec);

ipcMain.handle('app:check-ndi-runtime', async () => {
  // Common paths for NDI 5/6 Runtime
  const paths = [
    'C:\\Windows\\System32\\Processing.NDI.Lib.x64.dll',
    'C:\\Program Files\\NDI\\NDI 5 Runtime\\v5\\Processing.NDI.Lib.x64.dll',
    'C:\\Program Files\\NDI\\NDI 6 Runtime\\v6\\Processing.NDI.Lib.x64.dll'
  ];
  
  return paths.some(p => fs.existsSync(p));
});

ipcMain.handle('app:install-ndi-runtime', async () => {
  try {
    // Try winget first as it's the most reliable "silent" way on Windows
    // ID for NDI Runtime is often NewTek.NDI
    console.log('[Main] Attempting NDI install via winget...');
    await execAsync('winget install --id NewTek.NDI -e --source winget --accept-package-agreements --accept-source-agreements');
    return { success: true };
  } catch (error) {
    console.error('[Main] Winget install failed, opening direct download link', error);
    // Fallback: Open the NDI download page
    shell.openExternal('https://ndi.video/download-ndi/');
    return { success: false, manual: true };
  }
});


// Placeholder: could forward system settings, persistence API, offline sync and audio device info.
