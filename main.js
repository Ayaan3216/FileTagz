const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const crypto = require('crypto');

// ─── Tag Store ───────────────────────────────────────────────────────────────
const APPDATA_DIR = path.join(app.getPath('appData'), 'FileTagz');
const DB_PATH = path.join(APPDATA_DIR, 'tags.json');
const SETTINGS_PATH = path.join(APPDATA_DIR, 'settings.json');

function ensureAppData() {
  if (!fs.existsSync(APPDATA_DIR)) fs.mkdirSync(APPDATA_DIR, { recursive: true });
}

function loadDB() {
  ensureAppData();
  if (!fs.existsSync(DB_PATH)) {
    const defaults = {
      tagDefinitions: [
        { id: 'red',    name: 'Urgent',    color: '#FF3B5C', icon: '🔴' },
        { id: 'orange', name: 'Review',    color: '#FF9F0A', icon: '🟠' },
        { id: 'yellow', name: 'Later',     color: '#FFD60A', icon: '🟡' },
        { id: 'green',  name: 'Done',      color: '#30D158', icon: '🟢' },
        { id: 'blue',   name: 'Work',      color: '#0A84FF', icon: '🔵' },
        { id: 'purple', name: 'Personal',  color: '#BF5AF2', icon: '🟣' },
        { id: 'pink',   name: 'Important', color: '#FF6482', icon: '💗' },
        { id: 'gray',   name: 'Archive',   color: '#8E8E93', icon: '⚫' },
      ],
      fileTags: {}  // { "C:\\path\\to\\file.txt": ["red", "blue"], ... }
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(defaults, null, 2));
    return defaults;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function saveDB(db) {
  ensureAppData();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function loadSettings() {
  ensureAppData();
  if (!fs.existsSync(SETTINGS_PATH)) {
    const defaults = { theme: 'default' };
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(defaults, null, 2));
    return defaults;
  }
  return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
}

function saveSettings(settings) {
  ensureAppData();
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

let db = null;
let appSettings = null;

// ─── Window ──────────────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 550,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    },
    icon: path.join(__dirname, 'src', 'icon.png'),
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Handle file arguments (for context menu integration)
    // In dev, args might be ['node', 'electron', '.', 'path/to/file']
    // In prod, args might be ['FileTagz.exe', 'path/to/file']
    const args = process.argv;
    const fileArgs = args.filter(arg => !arg.startsWith('-') && arg !== '.' && arg.includes('\\'));
    
    if (fileArgs.length > 0) {
        mainWindow.webContents.send('open-tag-modal-for-files', fileArgs);
    }
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  // Create a 16x16 tray icon programmatically
  const trayIcon = nativeImage.createFromBuffer(createTrayIconBuffer(), { width: 16, height: 16 });
  
  tray = new Tray(trayIcon);
  tray.setToolTip('FileTagz — File Color Tags');
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open FileTagz', click: () => { mainWindow.show(); mainWindow.focus(); }},
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuiting = true; app.quit(); }}
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus(); });
}

function createTrayIconBuffer() {
  // Create a simple 16x16 RGBA buffer with a gradient dot
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  const cx = 7.5, cy = 7.5, r = 7;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= r) {
        const t = dist / r;
        buf[i]     = Math.round(10 + t * 50);   // R
        buf[i + 1] = Math.round(132 + t * 20);  // G
        buf[i + 2] = Math.round(255 - t * 30);  // B
        buf[i + 3] = Math.round(255 * (1 - t * 0.3)); // A
      } else {
        buf[i] = buf[i+1] = buf[i+2] = buf[i+3] = 0;
      }
    }
  }
  return buf;
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

