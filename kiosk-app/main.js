require('dotenv').config();
const { app, BrowserWindow, BrowserView, ipcMain, screen, session } = require('electron');
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


// Kiosk registration (pairing) persistence
const registrationPath = path.join(__dirname, 'data', 'kiosk-registration.json');
let kioskToken = null;

function loadRegistration() {
  try {
    if (fs.existsSync(registrationPath)) {
      const data = JSON.parse(fs.readFileSync(registrationPath, 'utf-8'));
      kioskToken = data.kioskToken || null;
      return !!kioskToken;
    }
  } catch {}
  return false;
}

function saveRegistration(token, kioskId) {
  const dir = path.dirname(registrationPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(registrationPath, JSON.stringify({
    kioskToken: token,
    kioskId,
    registeredAt: new Date().toISOString(),
  }, null, 2));
  kioskToken = token;
}

function clearRegistration() {
  try {
    if (fs.existsSync(registrationPath)) fs.unlinkSync(registrationPath);
  } catch {}
  kioskToken = null;
}

function kioskHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (kioskToken) h['X-Kiosk-Token'] = kioskToken;
  return h;
}

let mainWindow;
let contentView;
let menuView;
let allowedDomains = [];
let nativeProcess = null;
let warningTimer = null;
let killTimer = null;
let currentSessionStart = null;
let currentAppId = null;

// Scan .desktop files to discover installed applications
function scanInstalledApps() {
  const os = require('os');
  const dirs = [
    '/usr/share/applications',
    '/usr/local/share/applications',
    path.join(os.homedir(), '.local/share/applications'),
    '/var/lib/snapd/desktop/applications',
    '/var/lib/flatpak/exports/share/applications',
  ];

  const apps = [];
  for (const dir of dirs) {
    let files;
    try {
      files = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.endsWith('.desktop')) continue;
      try {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8');
        const entry = parseDesktopEntry(content);
        if (entry) apps.push(entry);
      } catch {}
    }
  }

  // Deduplicate by exec command, keeping first occurrence
  const seen = new Set();
  const unique = [];
  for (const app of apps) {
    if (!seen.has(app.exec)) {
      seen.add(app.exec);
      unique.push(app);
    }
  }

  unique.sort((a, b) => a.name.localeCompare(b.name));
  return unique;
}

function parseDesktopEntry(content) {
  const lines = content.split('\n');
  let inDesktopEntry = false;
  const fields = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '[Desktop Entry]') {
      inDesktopEntry = true;
      continue;
    }
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      if (inDesktopEntry) break; // Done with [Desktop Entry] section
      continue;
    }
    if (!inDesktopEntry) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    fields[key] = val;
  }

  // Filter out non-applications and hidden entries
  if (fields.Type && fields.Type !== 'Application') return null;
  if (fields.NoDisplay === 'true' || fields.Hidden === 'true') return null;
  if (!fields.Name || !fields.Exec) return null;

  // Strip field codes (%u, %f, %F, %U, etc.) from Exec
  const exec = fields.Exec.replace(/%[a-zA-Z]/g, '').trim();

  const rawIcon = fields.Icon || '';

  return {
    name: fields.Name,
    exec,
    icon: rawIcon,
    iconKey: getIconKey(rawIcon),
    categories: fields.Categories || '',
  };
}

