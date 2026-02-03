const { contextBridge, ipcRenderer } = require('electron');

// Expose native APIs to the renderer process (web page)
contextBridge.exposeInMainWorld('kiosk', {
  // Execute shell commands
  exec: (command) => ipcRenderer.invoke('shell:exec', command),

  // File system operations
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  readdir: (dirPath) => ipcRenderer.invoke('fs:readdir', dirPath),

  // System info
  getSystemInfo: () => ipcRenderer.invoke('system:info'),

  // Content window navigation (only available in menu window)
  content: {
    loadURL: (url) => ipcRenderer.invoke('content:loadURL', url),
    goBack: () => ipcRenderer.invoke('content:goBack'),
    goForward: () => ipcRenderer.invoke('content:goForward'),
    reload: () => ipcRenderer.invoke('content:reload'),
  }
});
