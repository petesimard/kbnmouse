const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Load config
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Environment variables override config file
const KIOSK_URL = process.env.KIOSK_URL || config.url;
const USE_BUILT_IN_SERVER = process.env.KIOSK_USE_BUILT_IN_SERVER !== 'false' && config.useBuiltInServer;
const PORT = parseInt(process.env.KIOSK_PORT) || config.builtInServerPort || 3000;
const HOT_RELOAD_WATCH = process.env.KIOSK_HOT_RELOAD_WATCH || config.hotReloadWatch || './public';

// Hot reload in development
if (process.env.NODE_ENV === 'development') {
  require('electron-reload')(path.join(__dirname, HOT_RELOAD_WATCH), {
    electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
    hardResetMethod: 'exit'
  });
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load URL (use built-in server URL if enabled, otherwise use config URL)
  const url = USE_BUILT_IN_SERVER ? `http://localhost:${PORT}` : KIOSK_URL;
  console.log(`Loading: ${url}`);
  mainWindow.loadURL(url);

  // Remove menu
  mainWindow.setMenu(null);

  // Dev tools shortcut (F12) - remove in production if needed
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
    }
    // Emergency exit: Ctrl+Shift+Q
    if (input.control && input.shift && input.key === 'Q') {
      app.quit();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Start app (with or without built-in server)
app.whenReady().then(() => {
  if (USE_BUILT_IN_SERVER) {
    const express = require('express');
    const server = express();

    // Serve static files from 'public' directory
    server.use(express.static(path.join(__dirname, 'public')));

    // API endpoint example
    server.get('/api/status', (req, res) => {
      res.json({ status: 'ok', time: new Date().toISOString() });
    });

    server.listen(PORT, () => {
      console.log(`Built-in server running on http://localhost:${PORT}`);
      createWindow();
    });
  } else {
    console.log('Using external server');
    createWindow();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

// ============================================
// IPC Handlers for native system calls
// ============================================

const { exec } = require('child_process');

// Execute shell command
ipcMain.handle('shell:exec', async (event, command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject({ error: error.message, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
});

// Read file
ipcMain.handle('fs:readFile', async (event, filePath) => {
  return fs.promises.readFile(filePath, 'utf-8');
});

// Write file
ipcMain.handle('fs:writeFile', async (event, filePath, content) => {
  return fs.promises.writeFile(filePath, content, 'utf-8');
});

// List directory
ipcMain.handle('fs:readdir', async (event, dirPath) => {
  return fs.promises.readdir(dirPath);
});

// Get system info
ipcMain.handle('system:info', async () => {
  const os = require('os');
  return {
    platform: os.platform(),
    hostname: os.hostname(),
    uptime: os.uptime(),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    cpus: os.cpus().length
  };
});
