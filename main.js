const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const crypto = require('crypto');

// ─── Single Instance Lock ─────────────────────────────────────────────────────
// Prevents multiple Electron processes from spawning when context menu is used
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // Another instance is already running — pass our args to it and quit
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    // When the OS launches a second instance (e.g. via right-click), bring existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
    // Parse file path from argv (last arg that looks like a path)
    const fileArgs = argv.filter(a => !a.startsWith('-') && a !== '.' && (a.includes('\\') || a.includes('/')));
    if (argv.includes('--apply-tag')) {
      const tIdx = argv.indexOf('--apply-tag');
      const tagId = argv[tIdx + 1];
      const filePath = argv[argv.length - 1]; // Assume last arg is file
      if (tagId && filePath) {
        applyTagSilently(filePath, tagId);
        return;
      }
    }
    
    if (fileArgs.length > 0 && mainWindow) {
      mainWindow.webContents.send('open-tag-modal-for-files', fileArgs);
    }
  });
}

function applyTagSilently(filePath, tagId) {
  let db = loadDB();
  if (!db.fileTags[filePath]) db.fileTags[filePath] = [];
  if (!db.fileTags[filePath].includes(tagId)) {
    db.fileTags[filePath].push(tagId);
    saveDB(db);
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.reload();
    }
  }
}


// ─── Optimize Electron for Low Memory & Minimal Processes ──────────
// Disable hardware acceleration to eliminate the GPU process entirely
app.disableHardwareAcceleration();

// Disable site isolation to merge renderer processes where possible
app.commandLine.appendSwitch('disable-site-isolation-trials');

// Disable unnecessary Chromium features that spawn background threads/processes
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,WebRtcHideLocalIpsWithMdns,RendererCodeIntegrity,WinUseBrowserSpellChecker');

// Disable backgrounding when hidden (prevents weird memory paging issues)
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');


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
      fileTags: {}
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(defaults, null, 2));
    return defaults;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch {
    // Corrupt DB — return a fresh one without overwriting yet
    return { tagDefinitions: [], fileTags: {} };
  }
}

function saveDB(db) {
  ensureAppData();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function loadSettings() {
  ensureAppData();
  if (!fs.existsSync(SETTINGS_PATH)) {
    const defaults = {
      theme: 'default',
      clickSound: true,
      clickSoundVolume: 0.5
    };
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(defaults, null, 2));
    return defaults;
  }
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
  } catch {
    return { theme: 'default', clickSound: true, clickSoundVolume: 0.5 };
  }
}

function saveSettings(settings) {
  ensureAppData();;
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
      webSecurity: false,
      backgroundThrottling: false, // Prevents UI lag when window is in background
    },
    icon: path.join(__dirname, 'src', 'icon.png'),
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // Handle file arguments (for context menu integration)
    const args = process.argv;
    const fileArgs = args.filter(a => !a.startsWith('-') && a !== '.' && (a.includes('\\') || a.includes('/')));

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
  // Create a proper 16x16 tray icon — blue/indigo gradient (FileTagz brand, not orange)
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
  // 16x16 RGBA — deep blue to purple diagonal gradient (brand accurate)
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  const cx = 7.5, cy = 7.5, r = 7;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= r) {
        // Diagonal gradient: top-left = blue #0A84FF, bottom-right = purple #BF5AF2
        const t = (x + y) / (size * 2); // 0..1 diagonal
        const alpha = Math.round(255 * (1 - Math.max(0, (dist - r * 0.85) / (r * 0.15))));
        buf[i]     = Math.round(10  + t * (191 - 10));   // R: 10 → 191
        buf[i + 1] = Math.round(132 + t * (90  - 132));  // G: 132 → 90
        buf[i + 2] = Math.round(255 + t * (242 - 255));  // B: 255 → 242
        buf[i + 3] = alpha;
      } else {
        buf[i] = buf[i+1] = buf[i+2] = buf[i+3] = 0;
      }
    }
  }
  return buf;
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────
// Guard: only register once
let ipcRegistered = false;

