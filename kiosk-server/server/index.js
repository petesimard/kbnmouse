import express from 'express';
import crypto from 'crypto';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import db, { hashPin } from './db.js';

const app = express();
const PORT = 3001;

// Create HTTP server and WebSocket server
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Track connected clients
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`Client connected. Total clients: ${clients.size}`);

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`Client disconnected. Total clients: ${clients.size}`);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    clients.delete(ws);
  });
});

// Broadcast refresh message to all connected clients
function broadcastRefresh() {
  const message = JSON.stringify({ type: 'refresh' });
  for (const client of clients) {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  }
  console.log(`Broadcast refresh to ${clients.size} clients`);
}

app.use(express.json());

// Simple token storage (in production, use proper session management)
const validTokens = new Map();

// Generate auth token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// PIN verification middleware for admin routes
function requirePin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || !validTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Get all enabled apps (public)
app.get('/api/apps', (req, res) => {
  const apps = db.prepare('SELECT id, name, url, icon, app_type FROM apps WHERE enabled = 1 ORDER BY sort_order').all();
  res.json(apps);
});

// Get single app (public)
app.get('/api/apps/:id', (req, res) => {
  const appRecord = db.prepare('SELECT * FROM apps WHERE id = ?').get(req.params.id);
  if (!appRecord) {
    return res.status(404).json({ error: 'App not found' });
  }
  res.json(appRecord);
});

// Get today's bonus minutes from challenge completions (public)
app.get('/api/bonus-time', (req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const result = db.prepare(
    'SELECT COALESCE(SUM(minutes_awarded), 0) as total FROM challenge_completions WHERE completed_at >= ?'
  ).get(todayStart);

  res.json({ today_bonus_minutes: result.total });
});

// Manually add bonus time (protected - parent only)
app.post('/api/admin/bonus-time', requirePin, (req, res) => {
  const { minutes } = req.body;
  if (!minutes || minutes < 1) {
    return res.status(400).json({ error: 'minutes is required and must be at least 1' });
  }

  db.prepare(
    'INSERT INTO challenge_completions (challenge_type, minutes_awarded, completed_at) VALUES (?, ?, ?)'
  ).run('parent_bonus', minutes, new Date().toISOString());

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const result = db.prepare(
    'SELECT COALESCE(SUM(minutes_awarded), 0) as total FROM challenge_completions WHERE completed_at >= ?'
  ).get(todayStart);

  broadcastRefresh();
  res.json({ success: true, today_bonus_minutes: result.total });
});

// Record a challenge completion (public)
app.post('/api/challenges/complete', (req, res) => {
  const { challenge_type, minutes_awarded } = req.body;
  if (!challenge_type || minutes_awarded == null) {
    return res.status(400).json({ error: 'challenge_type and minutes_awarded are required' });
  }

  db.prepare(
    'INSERT INTO challenge_completions (challenge_type, minutes_awarded, completed_at) VALUES (?, ?, ?)'
  ).run(challenge_type, minutes_awarded, new Date().toISOString());

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const result = db.prepare(
    'SELECT COALESCE(SUM(minutes_awarded), 0) as total FROM challenge_completions WHERE completed_at >= ?'
  ).get(todayStart);

  broadcastRefresh();
  res.json({ success: true, today_bonus_minutes: result.total });
});

// Get usage summary for an app (public - called by Electron on LAN)
app.get('/api/apps/:id/usage', (req, res) => {
  const appRecord = db.prepare('SELECT * FROM apps WHERE id = ?').get(req.params.id);
  if (!appRecord) {
    return res.status(404).json({ error: 'App not found' });
  }

  // Calculate today from local midnight
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  // Calculate this week from Monday
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset).toISOString();

  const todayUsage = db.prepare(
    'SELECT COALESCE(SUM(duration_seconds), 0) as total FROM app_usage WHERE app_id = ? AND started_at >= ?'
  ).get(req.params.id, todayStart);

  const weekUsage = db.prepare(
    'SELECT COALESCE(SUM(duration_seconds), 0) as total FROM app_usage WHERE app_id = ? AND started_at >= ?'
  ).get(req.params.id, weekStart);

  // Get today's bonus minutes from challenges
  const bonusResult = db.prepare(
    'SELECT COALESCE(SUM(minutes_awarded), 0) as total FROM challenge_completions WHERE completed_at >= ?'
  ).get(todayStart);

  res.json({
    today_seconds: todayUsage.total,
    week_seconds: weekUsage.total,
    daily_limit_minutes: appRecord.daily_limit_minutes,
    weekly_limit_minutes: appRecord.weekly_limit_minutes,
    bonus_minutes_today: bonusResult.total,
  });
});