function getIconKey(iconField) {
  if (!iconField) return '';
  if (iconField.startsWith('/')) {
    return path.basename(iconField, path.extname(iconField)).replace(/[^a-zA-Z0-9._-]/g, '_');
  }
  return iconField.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function resolveIconPath(iconName) {
  if (!iconName) return null;

  // Absolute path
  if (iconName.startsWith('/')) {
    return fs.existsSync(iconName) ? iconName : null;
  }

  const os = require('os');
  const extensions = ['.png', '.svg', '.xpm'];

  // Check /usr/share/pixmaps
  for (const ext of extensions) {
    const p = `/usr/share/pixmaps/${iconName}${ext}`;
    if (fs.existsSync(p)) return p;
  }

  const iconBases = ['/usr/share/icons'];
  const homedir = os.homedir();
  if (homedir) iconBases.push(path.join(homedir, '.local/share/icons'));

  const prefSizes = ['64', '48', '256', '128', '96', '32', '64x64', '48x48', '128x128', '256x256', 'scalable'];

  for (const iconsBase of iconBases) {
    let themeDirs = [];
    try {
      themeDirs = fs.readdirSync(iconsBase).filter(d => {
        try { return fs.statSync(path.join(iconsBase, d)).isDirectory(); } catch { return false; }
      });
    } catch { continue; }

    for (const theme of themeDirs) {
      const themeBase = path.join(iconsBase, theme);

      for (const size of prefSizes) {
        // Standard layout: theme/size/*/icon (hicolor, Adwaita)
        const stdSizeDir = path.join(themeBase, size);
        try {
          for (const sub of fs.readdirSync(stdSizeDir)) {
            for (const ext of extensions) {
              const p = path.join(stdSizeDir, sub, `${iconName}${ext}`);
              if (fs.existsSync(p)) return p;
            }
          }
        } catch {}
      }

      // Flat layout: theme/*/size/icon (Mint-Y, Papirus)
      let topDirs = [];
      try {
        topDirs = fs.readdirSync(themeBase).filter(d => {
          try { return fs.statSync(path.join(themeBase, d)).isDirectory(); } catch { return false; }
        });
      } catch {}

      for (const sub of topDirs) {
        for (const size of prefSizes) {
          for (const ext of extensions) {
            const flat = path.join(themeBase, sub, size, `${iconName}${ext}`);
            if (fs.existsSync(flat)) return flat;
            const hidpi = path.join(themeBase, sub, `${size}@2x`, `${iconName}${ext}`);
            if (fs.existsSync(hidpi)) return hidpi;
          }
        }
      }
    }
  }

  return null;
}

async function pushInstalledApps() {
  if (!kioskToken) return;
  try {
    const apps = scanInstalledApps();
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/api/kiosk/installed-apps`, {
      method: 'POST',
      headers: kioskHeaders(),
      body: JSON.stringify({ apps }),
    });
    if (res.ok) {
      console.log(`Pushed ${apps.length} installed apps to server`);
      // Push icons lazily in the background
      pushAppIcons(apps);
    } else {
      console.error('Failed to push installed apps:', res.status);
    }
  } catch (err) {
    console.error('Failed to push installed apps:', err.message);
  }
}

async function pushAppIcons(apps) {
  if (!kioskToken) return;
  const { nativeImage } = require('electron');
  const apiBase = getApiBaseUrl();

  const icons = [];
  for (const app of apps) {
    if (!app.icon || !app.iconKey) continue;
    const iconPath = resolveIconPath(app.icon);
    if (!iconPath) continue;
    try {
      const img = nativeImage.createFromPath(iconPath);
      if (img.isEmpty()) continue;
      const resized = img.resize({ width: 64, height: 64 });
      const pngData = resized.toPNG();
      icons.push({ name: app.iconKey, data: pngData.toString('base64'), ext: 'png' });
    } catch {}
  }

  if (icons.length === 0) return;

  // Send in batches of 20
  for (let i = 0; i < icons.length; i += 20) {
    const batch = icons.slice(i, i + 20);
    try {
      await fetch(`${apiBase}/api/kiosk/app-icons`, {
        method: 'POST',
        headers: kioskHeaders(),
        body: JSON.stringify({ icons: batch }),
      });
    } catch (err) {
      console.error('Failed to push app icons batch:', err.message);
    }
  }
  console.log(`Pushed ${icons.length} app icons to server`);
}

/**
 * Calculate remaining seconds for an app based on usage data.
 * This mirrors the logic in kiosk-server/src/utils/timeLimit.js
 */
function calculateRemainingSeconds(usage) {
  const candidates = [];
  const bonusSeconds = (usage.bonus_minutes_today || 0) * 60;

  // Daily limit with bonus time
  if (usage.daily_limit_minutes != null) {
    candidates.push(usage.daily_limit_minutes * 60 + bonusSeconds - usage.today_seconds);
  }

  // Weekly limit (no bonus applied to weekly)
  if (usage.weekly_limit_minutes != null) {
    candidates.push(usage.weekly_limit_minutes * 60 - usage.week_seconds);
  }

  // Hard cap: max_daily_minutes ignores bonus time entirely
  if (usage.max_daily_minutes > 0) {
    candidates.push(usage.max_daily_minutes * 60 - usage.today_seconds);
  }

  if (candidates.length === 0) {
    return Infinity; // No limits configured
  }

  return Math.max(0, Math.min(...candidates));
}

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
      <button onclick="console.log('__KIOSK_GO_BACK__')" style="margin-top:20px;padding:10px 24px;border:none;border-radius:8px;background:#334155;color:#e2e8f0;font-size:14px;cursor:pointer;">&#8592; Go Back</button>
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
    backgroundColor: '#0f172a',
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

  // Content view - minimal preload for camera access only
  contentView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-content.js'),
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
  menuView.webContents.loadURL('data:text/html,<html><body style="margin:0;background:#0f172a"></body></html>');

  // Grant media permissions (camera/microphone) for the kiosk server origin
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
      return;
    }
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'media') return true;
    return false;
  });

  // Inject X-Kiosk-Token header into all BrowserView requests to the kiosk server
  const serverOrigin = USE_BUILT_IN_SERVER ? `http://localhost:${PORT}` : new URL(KIOSK_URL).origin;
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: [`${serverOrigin}/*`] },
    (details, callback) => {
      if (kioskToken) {
        details.requestHeaders['X-Kiosk-Token'] = kioskToken;
      }
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  // Load URLs (skip if pairing mode — startPairingFlow will handle content)
  if (loadRegistration()) {
    startupConnect();
  } else {
    console.log('Not registered — waiting for pairing flow');
  }

  // Handle window resize
  mainWindow.on('resize', () => {
    const [newWidth, newHeight] = mainWindow.getSize();
    const newMenuHeight = isDev ? 80 : Math.floor(newHeight * 0.1);
    const newContentHeight = newHeight - newMenuHeight;

    contentView.setBounds({ x: 0, y: 0, width: newWidth, height: newContentHeight });
    menuView.setBounds({ x: 0, y: newContentHeight, width: newWidth, height: newMenuHeight });
  });

  // Dev tools shortcut (F12) and emergency exit (Ctrl+Shift+Q) — dev mode only
  if (isDev) {
    const setupDevTools = (view, name) => {
      view.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F12') {
          view.webContents.toggleDevTools();
        }
        if (input.control && input.shift && input.key === 'Q') {
          app.quit();
        }
      });
    };

    setupDevTools(contentView, 'content');
    setupDevTools(menuView, 'menu');
  }

  // Whitelist enforcement: intercept navigation in content view
  // Forward content view navigation events to the menu (for time tracking)
  contentView.webContents.on('did-navigate', (event, url) => {
    if (menuView) menuView.webContents.send('content:navigated', url);
  });
  contentView.webContents.on('did-navigate-in-page', (event, url) => {
    if (menuView) menuView.webContents.send('content:navigated', url);
  });

  contentView.webContents.on('will-navigate', (event, url) => {
    if (!isURLAllowed(url)) {
      event.preventDefault();
      showBlockedPage(url);
    }
  });

  // Handle back button on blocked page (data: URLs can't use history.back() reliably)
  contentView.webContents.on('console-message', (event, level, message) => {
    if (message === '__KIOSK_GO_BACK__' && contentView.webContents.canGoBack()) {
      contentView.webContents.goBack();
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

function showPairingScreen(message) {
  const html = `
    <html>
    <head><style>
      body { font-family: -apple-system, system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #e2e8f0; }
      .container { text-align: center; }
      h1 { font-size: 28px; margin-bottom: 8px; color: #94a3b8; font-weight: 500; }
      .code { font-size: 96px; font-weight: 700; letter-spacing: 0.2em; margin: 32px 0; color: #38bdf8; font-family: monospace; }
      p { color: #64748b; font-size: 16px; max-width: 400px; margin: 0 auto; line-height: 1.6; }
      .pulse { animation: pulse 2s infinite; }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
    </style></head>
    <body><div class="container">${message}</div></body>
    </html>`;
  if (contentView) {
    contentView.webContents.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  }
}

function showStartupScreen(html) {
  const page = `
    <html>
    <head><style>
      body { font-family: -apple-system, system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #e2e8f0; }
      .container { text-align: center; }
      h1 { font-size: 28px; margin-bottom: 8px; color: #e2e8f0; font-weight: 600; }
      p { color: #94a3b8; font-size: 16px; max-width: 400px; margin: 0 auto; line-height: 1.6; }
      .spinner { width: 48px; height: 48px; border: 4px solid #334155; border-top-color: #38bdf8; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 24px; }
      @keyframes spin { to { transform: rotate(360deg); } }
      .error-msg { background: #1e293b; border: 1px solid #475569; border-radius: 8px; padding: 12px 20px; margin: 16px auto; max-width: 480px; font-family: monospace; font-size: 13px; color: #f87171; word-break: break-word; }
      button { margin-top: 24px; padding: 12px 32px; border: none; border-radius: 8px; background: #38bdf8; color: #0f172a; font-size: 16px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
      button:hover { background: #7dd3fc; }
    </style></head>
    <body><div class="container">${html}</div></body>
    </html>`;
  if (contentView) {
    contentView.webContents.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(page));
  }
}

async function startupConnect() {
  const baseURL = USE_BUILT_IN_SERVER ? `http://localhost:${PORT}` : KIOSK_URL;
  const apiBase = getApiBaseUrl();

  showStartupScreen(`
    <div class="spinner"></div>
    <h1>Connecting</h1>
    <p>Reaching server...</p>
  `);

  // Verify kiosk token with the server
  try {
    const res = await fetch(`${apiBase}/api/kiosk/verify`, {
      headers: kioskHeaders(),
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 401) {
      console.warn('Kiosk token rejected by server — clearing registration');
      clearRegistration();
      startPairingFlow();
      return;
    }
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    await res.json();
  } catch (err) {
    console.error(`Startup connection failed (${apiBase}/api/kiosk/verify):`, err.message);
    showStartupScreen(`
      <h1>Connection Failed</h1>
      <div class="error-msg">${err.message}</div>
      <p>Could not reach the kiosk server.</p>
      <button onclick="console.log('__KIOSK_RETRY__')">Retry</button>
    `);
    const handler = (_event, _level, message) => {
      if (message === '__KIOSK_RETRY__') {
        contentView.webContents.removeListener('console-message', handler);
        startupConnect();
      }
    };
    if (contentView) contentView.webContents.on('console-message', handler);
    return;
  }

  console.log(`Loading content: ${baseURL}/kiosk/test-content`);
  console.log(`Loading menu: ${baseURL}/kiosk/menu`);
  contentView.webContents.loadURL(`${baseURL}/kiosk/test-content`);
  menuView.webContents.loadURL(`${baseURL}/kiosk/menu`);
  pushInstalledApps();
  connectWebSocket();
}

// Show pairing code on the content view and poll for claim
async function startPairingFlow() {
  const apiBase = getApiBaseUrl();

  // Show a connecting screen immediately
  showPairingScreen(`
    <h1>Kiosk Pairing</h1>
    <p class="pulse">Connecting to server...</p>
  `);

  let code, claimSecret;
  try {
    const res = await fetch(`${apiBase}/api/pairing/code`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    code = data.code;
    claimSecret = data.claimSecret;
  } catch (err) {
    console.error('Failed to get pairing code:', err.message);
    showPairingScreen(`
      <h1>Kiosk Pairing</h1>
      <p>Waiting for server...</p>
      <p class="pulse" style="margin-top: 16px; font-size: 14px; color: #475569;">Retrying in 5 seconds</p>
    `);
    setTimeout(startPairingFlow, 5000);
    return;
  }

  // Display the code full-screen
  showPairingScreen(`
    <h1>Kiosk Pairing</h1>
    <div class="code">${code}</div>
    <p>Enter this code in the Parent Dashboard to register this kiosk.</p>
    <p class="pulse" style="margin-top: 24px; color: #475569; font-size: 14px;">Waiting for pairing...</p>
  `);

  // Poll for claim every 3 seconds
  const pollInterval = setInterval(async () => {
    try {
      const res = await fetch(`${apiBase}/api/pairing/status/${code}?secret=${claimSecret}`);
      const data = await res.json();
      if (data.claimed && data.kioskToken) {
        clearInterval(pollInterval);
        saveRegistration(data.kioskToken, data.kioskId);
        console.log('Kiosk paired successfully!');
        pushInstalledApps();
        connectWebSocket();
        // Proceed to normal operation
        const baseURL = USE_BUILT_IN_SERVER ? `http://localhost:${PORT}` : KIOSK_URL;
        if (contentView) contentView.webContents.loadURL(`${baseURL}/kiosk/test-content`);
        if (menuView) menuView.webContents.loadURL(`${baseURL}/kiosk/menu`);
      }
    } catch (err) {
      console.error('Pairing poll error:', err.message);
    }
  }, 3000);
}

// ============================================
// WebSocket connection to server for remote updates
// ============================================

let kioskWs = null;
let wsReconnectTimer = null;
let wsPingInterval = null;
let wsAlive = false;
const repoRoot = path.resolve(__dirname, '..');

function connectWebSocket() {
  if (!kioskToken) return;

  // Clear any pending reconnect
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }

  const apiBase = getApiBaseUrl();
  const wsUrl = apiBase.replace(/^http/, 'ws') + '/ws';

  try {
    const ws = new WebSocket(wsUrl);
    kioskWs = ws;

    ws.on('open', () => {
      console.log('Kiosk WebSocket connected');
      ws.send(JSON.stringify({ type: 'identify', clientType: 'kiosk', token: kioskToken }));
      startHeartbeat(ws);
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        handleServerMessage(ws, msg);
      } catch {}
    });

    ws.on('pong', () => {
      wsAlive = true;
    });

    ws.on('close', () => {
      console.log('Kiosk WebSocket disconnected');
      cleanup();
      scheduleReconnect();
    });

    ws.on('error', (err) => {
      console.error('Kiosk WebSocket error:', err.message);
      cleanup();
      scheduleReconnect();
    });
  } catch (err) {
    console.error('Failed to create WebSocket:', err.message);
    scheduleReconnect();
  }
}

function startHeartbeat(ws) {
  stopHeartbeat();
  wsAlive = true;
  wsPingInterval = setInterval(() => {
    if (!wsAlive) {
      console.log('Kiosk WebSocket heartbeat timeout, reconnecting');
      ws.terminate();
      return;
    }
    wsAlive = false;
    try { ws.ping(); } catch {}
  }, 30000);
}

function stopHeartbeat() {
  if (wsPingInterval) {
    clearInterval(wsPingInterval);
    wsPingInterval = null;
  }
}

function cleanup() {
  stopHeartbeat();
  kioskWs = null;
}

function scheduleReconnect() {
  if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
  wsReconnectTimer = setTimeout(connectWebSocket, 5000);
}

function handleServerMessage(ws, msg) {
  if (msg.type === 'get_version') {
    try {
      const hash = execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf-8' }).trim();
      ws.send(JSON.stringify({ type: 'version_response', hash }));
    } catch (err) {
      console.error('Failed to get git hash:', err.message);
      ws.send(JSON.stringify({ type: 'version_response', hash: null }));
    }
  }

  if (msg.type === 'do_update') {
    performUpdate(ws);
  }
}

async function performUpdate(ws) {
  try {
    ws.send(JSON.stringify({ type: 'update_status', status: 'updating' }));

    execSync('git pull', { cwd: repoRoot, encoding: 'utf-8', timeout: 60000 });
    execSync('npm install', { cwd: path.join(repoRoot, 'kiosk-app'), encoding: 'utf-8', timeout: 120000 });

    ws.send(JSON.stringify({ type: 'update_status', status: 'restarting' }));

    // Brief delay to let the message send
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 500);
  } catch (err) {
    console.error('Update failed:', err.message);
    try {
      ws.send(JSON.stringify({ type: 'update_status', status: 'error', error: err.message }));
    } catch {}
  }
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
      if (!kioskToken) startPairingFlow();
    });
  } else {
    console.log('Using external server');
    createWindow();
    if (!kioskToken) startPairingFlow();
  }
});

