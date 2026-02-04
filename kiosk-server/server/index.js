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

// Get all apps including disabled (protected)
app.get('/api/admin/apps', requirePin, (req, res) => {
  const apps = db.prepare('SELECT * FROM apps ORDER BY sort_order').all();
  res.json(apps);
});

// Create new app (protected)
app.post('/api/admin/apps', requirePin, (req, res) => {
  const { name, url, icon, sort_order, app_type = 'url', enabled = 1 } = req.body;
  if (!name || !url || !icon) {
    return res.status(400).json({ error: 'name, url, and icon are required' });
  }

  // Get max sort_order if not provided
  let finalSortOrder = sort_order;
  if (finalSortOrder === undefined) {
    const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM apps').get();
    finalSortOrder = (maxOrder.max || 0) + 1;
  }

  const result = db.prepare('INSERT INTO apps (name, url, icon, sort_order, app_type, enabled) VALUES (?, ?, ?, ?, ?, ?)').run(name, url, icon, finalSortOrder, app_type, enabled);
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
  const { name, url, icon, sort_order, enabled, app_type } = req.body;
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
        enabled = COALESCE(?, enabled),
        app_type = COALESCE(?, app_type)
    WHERE id = ?
  `).run(name, url, icon, sort_order, enabled, app_type, req.params.id);

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
