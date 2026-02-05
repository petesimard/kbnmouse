import express from 'express';
import crypto from 'crypto';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import OpenAI from 'openai';
import db, { hashPin, seedProfileDefaults } from './db.js';

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

// --- Profile endpoints (public) ---

// Get all profiles
app.get('/api/profiles', (req, res) => {
  const profiles = db.prepare('SELECT id, name, icon, sort_order FROM profiles ORDER BY sort_order').all();
  res.json(profiles);
});

// Get active profile from settings
app.get('/api/active-profile', (req, res) => {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'active_profile'").get();
  res.json({ profile_id: row ? Number(row.value) : null });
});

// Set active profile
app.post('/api/active-profile', (req, res) => {
  const { profile_id } = req.body;
  if (profile_id == null) {
    // Clear active profile
    db.prepare("DELETE FROM settings WHERE key = 'active_profile'").run();
  } else {
    db.prepare(
      "INSERT INTO settings (key, value) VALUES ('active_profile', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(String(profile_id));
  }
  broadcastRefresh();
  res.json({ success: true });
});

// Get all enabled apps (public) - supports ?profile=<id>
app.get('/api/apps', (req, res) => {
  const profileId = req.query.profile;
  let apps;
  if (profileId) {
    apps = db.prepare('SELECT id, name, url, icon, app_type FROM apps WHERE enabled = 1 AND profile_id = ? ORDER BY sort_order').all(profileId);
  } else {
    apps = db.prepare('SELECT id, name, url, icon, app_type FROM apps WHERE enabled = 1 ORDER BY sort_order').all();
  }
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

// Get today's bonus minutes from challenge completions (public) - supports ?profile=<id>
app.get('/api/bonus-time', (req, res) => {
  const profileId = req.query.profile;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  let result;
  if (profileId) {
    result = db.prepare(
      'SELECT COALESCE(SUM(minutes_awarded), 0) as total FROM challenge_completions WHERE completed_at >= ? AND profile_id = ?'
    ).get(todayStart, profileId);
  } else {
    result = db.prepare(
      'SELECT COALESCE(SUM(minutes_awarded), 0) as total FROM challenge_completions WHERE completed_at >= ?'
    ).get(todayStart);
  }

  res.json({ today_bonus_minutes: result.total });
});

// Manually add bonus time (protected - parent only) - supports profile_id in body
app.post('/api/admin/bonus-time', requirePin, (req, res) => {
  const { minutes, profile_id } = req.body;
  if (!minutes || minutes < 1) {
    return res.status(400).json({ error: 'minutes is required and must be at least 1' });
  }

  db.prepare(
    'INSERT INTO challenge_completions (challenge_type, minutes_awarded, completed_at, profile_id) VALUES (?, ?, ?, ?)'
  ).run('parent_bonus', minutes, new Date().toISOString(), profile_id || null);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  let result;
  if (profile_id) {
    result = db.prepare(
      'SELECT COALESCE(SUM(minutes_awarded), 0) as total FROM challenge_completions WHERE completed_at >= ? AND profile_id = ?'
    ).get(todayStart, profile_id);
  } else {
    result = db.prepare(
      'SELECT COALESCE(SUM(minutes_awarded), 0) as total FROM challenge_completions WHERE completed_at >= ?'
    ).get(todayStart);
  }

  broadcastRefresh();
  res.json({ success: true, today_bonus_minutes: result.total });
});

// Get all enabled challenges (public - kid-facing) - supports ?profile=<id>
app.get('/api/challenges', (req, res) => {
  const profileId = req.query.profile;
  let challenges;
  if (profileId) {
    challenges = db.prepare(
      'SELECT id, name, icon, description, challenge_type, reward_minutes, config, sort_order FROM challenges WHERE enabled = 1 AND profile_id = ? ORDER BY sort_order'
    ).all(profileId);
  } else {
    challenges = db.prepare(
      'SELECT id, name, icon, description, challenge_type, reward_minutes, config, sort_order FROM challenges WHERE enabled = 1 ORDER BY sort_order'
    ).all();
  }
  const parsed = challenges.map(c => ({ ...c, config: JSON.parse(c.config || '{}') }));
  res.json(parsed);
});

// Record a challenge completion (public) - supports profile_id in body
app.post('/api/challenges/complete', (req, res) => {
  const { challenge_type, minutes_awarded, challenge_id, profile_id } = req.body;
  if (!challenge_type || minutes_awarded == null) {
    return res.status(400).json({ error: 'challenge_type and minutes_awarded are required' });
  }

  db.prepare(
    'INSERT INTO challenge_completions (challenge_type, minutes_awarded, completed_at, profile_id) VALUES (?, ?, ?, ?)'
  ).run(challenge_type, minutes_awarded, new Date().toISOString(), profile_id || null);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  let result;
  if (profile_id) {
    result = db.prepare(
      'SELECT COALESCE(SUM(minutes_awarded), 0) as total FROM challenge_completions WHERE completed_at >= ? AND profile_id = ?'
    ).get(todayStart, profile_id);
  } else {
    result = db.prepare(
      'SELECT COALESCE(SUM(minutes_awarded), 0) as total FROM challenge_completions WHERE completed_at >= ?'
    ).get(todayStart);
  }

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

  // Get today's bonus minutes from challenges, scoped by app's profile
  const profileId = appRecord.profile_id;
  let bonusResult;
  if (profileId) {
    bonusResult = db.prepare(
      'SELECT COALESCE(SUM(minutes_awarded), 0) as total FROM challenge_completions WHERE completed_at >= ? AND profile_id = ?'
    ).get(todayStart, profileId);
  } else {
    bonusResult = db.prepare(
      'SELECT COALESCE(SUM(minutes_awarded), 0) as total FROM challenge_completions WHERE completed_at >= ?'
    ).get(todayStart);
  }

  res.json({
    today_seconds: todayUsage.total,
    week_seconds: weekUsage.total,
    daily_limit_minutes: appRecord.daily_limit_minutes,
    weekly_limit_minutes: appRecord.weekly_limit_minutes,
    max_daily_minutes: appRecord.max_daily_minutes || 0,
    bonus_minutes_today: bonusResult.total,
  });
});

// Record usage session for an app (public - called by Electron on LAN)
app.post('/api/apps/:id/usage', (req, res) => {
  const appRecord = db.prepare('SELECT id, profile_id FROM apps WHERE id = ?').get(req.params.id);
  if (!appRecord) {
    return res.status(404).json({ error: 'App not found' });
  }

  const { started_at, ended_at, duration_seconds } = req.body;
  if (!started_at || !ended_at || duration_seconds == null) {
    return res.status(400).json({ error: 'started_at, ended_at, and duration_seconds are required' });
  }

  db.prepare(
    'INSERT INTO app_usage (app_id, started_at, ended_at, duration_seconds, profile_id) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.id, started_at, ended_at, duration_seconds, appRecord.profile_id || null);

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

// Get aggregated usage summary for all apps over the past 7 days (protected) - supports ?profile=<id>
app.get('/api/admin/usage-summary', requirePin, (req, res) => {
  const profileId = req.query.profile;
  const now = new Date();
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  let apps;
  if (profileId) {
    apps = db.prepare('SELECT id, name, icon FROM apps WHERE profile_id = ? ORDER BY sort_order').all(profileId);
  } else {
    apps = db.prepare('SELECT id, name, icon FROM apps ORDER BY sort_order').all();
  }
  const startDate = dates[0] + 'T00:00:00.000Z';

  let usageRows;
  if (profileId) {
    usageRows = db.prepare(
      `SELECT app_id, DATE(started_at) as date, SUM(duration_seconds) as seconds
       FROM app_usage
       WHERE started_at >= ? AND profile_id = ?
       GROUP BY app_id, DATE(started_at)`
    ).all(startDate, profileId);
  } else {
    usageRows = db.prepare(
      `SELECT app_id, DATE(started_at) as date, SUM(duration_seconds) as seconds
       FROM app_usage
       WHERE started_at >= ?
       GROUP BY app_id, DATE(started_at)`
    ).all(startDate);
  }

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

// --- Admin profile endpoints ---

// Get all profiles (admin)
app.get('/api/admin/profiles', requirePin, (req, res) => {
  const profiles = db.prepare('SELECT * FROM profiles ORDER BY sort_order').all();
  res.json(profiles);
});

// Create profile (admin)
app.post('/api/admin/profiles', requirePin, (req, res) => {
  const { name, icon = '👤' } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM profiles').get();
  const sortOrder = (maxOrder.max || 0) + 1;

  const result = db.prepare('INSERT INTO profiles (name, icon, sort_order) VALUES (?, ?, ?)').run(name, icon, sortOrder);
  const profileId = result.lastInsertRowid;

  seedProfileDefaults(profileId);

  const newProfile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId);
  broadcastRefresh();
  res.status(201).json(newProfile);
});

// Update profile (admin)
app.put('/api/admin/profiles/:id', requirePin, (req, res) => {
  const { name, icon } = req.body;
  const existing = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  db.prepare(`
    UPDATE profiles
    SET name = COALESCE(?, name),
        icon = COALESCE(?, icon)
    WHERE id = ?
  `).run(name, icon, req.params.id);

  const updated = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.params.id);
  broadcastRefresh();
  res.json(updated);
});

// Bulk reorder profiles (admin) - must be before :id route
app.put('/api/admin/profiles/reorder', requirePin, (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'order must be an array' });
  }

  const updateStmt = db.prepare('UPDATE profiles SET sort_order = ? WHERE id = ?');
  const transaction = db.transaction((items) => {
    for (const item of items) {
      updateStmt.run(item.sort_order, item.id);
    }
  });
  transaction(order);

  const profiles = db.prepare('SELECT * FROM profiles ORDER BY sort_order').all();
  broadcastRefresh();
  res.json(profiles);
});

// Delete profile (admin)
app.delete('/api/admin/profiles/:id', requirePin, (req, res) => {
  const profileId = req.params.id;

  // Don't allow deleting the last profile
  const profileCount = db.prepare('SELECT COUNT(*) as count FROM profiles').get();
  if (profileCount.count <= 1) {
    return res.status(400).json({ error: 'Cannot delete the last profile' });
  }

  // Delete associated data
  db.prepare('DELETE FROM challenge_completions WHERE profile_id = ?').run(profileId);
  db.prepare('DELETE FROM app_usage WHERE profile_id = ?').run(profileId);
  db.prepare('DELETE FROM challenges WHERE profile_id = ?').run(profileId);
  db.prepare('DELETE FROM apps WHERE profile_id = ?').run(profileId);
  const result = db.prepare('DELETE FROM profiles WHERE id = ?').run(profileId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  // Clear active profile if it was the deleted one
  const active = db.prepare("SELECT value FROM settings WHERE key = 'active_profile'").get();
  if (active && active.value === String(profileId)) {
    db.prepare("DELETE FROM settings WHERE key = 'active_profile'").run();
  }

  broadcastRefresh();
  res.status(204).send();
});

// Get all apps including disabled (protected) - supports ?profile=<id>
app.get('/api/admin/apps', requirePin, (req, res) => {
  const profileId = req.query.profile;
  let apps;
  if (profileId) {
    apps = db.prepare('SELECT * FROM apps WHERE profile_id = ? ORDER BY sort_order').all(profileId);
  } else {
    apps = db.prepare('SELECT * FROM apps ORDER BY sort_order').all();
  }
  const parsed = apps.map(a => ({ ...a, config: JSON.parse(a.config || '{}') }));
  res.json(parsed);
});

// Create new app (protected) - supports profile_id in body
app.post('/api/admin/apps', requirePin, (req, res) => {
  const { name, url, icon, sort_order, app_type = 'url', enabled = 1, daily_limit_minutes = null, weekly_limit_minutes = null, max_daily_minutes = 0, profile_id = null, config = {} } = req.body;
  if (!name || !url || !icon) {
    return res.status(400).json({ error: 'name, url, and icon are required' });
  }

  // Get max sort_order if not provided
  let finalSortOrder = sort_order;
  if (finalSortOrder === undefined) {
    let maxOrder;
    if (profile_id) {
      maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM apps WHERE profile_id = ?').get(profile_id);
    } else {
      maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM apps').get();
    }
    finalSortOrder = (maxOrder.max || 0) + 1;
  }

  const configStr = typeof config === 'string' ? config : JSON.stringify(config);
  const result = db.prepare('INSERT INTO apps (name, url, icon, sort_order, app_type, enabled, daily_limit_minutes, weekly_limit_minutes, max_daily_minutes, profile_id, config) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(name, url, icon, finalSortOrder, app_type, enabled, daily_limit_minutes, weekly_limit_minutes, max_daily_minutes, profile_id, configStr);
  const newApp = db.prepare('SELECT * FROM apps WHERE id = ?').get(result.lastInsertRowid);
  newApp.config = JSON.parse(newApp.config || '{}');
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
  const { name, url, icon, sort_order, enabled, app_type, daily_limit_minutes, weekly_limit_minutes, max_daily_minutes, config } = req.body;
  const existing = db.prepare('SELECT * FROM apps WHERE id = ?').get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'App not found' });
  }

  // Use COALESCE for most fields, but handle limit columns separately since null is a valid value (means "no limit")
  const finalDailyLimit = daily_limit_minutes !== undefined ? daily_limit_minutes : existing.daily_limit_minutes;
  const finalWeeklyLimit = weekly_limit_minutes !== undefined ? weekly_limit_minutes : existing.weekly_limit_minutes;
  const finalMaxDaily = max_daily_minutes !== undefined ? max_daily_minutes : existing.max_daily_minutes;
  const finalConfig = config !== undefined ? (typeof config === 'string' ? config : JSON.stringify(config)) : existing.config;

  db.prepare(`
    UPDATE apps
    SET name = COALESCE(?, name),
        url = COALESCE(?, url),
        icon = COALESCE(?, icon),
        sort_order = COALESCE(?, sort_order),
        enabled = COALESCE(?, enabled),
        app_type = COALESCE(?, app_type),
        daily_limit_minutes = ?,
        weekly_limit_minutes = ?,
        max_daily_minutes = ?,
        config = ?
    WHERE id = ?
  `).run(name, url, icon, sort_order, enabled, app_type, finalDailyLimit, finalWeeklyLimit, finalMaxDaily, finalConfig, req.params.id);

  const updated = db.prepare('SELECT * FROM apps WHERE id = ?').get(req.params.id);
  updated.config = JSON.parse(updated.config || '{}');
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

// --- Challenge admin endpoints ---

// Get all challenges including disabled (protected) - supports ?profile=<id>
app.get('/api/admin/challenges', requirePin, (req, res) => {
  const profileId = req.query.profile;
  let challenges;
  if (profileId) {
    challenges = db.prepare('SELECT * FROM challenges WHERE profile_id = ? ORDER BY sort_order').all(profileId);
  } else {
    challenges = db.prepare('SELECT * FROM challenges ORDER BY sort_order').all();
  }
  const parsed = challenges.map(c => ({ ...c, config: JSON.parse(c.config || '{}') }));
  res.json(parsed);
});

// Create new challenge (protected) - supports profile_id in body
app.post('/api/admin/challenges', requirePin, (req, res) => {
  const { name, icon, description = '', challenge_type, reward_minutes = 10, config = {}, sort_order, enabled = 1, profile_id = null } = req.body;
  if (!name || !icon || !challenge_type) {
    return res.status(400).json({ error: 'name, icon, and challenge_type are required' });
  }

  let finalSortOrder = sort_order;
  if (finalSortOrder === undefined) {
    let maxOrder;
    if (profile_id) {
      maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM challenges WHERE profile_id = ?').get(profile_id);
    } else {
      maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM challenges').get();
    }
    finalSortOrder = (maxOrder.max || 0) + 1;
  }

  const configStr = typeof config === 'string' ? config : JSON.stringify(config);
  const result = db.prepare(
    'INSERT INTO challenges (name, icon, description, challenge_type, reward_minutes, config, sort_order, enabled, profile_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(name, icon, description, challenge_type, reward_minutes, configStr, finalSortOrder, enabled, profile_id);

  const newChallenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(result.lastInsertRowid);
  newChallenge.config = JSON.parse(newChallenge.config || '{}');
  broadcastRefresh();
  res.status(201).json(newChallenge);
});

// Bulk reorder challenges (protected) - must be before :id route
app.put('/api/admin/challenges/reorder', requirePin, (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'order must be an array' });
  }

  const updateStmt = db.prepare('UPDATE challenges SET sort_order = ? WHERE id = ?');
  const transaction = db.transaction((items) => {
    for (const item of items) {
      updateStmt.run(item.sort_order, item.id);
    }
  });

  transaction(order);

  const challenges = db.prepare('SELECT * FROM challenges ORDER BY sort_order').all();
  const parsed = challenges.map(c => ({ ...c, config: JSON.parse(c.config || '{}') }));
  broadcastRefresh();
  res.json(parsed);
});

// Update challenge (protected)
app.put('/api/admin/challenges/:id', requirePin, (req, res) => {
  const { name, icon, description, challenge_type, reward_minutes, config, sort_order, enabled } = req.body;
  const existing = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Challenge not found' });
  }

  const configStr = config !== undefined ? (typeof config === 'string' ? config : JSON.stringify(config)) : existing.config;

  db.prepare(`
    UPDATE challenges
    SET name = COALESCE(?, name),
        icon = COALESCE(?, icon),
        description = COALESCE(?, description),
        challenge_type = COALESCE(?, challenge_type),
        reward_minutes = COALESCE(?, reward_minutes),
        config = ?,
        sort_order = COALESCE(?, sort_order),
        enabled = COALESCE(?, enabled)
    WHERE id = ?
  `).run(name, icon, description, challenge_type, reward_minutes, configStr, sort_order, enabled, req.params.id);

  const updated = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);
  updated.config = JSON.parse(updated.config || '{}');
  broadcastRefresh();
  res.json(updated);
});

