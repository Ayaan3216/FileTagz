// State
let tagDefinitions = [];
let fileTags = {}; // { filePath: ['tagId1', ...] }
let filesInfo = {}; // Cache for file stats: { filePath: { name, dir, ... } }
let currentFilter = 'all'; // 'all', tagId, or VAULT_TAG_ID
let currentSearch = '';
let selectedFilePath = null;
let currentFolderPath = null; // Used when browsing inside a folder
let folderHistory = []; // Stack of previous folder paths

// Vault state
const VAULT_TAG_ID = '__vault__';
const VAULT_TAG = { id: VAULT_TAG_ID, name: 'Hidden', color: '#9D4EDD', icon: '\ud83d\udd12' };
let vaultUnlocked = false;       // true only after correct password in this session
let vaultPendingFiles = [];      // files queued to hide while setup modal is open

// DOM Elements
const tagNav = document.getElementById('tag-nav');
const countAll = document.getElementById('count-all');
const fileGrid = document.getElementById('file-grid');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const viewTitle = document.getElementById('view-title');
const viewSubtitle = document.getElementById('view-subtitle');
const btnBackFolder = document.getElementById('btn-back-folder');

// Detail Panel
const detailPanel = document.getElementById('detail-panel');
const detailFilename = document.getElementById('detail-filename');
const detailPath = document.getElementById('detail-path');
const detailPreview = document.getElementById('detail-preview');
const detailSize = document.getElementById('detail-size');
const detailModified = document.getElementById('detail-modified');
const detailType = document.getElementById('detail-type');
const detailTags = document.getElementById('detail-tags');
const btnCloseDetail = document.getElementById('btn-close-detail');
const btnBrowseFolder = document.getElementById('btn-browse-folder');
const detailResizer = document.getElementById('detail-resizer');
const btnOpenExplorer = document.getElementById('btn-open-explorer');
const btnOpenFile = document.getElementById('btn-open-file');
const btnRemoveAllTags = document.getElementById('btn-remove-all-tags');

// Settings Modal
const settingsModal = document.getElementById('settings-modal');
const settingsTagList = document.getElementById('settings-tag-list');
const settingsClose = document.getElementById('settings-close');
const btnSettings = document.getElementById('btn-settings');
const newTagIcon = document.getElementById('new-tag-icon');
const newTagName = document.getElementById('new-tag-name');
const newTagColor = document.getElementById('new-tag-color');
const btnCreateTag = document.getElementById('btn-create-tag');
const themeSelect = document.getElementById('theme-select');

// Modal
const tagModal = document.getElementById('tag-modal');
const modalFileName = document.getElementById('modal-file-name');
const modalTagGrid = document.getElementById('modal-tag-grid');
const modalCancel = document.getElementById('modal-cancel');
const modalDone = document.getElementById('modal-done');
let filesToTag = []; // For the modal
let tempSelectedTags = new Set(); // Tags selected in the modal

// Format bytes
function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

async function init() {
    try {
        tagDefinitions = await window.filetagz.getTagDefinitions();
        fileTags = await window.filetagz.getFileTags();
        
        const settings = await window.filetagz.getSettings();
        if (settings && settings.theme) {
            applyTheme(settings.theme);
            themeSelect.value = settings.theme;
        }
        
        // Load file info for all tagged files (excluding vault files still accessible)
        await refreshFilesInfo();
        
        renderSidebar();
        renderFileGrid();
        setupEventListeners();
        setupVaultEventListeners();
        setupAboutListeners();
        updateVaultCount();
    } catch (e) {
        console.error("Initialization error:", e);
    }
}

async function refreshFilesInfo() {
    const promises = Object.keys(fileTags).map(async filePath => {
        if (!filesInfo[filePath] && fileTags[filePath].length > 0) {
            filesInfo[filePath] = await window.filetagz.getFileInfo(filePath);
        }
    });
    await Promise.all(promises);
}

