const fs = require('fs');
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'FileTagz', 'tags.json');

const validDB = {
  "tagDefinitions": [
    { "id": "red",    "name": "Urgent",    "color": "#FF3B5C", "icon": "🔴" },
    { "id": "orange", "name": "Review",    "color": "#FF9F0A", "icon": "🟠" },
    { "id": "yellow", "name": "Later",     "color": "#FFD60A", "icon": "🟡" },
    { "id": "green",  "name": "Done",      "color": "#30D158", "icon": "🟢" },
    { "id": "blue",   "name": "Work",      "color": "#0A84FF", "icon": "🔵" },
    { "id": "purple", "name": "Personal",  "color": "#BF5AF2", "icon": "🟣" },
    { "id": "pink",   "name": "Important", "color": "#FF6482", "icon": "💗" },
    { "id": "gray",   "name": "Archive",   "color": "#8E8E93", "icon": "⚫" },
    { "id": "movies", "name": "Movies",    "color": "#0a84ff", "icon": "🌟" }
  ],
  "fileTags": {
    "C:\\Users\\vardh\\Downloads\\Comick": ["blue"],
    "C:\\Users\\vardh\\Downloads\\COLLEGE": ["purple"],
    "C:\\Users\\vardh\\Downloads\\Heat 1995 Directors Cut Remastered BluRay 1080p HEVC x265 5.1 BONE.mkv": ["movies"],
    "C:\\Users\\vardh\\Downloads\\COLLEGE\\AYAAN VARDHA-RESUME-NEW-1.docx": ["green"]
  }
};

fs.writeFileSync(dbPath, JSON.stringify(validDB, null, 2), 'utf8');
console.log('Fixed tags.json corruption');