// Record usage session for an app (public - called by Electron on LAN)
app.post('/api/apps/:id/usage', (req, res) => {
  const appRecord = db.prepare('SELECT id FROM apps WHERE id = ?').get(req.params.id);
  if (!appRecord) {
    return res.status(404).json({ error: 'App not found' });
  }

  const { started_at, ended_at, duration_seconds } = req.body;
  if (!started_at || !ended_at || duration_seconds == null) {
    return res.status(400).json({ error: 'started_at, ended_at, and duration_seconds are required' });
  }

  db.prepare(
    'INSERT INTO app_usage (app_id, started_at, ended_at, duration_seconds) VALUES (?, ?, ?, ?)'
  ).run(req.params.id, started_at, ended_at, duration_seconds);

  res.status(201).json({ success: true });
});

// Verify PIN and get token
app.post('/api/admin/verify-pin', (req, res) => {
  const { pin } = req.body;
  if (!pin) {
    return res.status(400).json({ error: 'PIN is required' });
  }

  const storedPin = db.prepare("SELECT value FROM settings WHERE key = 'pin'").get();
  if (!storedPin || hashPin(pin) !== storedPin.value) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  const token = generateToken();
  validTokens.set(token, { createdAt: Date.now() });

  // Clean up old tokens (older than 1 hour)
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [t, data] of validTokens.entries()) {
    if (data.createdAt < oneHourAgo) {
      validTokens.delete(t);
    }
  }

  res.json({ token });
});

// Change PIN (protected)
app.put('/api/admin/change-pin', requirePin, (req, res) => {
  const { currentPin, newPin } = req.body;
  if (!currentPin || !newPin) {
    return res.status(400).json({ error: 'Current and new PIN are required' });
  }

  if (newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
    return res.status(400).json({ error: 'PIN must be 4-6 digits' });
  }

  const storedPin = db.prepare("SELECT value FROM settings WHERE key = 'pin'").get();
  if (!storedPin || hashPin(currentPin) !== storedPin.value) {
    return res.status(401).json({ error: 'Current PIN is incorrect' });
  }

  db.prepare("UPDATE settings SET value = ? WHERE key = 'pin'").run(hashPin(newPin));
  res.json({ success: true });
});

// Get aggregated usage summary for all apps over the past 7 days (protected)
app.get('/api/admin/usage-summary', requirePin, (req, res) => {
  const now = new Date();
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const apps = db.prepare('SELECT id, name, icon FROM apps ORDER BY sort_order').all();
  const startDate = dates[0] + 'T00:00:00.000Z';

  const usageRows = db.prepare(
    `SELECT app_id, DATE(started_at) as date, SUM(duration_seconds) as seconds
     FROM app_usage
     WHERE started_at >= ?
     GROUP BY app_id, DATE(started_at)`
  ).all(startDate);

  const usageMap = {};
  for (const row of usageRows) {
    if (!usageMap[row.app_id]) usageMap[row.app_id] = {};
    usageMap[row.app_id][row.date] = row.seconds;
  }

  const result = apps.map(app => ({
    id: app.id,
    name: app.name,
    icon: app.icon,
    daily: dates.map(date => ({
      date,
      seconds: (usageMap[app.id] && usageMap[app.id][date]) || 0,
    })),
  }));

  res.json({ dates, apps: result });
});

// Get all settings except PIN hash (protected)
app.get('/api/admin/settings', requirePin, (req, res) => {
  const rows = db.prepare("SELECT key, value FROM settings WHERE key != 'pin'").all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  if (!settings.challenge_bonus_minutes) {
    settings.challenge_bonus_minutes = '10';
  }
  res.json(settings);
});

// Upsert settings key/value pairs (protected)
app.put('/api/admin/settings', requirePin, (req, res) => {
  const settings = req.body;
  if (settings.pin !== undefined) {
    return res.status(400).json({ error: 'Use /api/admin/change-pin to change PIN' });
  }

  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  const transaction = db.transaction((entries) => {
    for (const [key, value] of entries) {
      upsert.run(key, String(value));
    }
  });
  transaction(Object.entries(settings));

  res.json({ success: true });
});

// Get challenge bonus minutes (public - used by Challenges component)
app.get('/api/settings/challenge-bonus-minutes', (req, res) => {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'challenge_bonus_minutes'").get();
  const minutes = row ? parseInt(row.value, 10) : 10;
  res.json({ minutes });
});

// Get all apps including disabled (protected)
app.get('/api/admin/apps', requirePin, (req, res) => {
  const apps = db.prepare('SELECT * FROM apps ORDER BY sort_order').all();
  res.json(apps);
});

