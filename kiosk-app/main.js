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
let allowedDomains = [];
let nativeProcess = null;

// Parse the hostname from KIOSK_URL for local-origin checks
const kioskHost = (() => {
  try {
    return new URL(KIOSK_URL).hostname;
  } catch {
    return '';
  }
})();

function stripWww(hostname) {
  return hostname.replace(/^www\./, '');
}

function isURLAllowed(url) {
  // Allow data: and about: protocols
  if (url.startsWith('data:') || url.startsWith('about:')) return true;

  // Allow relative URLs (shouldn't normally reach here, but safety check)
  if (url.startsWith('/')) return true;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const hostname = parsed.hostname;

  // Always allow localhost and local addresses
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') {
    return true;
  }

  // Allow the configured kiosk server host
  if (kioskHost && hostname === kioskHost) return true;

  // Check against whitelisted domains (with subdomain matching)
  const stripped = stripWww(hostname);
  return allowedDomains.some((domain) => {
    return stripped === domain || stripped.endsWith('.' + domain);
  });
}

function showBlockedPage(url) {
  if (!contentView) return;
  let blockedDomain = '';
  try {
    blockedDomain = new URL(url).hostname;
  } catch {
    blockedDomain = url;
  }
  const html = `
    <html>
    <head><style>
      body { font-family: -apple-system, system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #1e293b; color: #e2e8f0; }
      .container { text-align: center; max-width: 480px; }
      .icon { font-size: 64px; margin-bottom: 16px; }
      h1 { font-size: 24px; margin-bottom: 8px; }
      .domain { color: #94a3b8; font-family: monospace; font-size: 14px; background: #334155; padding: 4px 12px; border-radius: 6px; display: inline-block; margin: 12px 0; }
      p { color: #94a3b8; font-size: 14px; }
    </style></head>
    <body><div class="container">
      <div class="icon">&#x1F6AB;</div>
      <h1>Page Not Available</h1>
      <div class="domain">${blockedDomain}</div>
      <p>This website is not on the allowed list.<br>Ask a parent to add it if you need access.</p>
      <button onclick="history.back()" style="margin-top:20px;padding:10px 24px;border:none;border-radius:8px;background:#334155;color:#e2e8f0;font-size:14px;cursor:pointer;">&#8592; Go Back</button>
    </div></body>
    </html>`;
  contentView.webContents.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
}

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

  // Whitelist enforcement: intercept navigation in content view
  contentView.webContents.on('will-navigate', (event, url) => {
    if (!isURLAllowed(url)) {
      event.preventDefault();
      showBlockedPage(url);
    }
  });

  contentView.webContents.setWindowOpenHandler(({ url }) => {
    // Deny all new windows; load allowed URLs in content view, block others
    if (isURLAllowed(url)) {
      contentView.webContents.loadURL(url);
    } else {
      showBlockedPage(url);
    }
    return { action: 'deny' };
  });

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
  if (nativeProcess) {
    try { nativeProcess.kill(); } catch {}
    nativeProcess = null;
  }
  app.quit();
});

// ============================================
// IPC Handlers for native system calls
// ============================================

const { exec, spawn } = require('child_process');

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

// Launch a native application
ipcMain.handle('native:launch', async (event, command) => {
  if (nativeProcess) {
    return { success: false, error: 'A native app is already running' };
  }

  try {
    const child = spawn(command, [], { shell: true, detached: false, stdio: 'ignore' });
    nativeProcess = child;

    // Step out of kiosk/fullscreen so the native app can appear on top
    if (mainWindow) {
      const isDev = process.env.NODE_ENV === 'development';
      mainWindow.setAlwaysOnTop(false);
      if (!isDev) {
        mainWindow.setKiosk(false);
        mainWindow.setFullScreen(false);
      }
    }

    const cleanup = () => {
      nativeProcess = null;
      // Restore kiosk mode
      if (mainWindow) {
        const isDev = process.env.NODE_ENV === 'development';
        if (!isDev) {
          mainWindow.setFullScreen(true);
          mainWindow.setKiosk(true);
        }
        mainWindow.setAlwaysOnTop(!isDev);
        mainWindow.focus();
      }
      // Notify the menu view
      if (menuView) {
        menuView.webContents.send('native:exited');
      }
    };

    child.on('exit', cleanup);
    child.on('error', (err) => {
      console.error('Native process error:', err.message);
      cleanup();
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Check if a native process is running
ipcMain.handle('native:isRunning', async () => {
  return nativeProcess !== null;
});

// Kill the running native process
ipcMain.handle('native:kill', async () => {
  if (nativeProcess) {
    try {
      nativeProcess.kill();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: 'No native process running' };
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
    if (!isURLAllowed(url)) {
      showBlockedPage(url);
      return { success: false, error: 'URL not on the allowed list' };
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

// Whitelist management
ipcMain.handle('whitelist:set', async (event, domains) => {
  if (!Array.isArray(domains)) return { success: false, error: 'domains must be an array' };
  allowedDomains = domains.map((d) => stripWww(String(d).toLowerCase()));
  console.log('Whitelist updated:', allowedDomains);
  return { success: true };
});
