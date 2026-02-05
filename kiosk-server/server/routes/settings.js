import { Router } from 'express';
import db, { hashPin } from '../db.js';
import { requirePin, generateToken, storeToken, cleanupTokens } from '../middleware/auth.js';
import { broadcastRefresh } from '../websocket.js';

const router = Router();

// POST /api/admin/verify-pin - Verify PIN and get token
router.post('/api/admin/verify-pin', (req, res) => {
  const { pin } = req.body;
  if (!pin) {
    return res.status(400).json({ error: 'PIN is required' });
  }

  const storedPin = db.prepare("SELECT value FROM settings WHERE key = 'pin'").get();
  if (!storedPin || hashPin(pin) !== storedPin.value) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  const token = generateToken();
  storeToken(token);
  cleanupTokens();

  res.json({ token });
});

// PUT /api/admin/change-pin - Change PIN
router.put('/api/admin/change-pin', requirePin, (req, res) => {
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

// POST /api/admin/bonus-time - Manually add bonus time
router.post('/api/admin/bonus-time', requirePin, (req, res) => {
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

// GET /api/admin/settings - Get all settings except PIN hash
router.get('/api/admin/settings', requirePin, (req, res) => {
  const rows = db.prepare("SELECT key, value FROM settings WHERE key != 'pin'").all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  res.json(settings);
});

// PUT /api/admin/settings - Upsert settings key/value pairs
router.put('/api/admin/settings', requirePin, (req, res) => {
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

export default router;
