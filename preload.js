const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('filetagz', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close:    () => ipcRenderer.send('window:close'),

  // Tag definitions
  getTagDefinitions:   ()       => ipcRenderer.invoke('tags:getDefinitions'),
  updateTagDefinition: (tagDef) => ipcRenderer.invoke('tags:updateDefinition', tagDef),
  createTagDefinition: (tagDef) => ipcRenderer.invoke('tags:createDefinition', tagDef),
  deleteTagDefinition: (tagId)  => ipcRenderer.invoke('tags:deleteDefinition', tagId),

  // File tags
  getFileTags:       ()                   => ipcRenderer.invoke('tags:getFileTags'),
  setFileTag:        (filePath, tagId)    => ipcRenderer.invoke('tags:setFileTag', filePath, tagId),
  removeFileTag:     (filePath, tagId)    => ipcRenderer.invoke('tags:removeFileTag', filePath, tagId),
  removeAllFileTags: (filePath)           => ipcRenderer.invoke('tags:removeAllFileTags', filePath),

  // Settings
  getSettings: ()            => ipcRenderer.invoke('settings:get'),
  setSettings: (settings)    => ipcRenderer.invoke('settings:set', settings),

  // File system
  pickFiles:      ()           => ipcRenderer.invoke('fs:pickFiles'),
  pickFolder:     ()           => ipcRenderer.invoke('fs:pickFolder'),
  openInExplorer: (filePath)   => ipcRenderer.invoke('fs:openInExplorer', filePath),
  openPath:       (filePath)   => ipcRenderer.invoke('fs:openPath', filePath),
  openWith:       (filePath)   => ipcRenderer.invoke('fs:openWith', filePath),
  exists:         (filePath)   => ipcRenderer.invoke('fs:exists', filePath),
  getFileInfo:    (filePath)   => ipcRenderer.invoke('fs:getFileInfo', filePath),
  getFileIcon:    (filePath)   => ipcRenderer.invoke('fs:getFileIcon', filePath),
  getFileText:    (filePath)   => ipcRenderer.invoke('fs:getFileText', filePath),
  getFolderSize:  (folderPath) => ipcRenderer.invoke('fs:getFolderSize', folderPath),
  searchAll:      (query, taggedPaths) => ipcRenderer.invoke('fs:searchAll', query, taggedPaths),
  readDir:        (dirPath)    => ipcRenderer.invoke('fs:readDir', dirPath),
  trashItem:      (filePath)   => ipcRenderer.invoke('fs:trashItem', filePath),
  deleteItem:     (filePath)   => ipcRenderer.invoke('fs:deleteItem', filePath),

  // Events — use once() style so listeners don't stack across hot reloads
  onOpenTagModal: (callback) => {
    ipcRenderer.removeAllListeners('open-tag-modal-for-files');
    ipcRenderer.on('open-tag-modal-for-files', (_event, files) => callback(files));
  },

  // Vault
  vaultHasPassword:    ()          => ipcRenderer.invoke('vault:hasPassword'),
  vaultSetPassword:    (pwd)       => ipcRenderer.invoke('vault:setPassword', pwd),
  vaultVerify:         (pwd)       => ipcRenderer.invoke('vault:verify', pwd),
  vaultChangePassword: (old, nw)   => ipcRenderer.invoke('vault:changePassword', old, nw),
  vaultHideFile:       (fp)        => ipcRenderer.invoke('vault:hideFile', fp),
  vaultRevealFile:     (fp)        => ipcRenderer.invoke('vault:revealFile', fp),
  vaultSystemRecover:  ()          => ipcRenderer.invoke('vault:systemRecover'),

  // Utilities
  openExternal:      (url)  => ipcRenderer.invoke('util:openExternal', url),
  getSoundDataURL:   (p)    => ipcRenderer.invoke('util:getSoundDataURL', p),
  pickSoundFile:     ()     => ipcRenderer.invoke('util:pickSoundFile'),
});