function renderSidebar() {
    // Keep 'All Files' button, clear others
    const allFilesBtn = tagNav.firstElementChild;
    tagNav.innerHTML = '';
    tagNav.appendChild(allFilesBtn);

    // Update All count
    let allCount = Object.keys(fileTags).filter(fp => fileTags[fp].length > 0).length;
    countAll.textContent = allCount;
    
    // Set active class
    if (currentFilter === 'all') {
        allFilesBtn.classList.add('active');
        viewTitle.textContent = 'All Files';
        viewTitle.style.background = 'linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%)';
        viewTitle.style.webkitBackgroundClip = 'text';
        viewTitle.style.webkitTextFillColor = 'transparent';
    } else {
        allFilesBtn.classList.remove('active');
    }
    
    // Wire up 'All Files' — if browsing a folder, it exits back to root; otherwise it filters to 'all'
    if (currentFolderPath) {
        allFilesBtn.style.opacity = '1';
        allFilesBtn.onclick = () => {
            currentFolderPath = null;
            folderHistory = [];
            currentFilter = 'all';
            renderSidebar();
            renderFileGrid();
        };
    } else {
        allFilesBtn.onclick = () => {
            currentFilter = 'all';
            renderSidebar();
            renderFileGrid();
        };
    }

    tagDefinitions.forEach(tag => {
        const count = Object.keys(fileTags).filter(fp => fileTags[fp].includes(tag.id)).length;
        
        const btn = document.createElement('button');
        btn.className = `tag-nav-item ${currentFilter === tag.id ? 'active' : ''}`;
        btn.innerHTML = `
            <span class="tag-dot" style="background: ${tag.color}"></span>
            <span class="tag-label">${tag.icon} ${tag.name}</span>
            <span class="tag-count">${count}</span>
        `;
        
        btn.onclick = () => {
            currentFilter = tag.id;
            // Clicking a tag always exits folder-browse mode
            currentFolderPath = null;
            folderHistory = [];
            renderSidebar();
            renderFileGrid();
        };
        
        tagNav.appendChild(btn);

        if (currentFilter === tag.id) {
            viewTitle.textContent = `${tag.icon} ${tag.name}`;
            viewTitle.style.background = 'none';
            viewTitle.style.webkitBackgroundClip = 'initial';
            viewTitle.style.webkitTextFillColor = tag.color;
            // Inject glow colour CSS vars onto the active sidebar item
            btn.style.setProperty('--nav-tag-color', tag.color);
            btn.style.setProperty('--nav-tag-glow', tag.color + '33');
        }
    });

    // Vault nav button active state
    const vaultBtn = document.getElementById('vault-nav-btn');
    if (vaultBtn) {
        const vCount = Object.keys(fileTags).filter(fp => (fileTags[fp] || []).includes(VAULT_TAG_ID)).length;
        document.getElementById('vault-count').textContent = vCount;
        if (currentFilter === VAULT_TAG_ID) {
            vaultBtn.classList.add('active');
        } else {
            vaultBtn.classList.remove('active');
        }
    }
}

async function renderFileGrid() {
    let visibleFiles = [];
    
    if (currentFolderPath) {
        // ─── Folder Browse Mode ───
        btnBackFolder.classList.remove('hidden');
        viewTitle.textContent = currentFolderPath.split('\\').pop() || currentFolderPath;
        viewTitle.style.background = 'linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%)';
        viewTitle.style.webkitBackgroundClip = 'text';
        viewTitle.style.webkitTextFillColor = 'transparent';
        
        loadAndRenderFolderView();
        return;
    } else {
        // ─── Standard Tag Mode ───
        btnBackFolder.classList.add('hidden');
        
        // Base list: all files with at least one tag, EXCLUDING vault files
        let baseFiles = Object.keys(fileTags).filter(fp => {
            const tags = fileTags[fp];
            if (!tags || tags.length === 0) return false;
            if (tags.includes(VAULT_TAG_ID)) return false; // never show vault files in normal view
            return true;
        });
        
        // Filter by current tag if not 'all'
        if (currentFilter !== 'all') {
            baseFiles = baseFiles.filter(fp => fileTags[fp].includes(currentFilter));
        }
        
        if (currentSearch) {
            const searchLower = currentSearch.toLowerCase();
            visibleFiles = baseFiles.filter(fp => {
                const info = filesInfo[fp];
                return info && info.name.toLowerCase().includes(searchLower);
            });
        } else {
            visibleFiles = baseFiles;
        }
    }
    
    // Sort files
    const sortVal = sortSelect.value;
    
    // Make sure we have info for all visible files before sorting
    for (const fp of visibleFiles) {
        if (!filesInfo[fp]) filesInfo[fp] = await window.filetagz.getFileInfo(fp);
    }

    visibleFiles.sort((a, b) => {
        const infoA = filesInfo[a];
        const infoB = filesInfo[b];
        if (!infoA || !infoB) return 0;
        
        if (sortVal === 'name_asc') return infoA.name.localeCompare(infoB.name);
        if (sortVal === 'name_desc') return infoB.name.localeCompare(infoA.name);
        if (sortVal === 'size_desc') return (infoB.size || 0) - (infoA.size || 0);
        if (sortVal === 'size_asc') return (infoA.size || 0) - (infoB.size || 0);
        if (sortVal === 'date_asc') return new Date(infoA.modified) - new Date(infoB.modified);
        if (sortVal === 'date_desc') return new Date(infoB.modified) - new Date(infoA.modified);
        return 0;
    });
    
    // Remove all except empty state
    Array.from(fileGrid.children).forEach(child => {
        if (child.id !== 'empty-state') {
            child.remove();
        }
    });
    
    if (!currentFolderPath) {
        if (visibleFiles.length === 0) {
            emptyState.style.display = 'flex';
            viewSubtitle.textContent = 'No files found';
        } else {
            emptyState.style.display = 'none';
            viewSubtitle.textContent = `${visibleFiles.length} file${visibleFiles.length !== 1 ? 's' : ''}`;
            
            const fragment = document.createDocumentFragment();
            visibleFiles.forEach(filePath => {
                const info = filesInfo[filePath];
                if (!info || !info.exists) return;
                createCard(filePath, info, fragment);
            });
            fileGrid.appendChild(fragment);
        }
    }
}

