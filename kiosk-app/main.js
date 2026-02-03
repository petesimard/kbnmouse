const { app, BrowserWindow, BrowserView, ipcMain, screen } = require('electron');
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
let contentView;
let menuView;

function createWindow() {
  const isDev = process.env.NODE_ENV === 'development';
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  // Create the main window
  mainWindow = new BrowserWindow({
    fullscreen: !isDev,
    kiosk: !isDev,
    width: isDev ? 1280 : undefined,
    height: isDev ? 800 : undefined,
    autoHideMenuBar: true,
    frame: isDev, // Show frame in dev for easier debugging
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // Remove menu
  mainWindow.setMenu(null);

  // Get actual window size (may differ from requested in dev mode)
  const [winWidth, winHeight] = mainWindow.getSize();
  const menuHeight = isDev ? 80 : Math.floor(winHeight * 0.1);
  const contentHeight = winHeight - menuHeight;

  // Base URL for server
  const baseURL = USE_BUILT_IN_SERVER ? `http://localhost:${PORT}` : KIOSK_URL;

  // Content view - loads arbitrary URLs, no preload for security
  contentView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // No preload - content view loads arbitrary URLs
    }
  });
  mainWindow.addBrowserView(contentView);
  contentView.setBounds({ x: 0, y: 0, width: winWidth, height: contentHeight });
  contentView.setAutoResize({ width: true, height: false });

  // Menu view - trusted, loads only from our server
  menuView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  mainWindow.addBrowserView(menuView);
  menuView.setBounds({ x: 0, y: contentHeight, width: winWidth, height: menuHeight });
  menuView.setAutoResize({ width: true, height: false });

  // Load URLs
  console.log(`Loading content: ${baseURL}/test-content`);
  console.log(`Loading menu: ${baseURL}/menu`);
  contentView.webContents.loadURL(`${baseURL}/test-content`);
  menuView.webContents.loadURL(`${baseURL}/menu`);

  // Handle window resize
  mainWindow.on('resize', () => {
    const [newWidth, newHeight] = mainWindow.getSize();
    const newMenuHeight = isDev ? 80 : Math.floor(newHeight * 0.1);
    const newContentHeight = newHeight - newMenuHeight;

    contentView.setBounds({ x: 0, y: 0, width: newWidth, height: newContentHeight });
    menuView.setBounds({ x: 0, y: newContentHeight, width: newWidth, height: newMenuHeight });
  });

  // Dev tools shortcut (F12) for both views
  const setupDevTools = (view, name) => {
    view.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12') {
        view.webContents.toggleDevTools();
      }
      // Emergency exit: Ctrl+Shift+Q
      if (input.control && input.shift && input.key === 'Q') {
        app.quit();
      }
    });
  };

  setupDevTools(contentView, 'content');
  setupDevTools(menuView, 'menu');

  // Also handle keyboard shortcuts on main window
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key === 'Q') {
      app.quit();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    contentView = null;
    menuView = null;
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

// ============================================
// IPC Handlers for content view navigation
// ============================================

ipcMain.handle('content:loadURL', async (event, url) => {
  if (contentView) {
    // Handle relative URLs by prepending base URL
    if (url.startsWith('/')) {
      const baseURL = USE_BUILT_IN_SERVER ? `http://localhost:${PORT}` : KIOSK_URL;
      url = baseURL + url;
    }
    contentView.webContents.loadURL(url);
    return { success: true };
  }
  return { success: false, error: 'Content view not available' };
});

ipcMain.handle('content:goBack', async () => {
  if (contentView && contentView.webContents.canGoBack()) {
    contentView.webContents.goBack();
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('content:goForward', async () => {
  if (contentView && contentView.webContents.canGoForward()) {
    contentView.webContents.goForward();
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('content:reload', async () => {
  if (contentView) {
    contentView.webContents.reload();
    return { success: true };
  }
  return { success: false };
});
