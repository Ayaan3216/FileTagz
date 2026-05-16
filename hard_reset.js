const fs = require('fs');
const path = require('path');
const os = require('os');

const dbDir = path.join(os.homedir(), 'AppData', 'Roaming', 'FileTagz');
const dbPath = path.join(dbDir, 'tags.json');
const settingsPath = path.join(dbDir, 'settings.json');

if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const cleanDB = {
  "tagDefinitions": [
    { "id": "red",    "name": "Urgent",    "color": "#FF3B5C", "icon": "\uD83D\uDD34" },
    { "id": "orange", "name": "Review",    "color": "#FF9F0A", "icon": "\uD83D\uDFE0" },
    { "id": "yellow", "name": "Later",     "color": "#FFD60A", "icon": "\uD83D\uDFF1" },
    { "id": "green",  "name": "Done",      "color": "#30D158", "icon": "\uD83D\uDFE2" },
    { "id": "blue",   "name": "Work",      "color": "#0A84FF", "icon": "\uD83D\uDD35" },
    { "id": "purple", "name": "Personal",  "color": "#BF5AF2", "icon": "\uD83D\uDFEA" },
    { "id": "pink",   "name": "Important", "color": "#FF6482", "icon": "\uD83D\uDC97" },
    { "id": "gray",   "name": "Archive",   "color": "#8E8E93", "icon": "\u26AB" }
  ],
  "fileTags": {
    "C:\\Users\\vardh\\Downloads\\Comick": ["blue"],
    "C:\\Users\\vardh\\Downloads\\COLLEGE": ["purple"]
  }
};

const cleanSettings = { "theme": "midnight", "vaultPasswordHash": null };

fs.writeFileSync(dbPath, JSON.stringify(cleanDB, null, 2), 'utf8');
fs.writeFileSync(settingsPath, JSON.stringify(cleanSettings, null, 2), 'utf8');

console.log('Database and Settings have been HARD RESET to clean UTF-8 states.');