async function loadAndRenderFolderView() {
    Array.from(fileGrid.children).forEach(child => {
        if (child.id !== 'empty-state') child.remove();
    });
    
    const entries = await window.filetagz.readDir(currentFolderPath);
    let visibleEntries = currentSearch ? entries.filter(e => e.name.toLowerCase().includes(currentSearch.toLowerCase())) : entries;
    
    for (const entry of visibleEntries) {
        if (!filesInfo[entry.path]) {
            filesInfo[entry.path] = await window.filetagz.getFileInfo(entry.path);
        }
    }
    
    const sortVal = sortSelect.value;
    visibleEntries.sort((a, b) => {
        const infoA = filesInfo[a.path];
        const infoB = filesInfo[b.path];
        if (!infoA || !infoB) return 0;
        
        if (sortVal === 'name_asc') return infoA.name.localeCompare(infoB.name);
        if (sortVal === 'name_desc') return infoB.name.localeCompare(infoA.name);
        if (sortVal === 'size_desc') return (infoB.size || 0) - (infoA.size || 0);
        if (sortVal === 'size_asc') return (infoA.size || 0) - (infoB.size || 0);
        if (sortVal === 'date_asc') return new Date(infoA.modified) - new Date(infoB.modified);
        if (sortVal === 'date_desc') return new Date(infoB.modified) - new Date(infoA.modified);
        return 0;
    });
    
    if (visibleEntries.length === 0) {
        emptyState.style.display = 'flex';
        viewSubtitle.textContent = 'Empty folder';
    } else {
        emptyState.style.display = 'none';
        viewSubtitle.textContent = `${visibleEntries.length} item${visibleEntries.length !== 1 ? 's' : ''}`;
        
        const fragment = document.createDocumentFragment();
        for (const entry of visibleEntries) {
            createCard(entry.path, filesInfo[entry.path], fragment);
        }
        fileGrid.appendChild(fragment);
    }
}

function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/"/g, '&quot;');
}

