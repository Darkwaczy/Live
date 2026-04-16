import { app, BrowserWindow, dialog, ipcMain, screen, shell } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import Store from 'electron-store';
import * as db from './db.js';
import * as bibleDb from './bibleDb.js';
import { SidecarManager } from './sidecar.js';

const isDev = !app.isPackaged;
const execAsync = promisify(exec);
const appStore = new Store();
const N_ATLAS_BINARY_NAME = 'n-atlas-service.exe';
const N_ATLAS_PROMPT_VERSION_KEY = 'nAtlas.promptDismissedForVersion';

type NAtlasDownloadState = {
  inProgress: boolean;
  progress: number | null;
  error: string | null;
};

let nAtlasDownloadState: NAtlasDownloadState = {
  inProgress: false,
  progress: null,
  error: null
};

let mainWindow: BrowserWindow | null = null;
let projectorWindow: BrowserWindow | null = null;

function getPackageJson(): any {
  try {
    const packageJsonPath = path.join(app.getAppPath(), 'package.json');
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  } catch {
    return {};
  }
}

function getConfiguredNAtlasDownloadUrl(): string {
  const pkg = getPackageJson();
  return (
    process.env.N_ATLAS_DOWNLOAD_URL ||
    process.env.VITE_N_ATLAS_DOWNLOAD_URL ||
    pkg?.sermonSync?.nAtlasDownloadUrl ||
    ''
  ).trim();
}

function getNAtlasInstallDir(): string {
  return path.join(app.getPath('userData'), 'addons', 'n-atlas');
}

function getNAtlasExecutablePath(): string {
  return path.join(getNAtlasInstallDir(), N_ATLAS_BINARY_NAME);
}

function isNAtlasInstalled(): boolean {
  return fs.existsSync(getNAtlasExecutablePath());
}

function clearNAtlasProgressBar() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setProgressBar(-1);
  }
}

function setNAtlasProgressBar(progress: number) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setProgressBar(progress);
  }
}

function downloadFileToPath(url: string, destination: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transport = url.startsWith('https:') ? https : http;
    const request = transport.get(url, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.resume();
        downloadFileToPath(response.headers.location, destination).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Download failed with status ${response.statusCode}`));
        return;
      }

      const totalBytes = Number(response.headers['content-length'] || 0);
      let downloadedBytes = 0;
      const file = fs.createWriteStream(destination);

      response.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0) {
          const ratio = downloadedBytes / totalBytes;
          nAtlasDownloadState.progress = Math.round(ratio * 100);
          setNAtlasProgressBar(ratio);
        }
      });

      response.on('error', (error) => {
        file.destroy();
        reject(error);
      });

      file.on('error', (error) => {
        response.destroy(error);
        reject(error);
      });

      file.on('finish', () => {
        file.close(() => resolve());
      });

      response.pipe(file);
    });

    request.on('error', reject);
  });
}

async function installNAtlasAddon(): Promise<{ success: boolean; error?: string }> {
  if (nAtlasDownloadState.inProgress) {
    return { success: false, error: 'N-ATLAS download is already in progress.' };
  }

  const downloadUrl = getConfiguredNAtlasDownloadUrl();
  if (!downloadUrl) {
    return { success: false, error: 'N-ATLAS download URL is not configured.' };
  }

  const installDir = getNAtlasInstallDir();
  const tempPath = path.join(installDir, `${N_ATLAS_BINARY_NAME}.download`);
  const finalPath = getNAtlasExecutablePath();

  nAtlasDownloadState = {
    inProgress: true,
    progress: 0,
    error: null
  };
  setNAtlasProgressBar(0);

  try {
    fs.mkdirSync(installDir, { recursive: true });
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    await downloadFileToPath(downloadUrl, tempPath);

    if (fs.existsSync(finalPath)) {
      fs.unlinkSync(finalPath);
    }
    fs.renameSync(tempPath, finalPath);

    nAtlasDownloadState = {
      inProgress: false,
      progress: 100,
      error: null
    };
    clearNAtlasProgressBar();
    await SidecarManager.getInstance().startAll();
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown download error';
    nAtlasDownloadState = {
      inProgress: false,
      progress: null,
      error: message
    };
    clearNAtlasProgressBar();
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    return { success: false, error: message };
  }
}

async function promptForNAtlasDownload() {
  if (isDev || !mainWindow || isNAtlasInstalled()) return;

  const downloadUrl = getConfiguredNAtlasDownloadUrl();
  if (!downloadUrl) {
    console.warn('[Main] N-ATLAS prompt skipped because no download URL is configured.');
    return;
  }

  const dismissedForVersion = appStore.get(N_ATLAS_PROMPT_VERSION_KEY);
  if (dismissedForVersion === app.getVersion()) {
    return;
  }

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    buttons: ['Download N-ATLAS', 'Later'],
    defaultId: 0,
    cancelId: 1,
    title: 'Install N-ATLAS',
    message: 'N-ATLAS is available as an optional add-on.',
    detail:
      'Download the Nigerian English offline transcription engine now? You can still use SermonSync without it, and install it later.',
    noLink: true
  });

  if (response !== 0) {
    appStore.set(N_ATLAS_PROMPT_VERSION_KEY, app.getVersion());
    return;
  }

  const result = await installNAtlasAddon();
  if (result.success) {
    appStore.delete(N_ATLAS_PROMPT_VERSION_KEY);
    await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'N-ATLAS Installed',
      message: 'N-ATLAS was downloaded successfully.',
      detail: 'The local Nigerian English transcription engine is now ready to use.'
    });
  } else {
    await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'N-ATLAS Download Failed',
      message: 'SermonSync could not download N-ATLAS.',
      detail: result.error || 'Unknown download error.'
    });
  }
}

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

  mainWindow.webContents.once('did-finish-load', () => {
    promptForNAtlasDownload().catch((error) => {
      console.error('[Main] Failed to prompt for N-ATLAS download', error);
    });
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

ipcMain.handle('app:get-natlas-status', async () => {
  return {
    installed: isNAtlasInstalled(),
    downloadConfigured: !!getConfiguredNAtlasDownloadUrl(),
    ...nAtlasDownloadState
  };
});

ipcMain.handle('app:install-natlas', async () => {
  return installNAtlasAddon();
});


// Placeholder: could forward system settings, persistence API, offline sync and audio device info.
