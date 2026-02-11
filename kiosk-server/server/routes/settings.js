import { Router } from 'express';
import db, { getSetting, setSetting } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { broadcastRefresh } from '../websocket.js';

const router = Router();

const ALLOWED_SETTINGS_KEYS = new Set([
  'openai_api_key',
  'openai_endpoint_url',
  'resend_api_key',
  'resend_from_email',
  'google_api_key',
  'parent_name',
]);

const DEFAULT_PARENT_NAME = 'Mom & Dad';

// GET /api/parent-name - Get the parent display name (works with any auth)
router.get('/api/parent-name', (req, res) => {
  const value = getSetting('parent_name', req.accountId);
  res.json({ name: value || DEFAULT_PARENT_NAME });
});

// POST /api/admin/bonus-time - Manually add bonus time
router.post('/api/admin/bonus-time', requireAuth, (req, res) => {
  const { minutes, profile_id } = req.body;
  if (!minutes || minutes < 1) {
    return res.status(400).json({ error: 'minutes is required and must be at least 1' });
  }
  if (!profile_id) {
    return res.status(400).json({ error: 'profile_id is required' });
  }

  const profile = db.prepare('SELECT id FROM profiles WHERE id = ? AND account_id = ?').get(profile_id, req.accountId);
  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  db.prepare(
    'INSERT INTO challenge_completions (challenge_type, minutes_awarded, completed_at, profile_id) VALUES (?, ?, ?, ?)'
  ).run('parent_bonus', minutes, new Date().toISOString(), profile_id);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const result = db.prepare(
    'SELECT COALESCE(SUM(minutes_awarded), 0) as total FROM challenge_completions WHERE completed_at >= ? AND profile_id = ?'
  ).get(todayStart, profile_id);

  broadcastRefresh();
  res.json({ success: true, today_bonus_minutes: result.total });
});

// GET /api/admin/settings - Get all settings for this account
router.get('/api/admin/settings', requireAuth, (req, res) => {
  const rows = db.prepare("SELECT key, value FROM settings WHERE account_id = ?").all(req.accountId);
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  res.json(settings);
});

// PUT /api/admin/settings - Upsert settings key/value pairs (allowlisted keys only)
router.put('/api/admin/settings', requireAuth, (req, res) => {
  const settings = req.body;

  const invalidKeys = Object.keys(settings).filter(k => !ALLOWED_SETTINGS_KEYS.has(k));
  if (invalidKeys.length > 0) {
    return res.status(400).json({ error: `Invalid settings keys: ${invalidKeys.join(', ')}` });
  }

  for (const [key, value] of Object.entries(settings)) {
    setSetting(key, value, req.accountId);
  }

  res.json({ success: true });
});

export default router;