function createCard(filePath, info, parentGrid) {
    if (!info || !info.exists) {
        console.warn('File skipped in grid (exists: false):', filePath, info);
        return;
    }
    
    const tags = (fileTags[filePath] || []).map(id => tagDefinitions.find(t => t.id === id)).filter(Boolean);
    const safePath = escapeAttr(filePath);
    const safeName = escapeAttr(info.name);
    const safeDir = escapeAttr(info.dir);
    
    const card = document.createElement('div');
    card.className = `file-card ${selectedFilePath === filePath ? 'selected' : ''}`;
    card.style.setProperty('--card-accent', tags.length > 0 ? tags[0].color : 'var(--accent)');
    
    card.innerHTML = `
        <div class="file-card-top">
            <div class="file-icon" style="background: transparent;">
                <img class="native-icon" src="" alt="" style="width: 40px; height: 40px; object-fit: contain; display: none;">
                <span class="fallback-icon" style="font-size: 28px;">${info.isDirectory ? '📁' : '📄'}</span>
            </div>
            <div class="file-info" style="min-width: 0;">
                <div class="file-name" title="${safeName}" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 14px; margin-bottom: 4px;">${safeName}</div>
                <div class="file-path" title="${safeDir}" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 11px; opacity: 0.6;">${safeDir}</div>
            </div>
        </div>
        <div class="file-tags">
            ${tags.map(t => `<button class="file-tag-pill" style="background: ${t.color}20; color: ${t.color}; box-shadow: 0 0 8px ${t.color}55, inset 0 0 6px ${t.color}18;">${t.name} <div class="pill-remove" data-tag="${t.id}" data-path="${safePath}">✕</div></button>`).join('')}
        </div>
        <div class="file-card-actions">
            <button class="card-action-btn add-tag-btn" data-path="${safePath}" title="Assign Tags">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            </button>
        </div>
    `;
    
    // Fetch native icon asynchronously to not block rendering
    window.filetagz.getFileIcon(filePath).then(iconData => {
        if (iconData) {
            const img = card.querySelector('.native-icon');
            const fallback = card.querySelector('.fallback-icon');
            img.src = iconData;
            img.style.display = 'block';
            fallback.style.display = 'none';
        }
    });

    // Remove tag
    card.querySelectorAll('.pill-remove').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const path = btn.getAttribute('data-path');
            const tagId = btn.getAttribute('data-tag');
            fileTags = await window.filetagz.removeFileTag(path, tagId);
            if (selectedFilePath === path && (!fileTags[path] || fileTags[path].length === 0)) {
                closeDetailPanel();
            } else if (selectedFilePath === path) {
                renderDetailPanel(path);
            }
            renderSidebar();
            if (currentFolderPath) loadAndRenderFolderView(); else renderFileGrid();
        };
    });
    
    // Add tag
    card.querySelector('.add-tag-btn').onclick = (e) => {
        e.stopPropagation();
        openTagModal([card.querySelector('.add-tag-btn').getAttribute('data-path')]);
    };
    
    // Double Click to open or browse
    card.ondblclick = () => {
        if (info.isDirectory) {
            // Always push the current folder (or null) to history before navigating
            folderHistory.push(currentFolderPath);
            currentFolderPath = filePath;
            renderSidebar();
            renderFileGrid();
            loadAndRenderFolderView();
        } else {
            window.filetagz.openPath(filePath);
        }
    };
    
    // Right click menu inside app
    card.oncontextmenu = (e) => {
        e.preventDefault();
        selectedFilePath = filePath;
        document.querySelectorAll('.file-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        renderDetailPanel(filePath);
        
        // Custom simple right-click menu
        const menu = document.createElement('div');
        menu.style.position = 'fixed';
        menu.style.top = `${e.clientY}px`;
        menu.style.left = `${e.clientX}px`;
        menu.style.background = 'var(--bg-elevated)';
        menu.style.border = '1px solid var(--border-strong)';
        menu.style.borderRadius = 'var(--radius-sm)';
        menu.style.padding = '4px';
        menu.style.boxShadow = 'var(--shadow-md)';
        menu.style.zIndex = '1000';
        menu.style.display = 'flex';
        menu.style.flexDirection = 'column';
        menu.style.minWidth = '150px';
        
        const createItem = (text, onClick) => {
            const item = document.createElement('div');
            item.textContent = text;
            item.style.padding = '8px 12px';
            item.style.fontSize = '12px';
            item.style.cursor = 'pointer';
            item.style.borderRadius = '4px';
            item.onmouseover = () => item.style.background = 'var(--accent)';
            item.onmouseout = () => item.style.background = 'transparent';
            item.onclick = () => { onClick(); document.body.removeChild(menu); };
            return item;
        };
        
        menu.appendChild(createItem('Open', () => window.filetagz.openPath(filePath)));
        menu.appendChild(createItem('Show in Explorer', () => window.filetagz.openInExplorer(filePath)));
        menu.appendChild(createItem('Manage Tags', () => openTagModal([filePath])));
        
        const separator = document.createElement('div');
        separator.style.height = '1px';
        separator.style.background = 'var(--border)';
        separator.style.margin = '4px';
        menu.appendChild(separator);
        
        menu.appendChild(createItem('🗑️ Move to Recycle Bin', async () => {
            if (confirm(`Move "${info.name}" to the Recycle Bin?`)) {
                const success = await window.filetagz.trashItem(filePath);
                if (success) {
                    if (currentFolderPath) loadAndRenderFolderView(); else renderFileGrid();
                    closeDetailPanel();
                } else {
                    alert('Failed to move to recycle bin.');
                }
            }
        }));
        
        menu.appendChild(createItem('⚠️ Delete Permanently', async () => {
            if (confirm(`Are you sure you want to PERMANENTLY delete "${info.name}"?\nThis cannot be undone.`)) {
                const success = await window.filetagz.deleteItem(filePath);
                if (success) {
                    if (currentFolderPath) loadAndRenderFolderView(); else renderFileGrid();
                    closeDetailPanel();
                } else {
                    alert('Failed to delete file.');
                }
            }
        }));
        
        document.body.appendChild(menu);
        
        const closeMenu = () => { if(document.body.contains(menu)) document.body.removeChild(menu); document.removeEventListener('click', closeMenu); };
        document.addEventListener('click', closeMenu);
    };
    
    // Select file
    card.onclick = () => {
        selectedFilePath = filePath;
        document.querySelectorAll('.file-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        renderDetailPanel(filePath);
    };
    
    parentGrid.appendChild(card);
}

function renderDetailPanel(filePath) {
    const info = filesInfo[filePath];
    if (!info) return;
    
    detailPanel.classList.remove('hidden');
    detailFilename.textContent = info.name;
    detailPath.textContent = info.dir;
    
    detailSize.textContent = info.isDirectory ? 'Calculating...' : formatBytes(info.size);
    if (info.isDirectory) {
        window.filetagz.getFolderSize(filePath).then(size => {
            if (selectedFilePath === filePath) detailSize.textContent = formatBytes(size);
        });
    }
    
    detailModified.textContent = new Date(info.modified).toLocaleString();
    detailType.textContent = info.isDirectory ? 'Folder' : (info.ext || 'File');
    
    // Handle Previews
    detailPreview.style.display = 'flex';
    detailPreview.innerHTML = '';
    
    if (!info.isDirectory) {
        const ext = (info.ext || '').toLowerCase();
        const imgExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];
        const docExts = ['.pdf'];
        const textExts = ['.txt', '.js', '.css', '.html', '.md', '.json', '.xml', '.csv'];
        
        if (imgExts.includes(ext)) {
            const img = document.createElement('img');
            img.src = `file:///${filePath.replace(/\\/g, '/')}`;
            img.style.maxWidth = '100%';
            img.style.maxHeight = '200px';
            img.style.objectFit = 'contain';
            detailPreview.appendChild(img);
        } else if (docExts.includes(ext)) {
            const iframe = document.createElement('iframe');
            iframe.src = `file:///${filePath.replace(/\\/g, '/')}`;
            iframe.style.width = '100%';
            iframe.style.height = '200px';
            iframe.style.border = 'none';
            detailPreview.appendChild(iframe);
        } else if (textExts.includes(ext)) {
            window.filetagz.getFileText(filePath).then(text => {
                if (text && selectedFilePath === filePath) {
                    const pre = document.createElement('pre');
                    pre.textContent = text;
                    pre.style.width = '100%';
                    pre.style.height = '100%';
                    pre.style.margin = '0';
                    pre.style.padding = '8px';
                    pre.style.fontSize = '10px';
                    pre.style.color = 'var(--text-secondary)';
                    pre.style.overflow = 'auto';
                    pre.style.whiteSpace = 'pre-wrap';
                    pre.style.wordBreak = 'break-word';
                    detailPreview.appendChild(pre);
                }
            });
        } else {
            detailPreview.innerHTML = `<span style="font-size: 11px; color: var(--text-tertiary);">No preview available</span>`;
        }
    } else {
        detailPreview.innerHTML = `<span style="font-size: 11px; color: var(--text-tertiary);">Folder</span>`;
    }
    
    if (info.isDirectory) {
        btnBrowseFolder.style.display = 'flex';
        btnOpenFile.style.display = 'none';
    } else {
        btnBrowseFolder.style.display = 'none';
        btnOpenFile.style.display = 'flex';
    }
    
    detailTags.innerHTML = '';
    const tags = (fileTags[filePath] || []).map(id => tagDefinitions.find(t => t.id === id)).filter(Boolean);
    
    tags.forEach(t => {
        const chip = document.createElement('div');
        chip.className = 'detail-tag-chip';
        chip.style.background = `${t.color}20`;
        chip.style.color = t.color;
        chip.style.boxShadow = `0 0 10px ${t.color}55, inset 0 0 8px ${t.color}18`;
        chip.innerHTML = `${t.icon} ${t.name}`;
        detailTags.appendChild(chip);
    });
    
    const addChip = document.createElement('div');
    addChip.className = 'detail-tag-chip';
    addChip.style.border = '1px dashed var(--border-strong)';
    addChip.style.color = 'var(--text-secondary)';
    addChip.textContent = '+ Add Tag';
    addChip.onclick = () => openTagModal([filePath]);
    detailTags.appendChild(addChip);
}