function registerIPC() {
  if (ipcRegistered) return;
  ipcRegistered = true;

  // Window controls
  ipcMain.on('window:minimize', () => mainWindow && mainWindow.minimize());
  ipcMain.on('window:maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('window:close', () => mainWindow && mainWindow.close());

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

  // "Open with" — shows Windows "Open With" dialog
  ipcMain.handle('fs:openWith', (_, filePath) => {
    return new Promise(resolve => {
      // OpenAs_RunDLL fails if the path is wrapped in quotes
      exec(`rundll32.exe shell32.dll,OpenAs_RunDLL ${filePath}`, err => resolve(!err));
    });
  });

  ipcMain.handle('fs:exists', (_, filePath) => {
    try { return fs.existsSync(filePath); } catch { return false; }
  });

  ipcMain.handle('fs:getFileInfo', (_, filePath) => {
    try {
      // Use long-path prefix only on plain Win32 paths
      const longPath = (filePath.startsWith('\\\\?\\') || filePath.startsWith('\\\\.\\'))
        ? filePath
        : '\\\\?\\' + path.resolve(filePath);
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
    try {
      const files = fs.readdirSync(folderPath, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(folderPath, file.name);
        if (file.isDirectory()) {
          try { size += getFolderSize(fullPath); } catch {}
        } else {
          try { size += fs.statSync(fullPath).size; } catch {}
        }
      }
    } catch {}
    return size;
  }

  ipcMain.handle('fs:getFolderSize', (_, folderPath) => {
    try { return getFolderSize(folderPath); } catch { return 0; }
  });

  ipcMain.handle('fs:searchAll', async (_, query, taggedPaths) => {
    const results = [];
    const lowerQuery = query.toLowerCase();
    for (const p of taggedPaths) {
      if (p.toLowerCase().includes(lowerQuery)) {
        if (!results.includes(p)) results.push(p);
      }
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
      // Only return entries that ACTUALLY EXIST on disk right now
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      return entries
        .filter(e => {
          try {
            // Quick existence check — readdirSync already confirmed the entry exists
            // but the dirent might be a broken symlink or race-condition ghost
            const fullPath = path.join(dirPath, e.name);
            fs.lstatSync(fullPath); // throws if truly gone
            return true;
          } catch {
            return false;
          }
        })
        .map(e => ({
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

  // ─── Vault Helpers ──────────────────────────────────────────────────────────
  function pbkdf2Hash(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  }

  function setWinAttr(filePath, hide) {
    return new Promise(resolve => {
      const f = hide ? '+' : '-';
      exec(`attrib ${f}h ${f}s "${filePath}"`, err => resolve(!err));
    });
  }

  ipcMain.handle('vault:hasPassword',    ()       => !!(appSettings.vaultHash));
  ipcMain.handle('vault:setPassword',    (_, pwd) => {
    const salt = crypto.randomBytes(16).toString('hex');
    appSettings.vaultSalt = salt;
    appSettings.vaultHash = pbkdf2Hash(pwd, salt);
    saveSettings(appSettings);
    return true;
  });
  ipcMain.handle('vault:verify', (_, pwd) => {
    // Always read fresh from disk to avoid stale in-memory state
    try {
      const fresh = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
      if (!fresh.vaultHash) return false;
      const result = pbkdf2Hash(pwd, fresh.vaultSalt) === fresh.vaultHash;
      // Sync back to memory if they drifted
      if (result) {
        appSettings.vaultHash = fresh.vaultHash;
        appSettings.vaultSalt = fresh.vaultSalt;
      }
      return result;
    } catch {
      if (!appSettings.vaultHash) return false;
      return pbkdf2Hash(pwd, appSettings.vaultSalt) === appSettings.vaultHash;
    }
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

  // Vault forgot-password: Use net session (no UAC popup) then clear hash
  // The old approach (Start-Process RunAs) spawned a visible window and failed silently.
  // New approach: prompt user to confirm via a dialog, then clear.
  ipcMain.handle('vault:systemRecover', async () => {
    // Show a native confirmation dialog as the "authentication" step
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Vault Password Recovery',
      message: 'Reset Vault Password?',
      detail: 'This will clear your vault password. All hidden files will remain hidden until you reveal them manually.\n\nAre you sure you want to proceed?',
      buttons: ['Cancel', 'Reset Password'],
      defaultId: 0,
      cancelId: 0,
    });
    if (result.response === 1) {
      appSettings.vaultHash = null;
      appSettings.vaultSalt = null;
      saveSettings(appSettings);
      return true;
    }
    return false;
  });

  ipcMain.handle('util:openExternal', (_, url) => shell.openExternal(url));

  // Custom sound file path for click sounds
  ipcMain.handle('util:getSoundDataURL', (_, soundPath) => {
    try {
      if (!soundPath) return null;
      const data = fs.readFileSync(soundPath);
      const ext = path.extname(soundPath).toLowerCase().slice(1);
      const mimeMap = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4' };
      const mime = mimeMap[ext] || 'audio/wav';
      return `data:${mime};base64,${data.toString('base64')}`;
    } catch { return null; }
  });

  ipcMain.handle('util:pickSoundFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Click Sound',
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a'] }],
      properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
}

// ─── App Lifecycle ───────────────────────────────────────────────────────────
app.whenReady().then(() => {
  db = loadDB();
  appSettings = loadSettings();
  
  // Handle startup arguments
  if (process.argv.includes('--apply-tag')) {
    const tIdx = process.argv.indexOf('--apply-tag');
    const tagId = process.argv[tIdx + 1];
    const filePath = process.argv[process.argv.length - 1];
    if (tagId && filePath) {
      if (!db.fileTags[filePath]) db.fileTags[filePath] = [];
      if (!db.fileTags[filePath].includes(tagId)) {
        db.fileTags[filePath].push(tagId);
        saveDB(db);
      }
    }
  }

  registerIPC();
  createWindow();
  createTray();
  syncContextMenu();
});

// ─── Windows Context Menu Synchronization ────────────────────────────────────
function syncContextMenu() {
  if (process.platform !== 'win32') return;
  const scriptPath = path.join(APPDATA_DIR, 'sync_menu.ps1');
  const appPath = app.getAppPath();
  const exePath = process.execPath;
  
  const tags = db.tagDefinitions || [];
  
  let ps = `
$ErrorActionPreference = 'SilentlyContinue'
$fileKey = "HKCU:\\Software\\Classes\\*\\shell\\FileTagz"
$dirKey = "HKCU:\\Software\\Classes\\Directory\\shell\\FileTagz"

function CreateMenu($baseKey) {
    if (Test-Path $baseKey) { Remove-Item -Path $baseKey -Recurse -Force }
    New-Item -Path $baseKey -Force | Out-Null
    Set-ItemProperty -Path $baseKey -Name "MUIVerb" -Value "Tag with FileTagz"
    Set-ItemProperty -Path $baseKey -Name "Icon" -Value "$('${exePath}')"
    Set-ItemProperty -Path $baseKey -Name "ExtendedSubCommandsKey" -Value $null

    $shellKey = "$baseKey\\shell"
    New-Item -Path $shellKey -Force | Out-Null

    $openAppKey = "$shellKey\\open_app"
    New-Item -Path $openAppKey -Force | Out-Null
    Set-ItemProperty -Path $openAppKey -Name "MUIVerb" -Value "📂 Open in FileTagz"
    New-Item -Path "$openAppKey\\command" -Force | Out-Null
    Set-ItemProperty -Path "$openAppKey\\command" -Name "(default)" -Value "\\"${exePath}\\" \\"${appPath}\\" \\"%1\\""
    
    $sepKey = "$shellKey\\sep1"
    New-Item -Path $sepKey -Force | Out-Null
    Set-ItemProperty -Path $sepKey -Name "CommandFlags" -Value 0x20 -Type DWord
`;

  tags.forEach((tag, i) => {
    const verb = `${tag.icon} ${tag.name}`.replace(/"/g, '""');
    ps += `
    $tagKey${i} = "$shellKey\\tag_${tag.id}"
    New-Item -Path $tagKey${i} -Force | Out-Null
    Set-ItemProperty -Path $tagKey${i} -Name "MUIVerb" -Value "${verb}"
    New-Item -Path "$tagKey${i}\\command" -Force | Out-Null
    Set-ItemProperty -Path "$tagKey${i}\\command" -Name "(default)" -Value "\\"${exePath}\\" \\"${appPath}\\" --apply-tag \\"${tag.id}\\" \\"%1\\""
`;
  });

  ps += `
}

CreateMenu $fileKey
CreateMenu $dirKey
`;
  
  require('fs').writeFileSync(scriptPath, ps, 'utf-8');
  exec(`powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "${scriptPath}"`);
}


app.on('window-all-closed', () => {
  // Don't quit — stay in tray
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
  else mainWindow.show();
});