// Create new app (protected)
app.post('/api/admin/apps', requirePin, (req, res) => {
  const { name, url, icon, sort_order, app_type = 'url', enabled = 1, daily_limit_minutes = null, weekly_limit_minutes = null } = req.body;
  if (!name || !url || !icon) {
    return res.status(400).json({ error: 'name, url, and icon are required' });
  }

  // Get max sort_order if not provided
  let finalSortOrder = sort_order;
  if (finalSortOrder === undefined) {
    const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM apps').get();
    finalSortOrder = (maxOrder.max || 0) + 1;
  }

  const result = db.prepare('INSERT INTO apps (name, url, icon, sort_order, app_type, enabled, daily_limit_minutes, weekly_limit_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(name, url, icon, finalSortOrder, app_type, enabled, daily_limit_minutes, weekly_limit_minutes);
  const newApp = db.prepare('SELECT * FROM apps WHERE id = ?').get(result.lastInsertRowid);
  broadcastRefresh();
  res.status(201).json(newApp);
});

// Bulk reorder apps (protected) - must be before :id route
app.put('/api/admin/apps/reorder', requirePin, (req, res) => {
  const { order } = req.body; // Array of { id, sort_order }
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'order must be an array' });
  }

  const updateStmt = db.prepare('UPDATE apps SET sort_order = ? WHERE id = ?');
  const transaction = db.transaction((items) => {
    for (const item of items) {
      updateStmt.run(item.sort_order, item.id);
    }
  });

  transaction(order);

  const apps = db.prepare('SELECT * FROM apps ORDER BY sort_order').all();
  broadcastRefresh();
  res.json(apps);
});

// Update app (protected)
app.put('/api/admin/apps/:id', requirePin, (req, res) => {
  const { name, url, icon, sort_order, enabled, app_type, daily_limit_minutes, weekly_limit_minutes } = req.body;
  const existing = db.prepare('SELECT * FROM apps WHERE id = ?').get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'App not found' });
  }

  // Use COALESCE for most fields, but handle limit columns separately since null is a valid value (means "no limit")
  const finalDailyLimit = daily_limit_minutes !== undefined ? daily_limit_minutes : existing.daily_limit_minutes;
  const finalWeeklyLimit = weekly_limit_minutes !== undefined ? weekly_limit_minutes : existing.weekly_limit_minutes;

  db.prepare(`
    UPDATE apps
    SET name = COALESCE(?, name),
        url = COALESCE(?, url),
        icon = COALESCE(?, icon),
        sort_order = COALESCE(?, sort_order),
        enabled = COALESCE(?, enabled),
        app_type = COALESCE(?, app_type),
        daily_limit_minutes = ?,
        weekly_limit_minutes = ?
    WHERE id = ?
  `).run(name, url, icon, sort_order, enabled, app_type, finalDailyLimit, finalWeeklyLimit, req.params.id);

  const updated = db.prepare('SELECT * FROM apps WHERE id = ?').get(req.params.id);
  broadcastRefresh();
  res.json(updated);
});

// Delete app (protected)
app.delete('/api/admin/apps/:id', requirePin, (req, res) => {
  const result = db.prepare('DELETE FROM apps WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'App not found' });
  }
  broadcastRefresh();
  res.status(204).send();
});

// Legacy endpoints (kept for backwards compatibility)
app.post('/api/apps', (req, res) => {
  const { name, url, icon, sort_order = 0 } = req.body;
  if (!name || !url || !icon) {
    return res.status(400).json({ error: 'name, url, and icon are required' });
  }

  const result = db.prepare('INSERT INTO apps (name, url, icon, sort_order) VALUES (?, ?, ?, ?)').run(name, url, icon, sort_order);
  const newApp = db.prepare('SELECT * FROM apps WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(newApp);
});

app.put('/api/apps/:id', (req, res) => {
  const { name, url, icon, sort_order, enabled } = req.body;
  const existing = db.prepare('SELECT * FROM apps WHERE id = ?').get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'App not found' });
  }

  db.prepare(`
    UPDATE apps
    SET name = COALESCE(?, name),
        url = COALESCE(?, url),
        icon = COALESCE(?, icon),
        sort_order = COALESCE(?, sort_order),
        enabled = COALESCE(?, enabled)
    WHERE id = ?
  `).run(name, url, icon, sort_order, enabled, req.params.id);

  const updated = db.prepare('SELECT * FROM apps WHERE id = ?').get(req.params.id);
  res.json(updated);
});

app.delete('/api/apps/:id', (req, res) => {
  const result = db.prepare('DELETE FROM apps WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'App not found' });
  }
  res.status(204).send();
});

server.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
  console.log(`WebSocket server running at ws://localhost:${PORT}/ws`);
});