// Window controls
ipcMain.on('window:minimize', () => mainWindow.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window:close', () => mainWindow.close());

// Tag definitions
ipcMain.handle('tags:getDefinitions', () => db.tagDefinitions);
ipcMain.handle('tags:updateDefinition', (_, tagDef) => {
  const idx = db.tagDefinitions.findIndex(t => t.id === tagDef.id);
  if (idx >= 0) db.tagDefinitions[idx] = tagDef;
  saveDB(db);
  return db.tagDefinitions;
});
ipcMain.handle('tags:createDefinition', (_, tagDef) => {
  db.tagDefinitions.push(tagDef);
  saveDB(db);
  return db.tagDefinitions;
});
ipcMain.handle('tags:deleteDefinition', (_, tagId) => {
  db.tagDefinitions = db.tagDefinitions.filter(t => t.id !== tagId);
  // Also remove this tag from all files
  for (const filePath in db.fileTags) {
      db.fileTags[filePath] = db.fileTags[filePath].filter(t => t !== tagId);
      if (db.fileTags[filePath].length === 0) delete db.fileTags[filePath];
  }
  saveDB(db);
  return db.tagDefinitions;
});

// File tags
ipcMain.handle('tags:getFileTags', () => db.fileTags);
ipcMain.handle('tags:setFileTag', (_, filePath, tagId) => {
  if (!db.fileTags[filePath]) db.fileTags[filePath] = [];
  if (!db.fileTags[filePath].includes(tagId)) {
    db.fileTags[filePath].push(tagId);
  }
  saveDB(db);
  return db.fileTags;
});
ipcMain.handle('tags:removeFileTag', (_, filePath, tagId) => {
  if (db.fileTags[filePath]) {
    db.fileTags[filePath] = db.fileTags[filePath].filter(t => t !== tagId);
    if (db.fileTags[filePath].length === 0) delete db.fileTags[filePath];
  }
  saveDB(db);
  return db.fileTags;
});
ipcMain.handle('tags:removeAllFileTags', (_, filePath) => {
  if (db.fileTags[filePath]) delete db.fileTags[filePath];
  saveDB(db);
  return db.fileTags;
});

// Settings
ipcMain.handle('settings:get', () => appSettings);
ipcMain.handle('settings:set', (_, newSettings) => {
  appSettings = { ...appSettings, ...newSettings };
  saveSettings(appSettings);
  return appSettings;
});

// File system
ipcMain.handle('fs:pickFiles', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    title: 'Select files to tag'
  });
  return result.filePaths;
});

ipcMain.handle('fs:pickFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select folder to tag'
  });
  return result.filePaths;
});

ipcMain.handle('fs:openInExplorer', (_, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle('fs:openPath', async (_, filePath) => {
  await shell.openPath(filePath);
});

ipcMain.handle('fs:getFileInfo', (_, filePath) => {
  try {
    const longPath = filePath.startsWith('\\\\?\\') || filePath.startsWith('\\\\.\\') ? filePath : '\\\\?\\' + path.resolve(filePath);
    const stats = fs.statSync(longPath);
    return {
      name: path.basename(filePath),
      dir: path.dirname(filePath),
      ext: path.extname(filePath),
      size: stats.size,
      modified: stats.mtime.toISOString(),
      isDirectory: stats.isDirectory(),
      exists: true,
    };
  } catch (e) {
    return { exists: false, name: path.basename(filePath), dir: path.dirname(filePath), error: e.message };
  }
});

ipcMain.handle('fs:getFileIcon', async (_, filePath) => {
  try {
    const icon = await app.getFileIcon(filePath, { size: 'normal' });
    return icon.toDataURL();
  } catch {
    return null;
  }
});

function getFolderSize(folderPath) {
  let size = 0;
  const files = fs.readdirSync(folderPath, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(folderPath, file.name);
    if (file.isDirectory()) {
      try { size += getFolderSize(fullPath); } catch {}
    } else {
      try { size += fs.statSync(fullPath).size; } catch {}
    }
  }
  return size;
}

ipcMain.handle('fs:getFolderSize', (_, folderPath) => {
  try { return getFolderSize(folderPath); } catch { return 0; }
});

async function searchRecursive(dirPath, query, results, limit = 100) {
    if (results.length >= limit) return;
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.name.toLowerCase().includes(query)) {
                results.push(fullPath);
            }
            if (entry.isDirectory() && results.length < limit) {
                await searchRecursive(fullPath, query, results, limit);
            }
            if (results.length >= limit) break;
        }
    } catch {}
}