function closeDetailPanel() {
    selectedFilePath = null;
    detailPanel.classList.add('hidden');
    document.querySelectorAll('.file-card').forEach(c => c.classList.remove('selected'));
}

function openTagModal(filePaths) {
    filesToTag = filePaths;
    tempSelectedTags = new Set();
    
    if (filePaths.length === 1) {
        modalFileName.textContent = filesInfo[filePaths[0]]?.name || filePaths[0];
        (fileTags[filePaths[0]] || []).forEach(t => tempSelectedTags.add(t));
    } else {
        modalFileName.textContent = `${filePaths.length} files selected`;
    }
    
    renderModalTags();
    tagModal.classList.remove('hidden');
}

function renderModalTags() {
    modalTagGrid.innerHTML = '';
    // Normal tags
    tagDefinitions.forEach(tag => {
        const opt = document.createElement('div');
        opt.className = 'modal-tag-option';
        opt.style.borderColor = tempSelectedTags.has(tag.id) ? tag.color : 'var(--border)';
        opt.style.background = tempSelectedTags.has(tag.id) ? `${tag.color}15` : 'var(--bg-surface)';
        opt.innerHTML = `
            <span style="font-size: 16px">${tag.icon}</span>
            <span style="flex: 1; color: ${tempSelectedTags.has(tag.id) ? tag.color : 'var(--text-primary)'}">${tag.name}</span>
            ${tempSelectedTags.has(tag.id) ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${tag.color}" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"></polyline></svg>` : ''}
        `;
        opt.onclick = () => {
            if (tempSelectedTags.has(tag.id)) tempSelectedTags.delete(tag.id);
            else tempSelectedTags.add(tag.id);
            renderModalTags();
        };
        modalTagGrid.appendChild(opt);
    });

    // Vault tag (always last, special styling)
    const vSel = tempSelectedTags.has(VAULT_TAG_ID);
    const vOpt = document.createElement('div');
    vOpt.className = 'modal-tag-option';
    vOpt.style.borderColor = vSel ? VAULT_TAG.color : 'var(--border)';
    vOpt.style.background   = vSel ? 'rgba(157,78,221,0.12)' : 'var(--bg-surface)';
    if (vSel) vOpt.style.boxShadow = '0 0 10px rgba(157,78,221,0.3)';
    vOpt.innerHTML = `
        <span style="font-size:16px">${VAULT_TAG.icon}</span>
        <span style="flex:1;color:${vSel ? VAULT_TAG.color : 'var(--text-primary)'}">${VAULT_TAG.name}</span>
        ${vSel ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${VAULT_TAG.color}" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"></polyline></svg>` : ''}
    `;
    vOpt.onclick = () => {
        if (tempSelectedTags.has(VAULT_TAG_ID)) tempSelectedTags.delete(VAULT_TAG_ID);
        else tempSelectedTags.add(VAULT_TAG_ID);
        renderModalTags();
    };
    modalTagGrid.appendChild(vOpt);
}

function setupEventListeners() {
    searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value;
        if (currentFolderPath) loadAndRenderFolderView(); else renderFileGrid();
    });
    
    sortSelect.addEventListener('change', () => {
        if (currentFolderPath) loadAndRenderFolderView(); else renderFileGrid();
    });
    
    themeSelect.addEventListener('change', async (e) => {
        const theme = e.target.value;
        applyTheme(theme);
        await window.filetagz.setSettings({ theme });
    });
    
    btnBackFolder.onclick = () => {
        if (folderHistory.length > 0) {
            currentFolderPath = folderHistory.pop();
            renderSidebar();
            renderFileGrid();
            loadAndRenderFolderView();
        } else {
            currentFolderPath = null;
            folderHistory = [];
            renderSidebar();
            renderFileGrid();
        }
    };
    
    btnCloseDetail.onclick = closeDetailPanel;
    
    btnOpenExplorer.onclick = () => {
        if (selectedFilePath) window.filetagz.openInExplorer(selectedFilePath);
    };

    btnBrowseFolder.onclick = () => {
        if (selectedFilePath) {
            if (currentFolderPath) folderHistory.push(currentFolderPath);
            else folderHistory = [];
            currentFolderPath = selectedFilePath;
            renderSidebar();
            renderFileGrid();
            loadAndRenderFolderView();
        }
    };

    btnOpenFile.onclick = () => {
        if (selectedFilePath) window.filetagz.openPath(selectedFilePath);
    };
    
    btnRemoveAllTags.onclick = async () => {
        if (selectedFilePath) {
            fileTags = await window.filetagz.removeAllFileTags(selectedFilePath);
            closeDetailPanel();
            renderSidebar();
            renderFileGrid();
        }
    };
    
    const addFileHandler = async () => {
        const paths = await window.filetagz.pickFiles();
        if (paths && paths.length > 0) {
            for (const path of paths) {
                if (!filesInfo[path]) filesInfo[path] = await window.filetagz.getFileInfo(path);
            }
            openTagModal(paths);
        }
    };

    document.getElementById('btn-add-file').onclick = addFileHandler;
    
    // Settings & Add Tag logic
    const openSettings = () => {
        renderSettingsTags();
        settingsModal.classList.remove('hidden');
    };
    btnSettings.onclick = openSettings;
    // The sidebar '+' tag button also opens settings/tag creation
    const btnAddTag = document.getElementById('btn-add-tag');
    if (btnAddTag) btnAddTag.onclick = openSettings;
    
    settingsClose.onclick = () => settingsModal.classList.add('hidden');
    
    btnCreateTag.onclick = async () => {
        const name = newTagName.value.trim();
        if (!name) return;
        const icon = newTagIcon.value.trim() || '🏷️';
        const color = newTagColor.value || '#0A84FF';
        const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        
        tagDefinitions = await window.filetagz.createTagDefinition({ id, name, icon, color });
        
        newTagName.value = '';
        newTagIcon.value = '';
        renderSettingsTags();
        renderSidebar();
    };
    
    document.getElementById('btn-add-folder').onclick = async () => {
        const paths = await window.filetagz.pickFolder();
        if (paths && paths.length > 0) {
            for (const path of paths) {
                if (!filesInfo[path]) filesInfo[path] = await window.filetagz.getFileInfo(path);
            }
            openTagModal(paths);
        }
    };
    
    modalCancel.onclick = () => {
        tagModal.classList.add('hidden');
    };
    
    modalDone.onclick = async () => {
        // Split vault vs normal tag changes
        const vaultAdds = [];
        const vaultRemovals = [];
        for (const fp of filesToTag) {
            const had = (fileTags[fp] || []).includes(VAULT_TAG_ID);
            const wants = tempSelectedTags.has(VAULT_TAG_ID);
            if (!had && wants)  vaultAdds.push(fp);
            if (had  && !wants) vaultRemovals.push(fp);
        }

        // Apply non-vault tag changes
        for (const fp of filesToTag) {
            const existingNormal = (fileTags[fp] || []).filter(t => t !== VAULT_TAG_ID);
            const newNormal = [...tempSelectedTags].filter(t => t !== VAULT_TAG_ID);
            for (const t of existingNormal) fileTags = await window.filetagz.removeFileTag(fp, t);
            for (const t of newNormal)      fileTags = await window.filetagz.setFileTag(fp, t);
        }

        // Reveal files having vault tag removed
        for (const fp of vaultRemovals) {
            fileTags = await window.filetagz.removeFileTag(fp, VAULT_TAG_ID);
            await window.filetagz.vaultRevealFile(fp);
        }

        // Handle vault additions (may need password setup)
        if (vaultAdds.length > 0) {
            tagModal.classList.add('hidden');
            vaultPendingFiles = vaultAdds;
            const hasPwd = await window.filetagz.vaultHasPassword();
            if (!hasPwd) {
                openVaultSetupModal(); // will hide files on success
            } else {
                await hideFilesInVault(vaultPendingFiles);
                vaultPendingFiles = [];
                refreshAfterTagChange();
            }
            return;
        }

        tagModal.classList.add('hidden');
        refreshAfterTagChange();
    };

    if (window.filetagz.onOpenTagModal) {
        window.filetagz.onOpenTagModal(async (files) => {
            for (const path of files) {
                if (!filesInfo[path]) filesInfo[path] = await window.filetagz.getFileInfo(path);
            }
            openTagModal(files);
        });
    }

    // Resizer logic
    let isResizing = false;
    detailResizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth > 200 && newWidth < 800) {
            detailPanel.style.width = `${newWidth}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        }
    });
}

function renderSettingsTags() {
    settingsTagList.innerHTML = '';
    tagDefinitions.forEach(tag => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';
        row.style.background = 'var(--bg-active)';
        row.style.padding = '8px 12px';
        row.style.borderRadius = '6px';
        
        row.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px;">${tag.icon}</span>
                <span style="color: ${tag.color}; font-weight: 600;">${tag.name}</span>
            </div>
            <button class="card-action-btn" title="Delete Tag" style="width: 24px; height: 24px; color: var(--danger);">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
        `;
        
        row.querySelector('button').onclick = async () => {
            if (confirm(`Are you sure you want to delete the "${tag.name}" tag? It will be removed from all files.`)) {
                tagDefinitions = await window.filetagz.deleteTagDefinition(tag.id);
                fileTags = await window.filetagz.getFileTags(); // Reload file tags since some were removed
                renderSettingsTags();
                renderSidebar();
                renderFileGrid();
                if (selectedFilePath) renderDetailPanel(selectedFilePath);
            }
        };
        
        settingsTagList.appendChild(row);
    });
}

