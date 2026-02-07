import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { broadcastRefresh } from '../websocket.js';

const router = Router();

// POST /api/admin/bonus-time - Manually add bonus time
router.post('/api/admin/bonus-time', requireAuth, (req, res) => {
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

// GET /api/admin/settings - Get all settings
router.get('/api/admin/settings', requireAuth, (req, res) => {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  res.json(settings);
});

// PUT /api/admin/settings - Upsert settings key/value pairs
router.put('/api/admin/settings', requireAuth, (req, res) => {
  const settings = req.body;

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