ipcMain.handle('fs:searchAll', async (_, query, taggedPaths) => {
    const results = [];
    const lowerQuery = query.toLowerCase();
    for (const p of taggedPaths) {
        if (p.toLowerCase().includes(lowerQuery)) {
            if (!results.includes(p)) results.push(p);
        }
        // If it's a directory, search inside
        try {
            if (fs.statSync(p).isDirectory()) {
                await searchRecursive(p, lowerQuery, results);
            }
        } catch {}
    }
    return results;
});

ipcMain.handle('fs:getFileText', (_, filePath) => {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(2000);
    const bytesRead = fs.readSync(fd, buffer, 0, 2000, 0);
    fs.closeSync(fd);
    return buffer.toString('utf8', 0, bytesRead);
  } catch { return null; }
});

ipcMain.handle('fs:readDir', (_, dirPath) => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.map(e => ({
      name: e.name,
      path: path.join(dirPath, e.name),
      isDirectory: e.isDirectory(),
    }));
  } catch {
    return [];
  }
});

ipcMain.handle('fs:trashItem', async (_, filePath) => {
  try {
    await shell.trashItem(filePath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('fs:deleteItem', (_, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      fs.rmSync(filePath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(filePath);
    }
    return true;
  } catch {
    return false;
  }
});

// ─── Vault Helpers ───────────────────────────────────────────────────────────
function pbkdf2Hash(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

function setWinAttr(filePath, hide) {
  return new Promise(resolve => {
    const f = hide ? '+' : '-';
    // +h hides from Explorer; +s (system) hides even when 'show hidden files' is ON
    exec(`attrib ${f}h ${f}s "${filePath}"`, err => resolve(!err));
  });
}

ipcMain.handle('vault:hasPassword',    ()           => !!(appSettings.vaultHash));
ipcMain.handle('vault:setPassword',    (_, pwd)     => {
  const salt = crypto.randomBytes(16).toString('hex');
  appSettings.vaultSalt = salt;
  appSettings.vaultHash = pbkdf2Hash(pwd, salt);
  saveSettings(appSettings);
  return true;
});
ipcMain.handle('vault:verify',         (_, pwd)     => {
  if (!appSettings.vaultHash) return false;
  return pbkdf2Hash(pwd, appSettings.vaultSalt) === appSettings.vaultHash;
});
ipcMain.handle('vault:changePassword', (_, old, nw) => {
  if (!appSettings.vaultHash) return { ok: false, msg: 'No password set' };
  if (pbkdf2Hash(old, appSettings.vaultSalt) !== appSettings.vaultHash)
    return { ok: false, msg: 'Incorrect current password' };
  const salt = crypto.randomBytes(16).toString('hex');
  appSettings.vaultSalt = salt;
  appSettings.vaultHash = pbkdf2Hash(nw, salt);
  saveSettings(appSettings);
  return { ok: true };
});
ipcMain.handle('vault:hideFile',   async (_, fp) => setWinAttr(fp, true));
ipcMain.handle('vault:revealFile', async (_, fp) => setWinAttr(fp, false));
ipcMain.handle('vault:systemRecover', () => new Promise(resolve => {
  // Spawns a UAC elevation prompt — success means user is authenticated as admin
  exec(
    'powershell -Command "Start-Process cmd -Verb RunAs -ArgumentList \'/c exit 0\' -WindowStyle Hidden -Wait"',
    err => {
      if (!err) {
        appSettings.vaultHash = null;
        appSettings.vaultSalt = null;
        saveSettings(appSettings);
        resolve(true);
      } else {
        resolve(false);
      }
    }
  );
}));
ipcMain.handle('util:openExternal', (_, url) => shell.openExternal(url));

// ─── App Lifecycle ───────────────────────────────────────────────────────────
app.whenReady().then(() => {
  db = loadDB();
  appSettings = loadSettings();
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  // Don't quit — stay in tray
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
  else mainWindow.show();
});