function applyTheme(themeName) {
    document.body.className = `theme-${themeName}`;
}

// ─── Vault Helpers ────────────────────────────────────────────────────────────
function refreshAfterTagChange() {
    if (selectedFilePath && filesToTag && filesToTag.includes(selectedFilePath)) {
        renderDetailPanel(selectedFilePath);
    }
    renderSidebar();
    if (currentFolderPath) loadAndRenderFolderView(); else renderFileGrid();
    updateVaultCount();
}

function updateVaultCount() {
    const count = Object.keys(fileTags).filter(fp => (fileTags[fp] || []).includes(VAULT_TAG_ID)).length;
    const el = document.getElementById('vault-count');
    if (el) el.textContent = count;
}

async function hideFilesInVault(paths) {
    for (const fp of paths) {
        if (!filesInfo[fp]) filesInfo[fp] = await window.filetagz.getFileInfo(fp);
        fileTags = await window.filetagz.setFileTag(fp, VAULT_TAG_ID);
        await window.filetagz.vaultHideFile(fp);
    }
    updateVaultCount();
}

function openVaultSetupModal() {
    const modal  = document.getElementById('vault-setup-modal');
    const pwd    = document.getElementById('vault-setup-pwd');
    const conf   = document.getElementById('vault-setup-confirm');
    const err    = document.getElementById('vault-setup-error');
    pwd.value = conf.value = err.textContent = '';
    modal.classList.remove('hidden');
    pwd.focus();
}

