"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const db = __importStar(require("./db.js"));
const bibleDb = __importStar(require("./bibleDb.js"));
const isDev = process.env.NODE_ENV !== 'production';
let mainWindow = null;
let projectorWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 920,
        minWidth: 1024,
        minHeight: 768,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        // mainWindow.webContents.openDevTools();
    }
    else {
        // In production, the executable is inside dist-electron/electron,
        // so we need to go up two levels to reach the root dist folder.
        mainWindow.loadFile(path_1.default.join(__dirname, '../../dist/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    return mainWindow;
}
electron_1.app.on('ready', () => {
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.ipcMain.handle('app:get-version', async () => {
    return electron_1.app.getVersion();
});
electron_1.ipcMain.handle('db:save-session', async (event, session) => {
    return db.saveSession(session);
});
electron_1.ipcMain.handle('db:save-live-state', async (event, liveState) => {
    return db.saveLiveState(liveState);
});
electron_1.ipcMain.handle('db:save-note', async (event, note) => {
    return db.saveNote(note);
});
electron_1.ipcMain.handle('db:get-notes', async (event, sessionId) => {
    return db.getNotes(sessionId);
});
electron_1.ipcMain.handle('db:get-live-state', async (event, sessionId) => {
    return db.getLiveState(sessionId);
});
electron_1.ipcMain.handle('db:get-session', async (event, sessionId) => {
    return db.getSession(sessionId);
});
// Advanced SQLite Handlers for Bible Data
electron_1.ipcMain.handle('db:search-bible', async (event, queryText, limit) => {
    return bibleDb.searchBibleQuotes(queryText, limit);
});
electron_1.ipcMain.handle('db:get-cross-references', async (event, book, chapter, verse, limit) => {
    return bibleDb.getCrossReferences(book, chapter, verse, limit);
});
// Professional Projector Auto-Launch (Like EasyWorship/ProPresenter)
electron_1.ipcMain.handle('app:open-projector', async () => {
    // Toggle Off: If it's already open, close it.
    if (projectorWindow) {
        projectorWindow.close();
        return false;
    }
    const displays = electron_1.screen.getAllDisplays();
    const externalDisplay = displays.find((display) => {
        return display.bounds.x !== 0 || display.bounds.y !== 0;
    });
    // Default to primary if no external found, but on external monitor bounds if found
    const bounds = externalDisplay ? externalDisplay.bounds : electron_1.screen.getPrimaryDisplay().bounds;
    projectorWindow = new electron_1.BrowserWindow({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        fullscreen: !!externalDisplay, // Fullscreen on the TV, normal window if only laptop
        autoHideMenuBar: true,
        backgroundColor: '#000000',
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });
    const urlPath = isDev ? 'http://localhost:5173?projector' : `file://${path_1.default.join(__dirname, '../dist/index.html?projector')}`;
    if (isDev) {
        projectorWindow.loadURL(urlPath);
    }
    else {
        // In production, the executable is inside dist-electron/electron,
        // so we need to go up two levels to reach the root dist folder.
        projectorWindow.loadFile(path_1.default.join(__dirname, '../../dist/index.html'), { query: { projector: 'true' } });
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
electron_1.ipcMain.handle('app:get-projector-status', async () => {
    return !!projectorWindow;
});
// Placeholder: could forward system settings, persistence API, offline sync and audio device info.
