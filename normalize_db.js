const fs = require('fs');
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'FileTagz', 'tags.json');

if (fs.existsSync(dbPath)) {
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const newFileTags = {};
    
    for (const rawPath in db.fileTags) {
        // Normalize path: remove quadruple slashes, collapse multiple slashes
        const normalized = rawPath.replace(/\\\\/g, '\\');
        newFileTags[normalized] = db.fileTags[rawPath];
    }
    
    db.fileTags = newFileTags;
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    console.log('Normalized tags.json');
} else {
    console.log('tags.json not found at', dbPath);
}