app.on('window-all-closed', () => {
  if (warningTimer) { clearTimeout(warningTimer); warningTimer = null; }
  if (killTimer) { clearTimeout(killTimer); killTimer = null; }
  if (nativeProcess && nativeProcess.pid) {
    try { process.kill(-nativeProcess.pid, 'SIGTERM'); } catch {}
    nativeProcess = null;
  }
  if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
  if (kioskWs) {
    kioskWs.onclose = null;
    kioskWs.close();
    kioskWs = null;
  }
  app.quit();
});

// ============================================
// IPC Handlers for native system calls
// ============================================

const { exec, execSync, spawn } = require('child_process');
const WebSocket = require('ws');

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

// Derive API base URL from kiosk config (Vite proxies /api to port 3001)
function getApiBaseUrl() {
  if (USE_BUILT_IN_SERVER) {
    return `http://localhost:${PORT}`;
  }
  return KIOSK_URL;
}

// Launch a native application with optional usage tracking and time limits
ipcMain.handle('native:launch', async (event, command, appId) => {
  if (nativeProcess) {
    return { success: false, error: 'A native app is already running' };
  }

  let remainingSeconds = Infinity;

  // If appId provided, check usage limits
  if (appId) {
    try {
      const apiBase = getApiBaseUrl();
      const resp = await fetch(`${apiBase}/api/apps/${appId}/usage`, { headers: kioskHeaders() });
      if (resp.ok) {
        const usage = await resp.json();
        remainingSeconds = calculateRemainingSeconds(usage);
        if (remainingSeconds <= 0) {
          return { success: false, error: 'Time limit reached' };
        }
      }
    } catch (err) {
      // If fetch fails, allow launch gracefully (no limits enforced)
      console.error('Failed to fetch usage data, launching without limits:', err.message);
    }
  }

  try {
    const child = spawn(command, [], { shell: true, detached: true, stdio: 'ignore' });
    nativeProcess = child;
    currentSessionStart = new Date().toISOString();
    currentAppId = appId || null;

    // Exit kiosk/fullscreen and minimize so the native app has the screen
    if (mainWindow) {
      const isDev = process.env.NODE_ENV === 'development';
      mainWindow.setAlwaysOnTop(false);
      if (!isDev) {
        mainWindow.setKiosk(false);
        mainWindow.setFullScreen(false);
      }
      mainWindow.minimize();
    }

    // Set up time limit timers if there's a finite remaining time
    if (remainingSeconds < Infinity) {
      const warningMs = Math.max(0, (remainingSeconds - 60) * 1000);
      const killMs = remainingSeconds * 1000;

      warningTimer = setTimeout(() => {
        // Send warning to menu view
        if (menuView) {
          menuView.webContents.send('native:timeWarning');
        }
        // Show desktop notification
        const { Notification } = require('electron');
        if (Notification.isSupported()) {
          new Notification({
            title: 'Time Almost Up',
            body: 'You have about 1 minute left before this app closes.',
          }).show();
        }
      }, warningMs);

      killTimer = setTimeout(() => {
        // Kill the native process group when time runs out
        if (nativeProcess && nativeProcess.pid) {
          try { process.kill(-nativeProcess.pid, 'SIGTERM'); } catch {}
        }
        if (menuView) {
          menuView.webContents.send('native:timeLimitReached');
        }
      }, killMs);
    }

    const cleanup = () => {
      // Clear timers
      if (warningTimer) { clearTimeout(warningTimer); warningTimer = null; }
      if (killTimer) { clearTimeout(killTimer); killTimer = null; }

      // Record usage session (fire-and-forget)
      if (currentAppId && currentSessionStart) {
        const endedAt = new Date().toISOString();
        const durationSeconds = Math.round((new Date(endedAt) - new Date(currentSessionStart)) / 1000);
        const apiBase = getApiBaseUrl();
        fetch(`${apiBase}/api/apps/${currentAppId}/usage`, {
          method: 'POST',
          headers: kioskHeaders(),
          body: JSON.stringify({ started_at: currentSessionStart, ended_at: endedAt, duration_seconds: durationSeconds }),
        }).catch(err => console.error('Failed to record usage:', err.message));
      }

      nativeProcess = null;
      currentSessionStart = null;
      currentAppId = null;

      // Restore kiosk mode
      if (mainWindow) {
        const isDev = process.env.NODE_ENV === 'development';
        mainWindow.restore();
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

    return { success: true, remainingSeconds: remainingSeconds < Infinity ? remainingSeconds : null };
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
  if (nativeProcess && nativeProcess.pid) {
    try {
      if (warningTimer) { clearTimeout(warningTimer); warningTimer = null; }
      if (killTimer) { clearTimeout(killTimer); killTimer = null; }
      process.kill(-nativeProcess.pid, 'SIGTERM');
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

// Zoom control — applies to both content and menu views
ipcMain.handle('zoom:set', async (event, factor) => {
  const f = Math.max(0.25, Math.min(3.0, Number(factor) || 1));
  if (contentView) contentView.webContents.setZoomFactor(f);
  if (menuView) menuView.webContents.setZoomFactor(f);
  return { success: true };
});

// Whitelist management
ipcMain.handle('whitelist:set', async (event, domains) => {
  if (!Array.isArray(domains)) return { success: false, error: 'domains must be an array' };
  allowedDomains = domains.map((d) => stripWww(String(d).toLowerCase()));
  //console.log('Whitelist updated:', allowedDomains);
  return { success: true };
});

// --- Camera capture via ffmpeg ---
// Uses a single persistent ffmpeg process that outputs continuous MJPEG frames.
let cameraDevice = '/dev/video0';
let cameraProc = null;
let cameraBuffer = null; // last complete JPEG frame

ipcMain.handle('camera:listDevices', async () => {
  try {
    const { execSync } = require('child_process');
    const output = execSync('v4l2-ctl --list-devices 2>/dev/null', { encoding: 'utf-8' });
    const devices = [];
    let currentName = null;
    for (const line of output.split('\n')) {
      if (line && !line.startsWith('\t') && !line.startsWith(' ')) {
        currentName = line.replace(/\s*\(.*\)\s*:\s*$/, '').trim();
      } else if (line.trim().startsWith('/dev/video')) {
        const dev = line.trim();
        // Only include capture-capable devices (even-numbered typically)
        devices.push({ path: dev, name: currentName || dev });
      }
    }
    // Deduplicate — keep only the first /dev/videoN per device name
    const seen = new Set();
    return devices.filter(d => {
      if (seen.has(d.name)) return false;
      seen.add(d.name);
      return true;
    });
  } catch {
    return [{ path: '/dev/video0', name: 'Default Camera' }];
  }
});

ipcMain.handle('camera:setDevice', async (event, device) => {
  cameraDevice = device;
  // Notify content view so it can update the camera button
  if (contentView && !contentView.webContents.isDestroyed()) {
    contentView.webContents.send('camera:deviceChanged', device);
  }
  return { success: true };
});

ipcMain.handle('camera:getDevice', async () => {
  return cameraDevice;
});

function stopCamera() {
  if (cameraProc) {
    cameraProc.kill('SIGKILL');
    cameraProc = null;
  }
  cameraBuffer = null;
}

function startCamera() {
  if (cameraProc) return;
  // Output continuous MJPEG at 15fps, low res for streaming
  cameraProc = spawn('ffmpeg', [
    '-f', 'v4l2', '-framerate', '30', '-i', '/dev/video0',
    '-f', 'image2pipe', '-vcodec', 'mjpeg',
    '-q:v', '10', '-s', '320x240',
    '-r', '15',
    'pipe:1'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  // MJPEG frames are delimited by FFD8 (start) and FFD9 (end) markers
  let pending = Buffer.alloc(0);
  cameraProc.stdout.on('data', (chunk) => {
    pending = Buffer.concat([pending, chunk]);
    // Extract complete JPEG frames
    while (true) {
      const start = pending.indexOf(Buffer.from([0xFF, 0xD8]));
      if (start === -1) break;
      const end = pending.indexOf(Buffer.from([0xFF, 0xD9]), start + 2);
      if (end === -1) break;
      cameraBuffer = pending.subarray(start, end + 2);
      pending = pending.subarray(end + 2);
    }
  });

  cameraProc.on('close', () => {
    cameraProc = null;
  });
  cameraProc.on('error', (err) => {
    console.error('[Camera] ffmpeg error:', err.message);
    cameraProc = null;
  });
}

ipcMain.handle('camera:capture', async () => {
  // Take a full-res single frame capture (stream must be stopped first)
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', [
      '-f', 'v4l2', '-i', cameraDevice,
      '-frames:v', '1',
      '-f', 'image2pipe', '-vcodec', 'mjpeg',
      '-q:v', '3',
      'pipe:1'
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    const chunks = [];
    proc.stdout.on('data', (chunk) => chunks.push(chunk));
    proc.on('close', (code) => {
      if (chunks.length === 0) {
        reject(new Error('Camera capture failed (no data)'));
        return;
      }
      const buf = Buffer.concat(chunks);
      resolve('data:image/jpeg;base64,' + buf.toString('base64'));
    });
    proc.on('error', (err) => reject(err));
  });
});

let streamInterval = null;

ipcMain.handle('camera:startStream', async () => {
  stopCamera();
  if (streamInterval) { clearInterval(streamInterval); streamInterval = null; }

  startCamera();

  // Send the latest frame to the content view at ~15fps
  streamInterval = setInterval(() => {
    if (cameraBuffer && contentView && !contentView.webContents.isDestroyed()) {
      const dataUrl = 'data:image/jpeg;base64,' + cameraBuffer.toString('base64');
      contentView.webContents.send('camera:frame', dataUrl);
    }
  }, 66);

  return { success: true };
});

ipcMain.handle('camera:stopStream', async () => {
  stopCamera();
  if (streamInterval) { clearInterval(streamInterval); streamInterval = null; }
  // Small delay to ensure /dev/video0 is fully released
  await new Promise(r => setTimeout(r, 300));
  return { success: true };
});