// Delete challenge (protected)
app.delete('/api/admin/challenges/:id', requirePin, (req, res) => {
  const result = db.prepare('DELETE FROM challenges WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Challenge not found' });
  }
  broadcastRefresh();
  res.status(204).send();
});

// --- ChatBot endpoint ---

// Send message to chatbot (public - uses app's API key)
app.post('/api/chatbot/message', async (req, res) => {
  const { app_id, messages } = req.body;
  if (!app_id || !messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'app_id and messages array are required' });
  }

  const appRecord = db.prepare('SELECT * FROM apps WHERE id = ?').get(app_id);
  if (!appRecord) {
    return res.status(404).json({ error: 'App not found' });
  }

  const config = JSON.parse(appRecord.config || '{}');
  if (!config.openai_api_key) {
    return res.json({ error: 'api_key_missing' });
  }

  try {
    const openai = new OpenAI({ apiKey: config.openai_api_key });

    // Prepend system prompt if configured
    const systemPrompt = config.system_prompt ?? 'You are a friendly, helpful assistant for children. Keep your responses simple, age-appropriate, and encouraging. Avoid any inappropriate content, violence, or scary topics. Be patient and explain things in a way that is easy to understand. If asked about something inappropriate, politely redirect to a safer topic.';
    const model = config.model || 'gpt-5-mini';

    console.log('[ChatBot] Model:', model);
    console.log('[ChatBot] System prompt:', systemPrompt);

    const messagesWithSystem = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    const completion = await openai.chat.completions.create({
      model,
      messages: messagesWithSystem,
    });

    const response = completion.choices[0]?.message?.content || '';
    res.json({ response });
  } catch (err) {
    console.error('OpenAI API error:', err.message);
    if (err.status === 401) {
      return res.json({ error: 'api_key_invalid' });
    }
    res.status(500).json({ error: 'Failed to get response from AI' });
  }
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