function openVaultUnlockModal(onSuccess) {
    const modal = document.getElementById('vault-unlock-modal');
    const pwd   = document.getElementById('vault-unlock-pwd');
    const err   = document.getElementById('vault-unlock-error');
    pwd.value = err.textContent = '';
    modal.classList.remove('hidden');
    pwd.focus();
    // Store callback for submit handler
    modal._onSuccess = onSuccess;
}

function lockVault() {
    vaultUnlocked = false;
    if (currentFilter === VAULT_TAG_ID) {
        currentFilter = 'all';
        renderSidebar();
        renderFileGrid();
    }
}

function renderVaultGrid() {
    // Clear grid
    Array.from(fileGrid.children).forEach(c => { if (c.id !== 'empty-state') c.remove(); });

    const vaultFiles = Object.keys(fileTags).filter(fp => (fileTags[fp] || []).includes(VAULT_TAG_ID));

    // Banner
    const banner = document.createElement('div');
    banner.id = 'vault-banner';
    banner.innerHTML = `<span>\ud83d\udd12</span> <span>Vault is unlocked — ${vaultFiles.length} hidden file${vaultFiles.length !== 1 ? 's' : ''}. Files are invisible in Explorer while tagged.</span>`;
    fileGrid.insertBefore(banner, fileGrid.firstChild);

    viewTitle.textContent = '\ud83d\udd12 Vault';
    viewTitle.style.background = 'linear-gradient(135deg,#9D4EDD,#C77DFF)';
    viewTitle.style.webkitBackgroundClip = 'text';
    viewTitle.style.webkitTextFillColor = 'transparent';
    viewSubtitle.textContent = `${vaultFiles.length} hidden file${vaultFiles.length !== 1 ? 's' : ''}`;

    if (vaultFiles.length === 0) {
        emptyState.style.display = 'flex';
    } else {
        emptyState.style.display = 'none';
        const fragment = document.createDocumentFragment();
        vaultFiles.forEach(fp => {
            if (filesInfo[fp]) createCard(fp, filesInfo[fp], fragment);
        });
        fileGrid.appendChild(fragment);
    }
}

function setupVaultEventListeners() {
    // ─ Vault sidebar button
    document.getElementById('vault-nav-btn').onclick = () => {
        currentFolderPath = null;
        folderHistory = [];
        if (vaultUnlocked) {
            currentFilter = VAULT_TAG_ID;
            renderSidebar();
            renderVaultGrid();
        } else {
            openVaultUnlockModal(() => {
                vaultUnlocked = true;
                currentFilter = VAULT_TAG_ID;
                renderSidebar();
                renderVaultGrid();
            });
        }
    };

    // ─ Setup modal — submit
    document.getElementById('vault-setup-submit').onclick = async () => {
        const pwd  = document.getElementById('vault-setup-pwd').value;
        const conf = document.getElementById('vault-setup-confirm').value;
        const err  = document.getElementById('vault-setup-error');
        if (pwd.length < 4)       { err.textContent = 'Password must be at least 4 characters.'; return; }
        if (pwd !== conf)         { err.textContent = 'Passwords do not match.'; return; }
        err.textContent = '';
        await window.filetagz.vaultSetPassword(pwd);
        document.getElementById('vault-setup-modal').classList.add('hidden');
        await hideFilesInVault(vaultPendingFiles);
        vaultPendingFiles = [];
        refreshAfterTagChange();
    };
    document.getElementById('vault-setup-cancel').onclick = () => {
        vaultPendingFiles = [];
        document.getElementById('vault-setup-modal').classList.add('hidden');
    };
    // Enter key
    ['vault-setup-pwd','vault-setup-confirm'].forEach(id => {
        document.getElementById(id).addEventListener('keydown', e => {
            if (e.key === 'Enter') document.getElementById('vault-setup-submit').click();
        });
    });

    // ─ Unlock modal — submit
    document.getElementById('vault-unlock-submit').onclick = async () => {
        const modal = document.getElementById('vault-unlock-modal');
        const pwd   = document.getElementById('vault-unlock-pwd').value;
        const err   = document.getElementById('vault-unlock-error');
        const ok    = await window.filetagz.vaultVerify(pwd);
        if (!ok) { err.textContent = 'Incorrect password. Try again.'; return; }
        err.textContent = '';
        modal.classList.add('hidden');
        if (modal._onSuccess) modal._onSuccess();
    };
    document.getElementById('vault-unlock-cancel').onclick = () => {
        document.getElementById('vault-unlock-modal').classList.add('hidden');
    };
    document.getElementById('vault-unlock-pwd').addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('vault-unlock-submit').click();
    });

    // ─ Forgot password → UAC elevation
    document.getElementById('vault-forgot-btn').onclick = async () => {
        const errEl = document.getElementById('vault-unlock-error');
        errEl.textContent = 'Waiting for Windows authentication…';
        const ok = await window.filetagz.vaultSystemRecover();
        if (ok) {
            document.getElementById('vault-unlock-modal').classList.add('hidden');
            showToast('✅ Vault password cleared. Set a new one next time you hide a file.');
            refreshAfterTagChange();
        } else {
            errEl.textContent = 'Authentication cancelled or failed.';
        }
    };
}

// ─── About Modal ─────────────────────────────────────────────────────────────
function setupAboutListeners() {
    const aboutModal   = document.getElementById('about-modal');
    const btnAbout     = document.getElementById('btn-about');
    const btnAboutClose= document.getElementById('about-close');
    const btnPatreon   = document.getElementById('link-patreon');
    const btnEmail     = document.getElementById('link-email');

    if (!aboutModal || !btnAbout) return; // Guard — elements must exist

    btnAbout.onclick      = () => aboutModal.classList.remove('hidden');
    btnAboutClose.onclick = () => aboutModal.classList.add('hidden');
    aboutModal.querySelector('.modal-backdrop').onclick = () => aboutModal.classList.add('hidden');

    if (btnPatreon) btnPatreon.onclick = () =>
        window.filetagz.openExternal('https://patreon.com/ayaan4uthere?utm_medium=unknown&utm_source=join_link&utm_campaign=creatorshare_creator&utm_content=copyLink');

    if (btnEmail) btnEmail.onclick = () =>
        window.filetagz.openExternal('mailto:schoolboy3216@gmail.com');
}

init();
