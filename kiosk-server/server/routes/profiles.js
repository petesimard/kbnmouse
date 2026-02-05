import { Router } from 'express';
import db, { seedProfileDefaults } from '../db.js';
import { requirePin } from '../middleware/auth.js';
import { broadcastRefresh } from '../websocket.js';

const router = Router();

// --- Public endpoints ---

// GET /api/profiles - Get all profiles
router.get('/api/profiles', (req, res) => {
  const profiles = db.prepare('SELECT id, name, icon, sort_order FROM profiles ORDER BY sort_order').all();
  res.json(profiles);
});

// GET /api/active-profile - Get active profile from settings
router.get('/api/active-profile', (req, res) => {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'active_profile'").get();
  res.json({ profile_id: row ? Number(row.value) : null });
});

// POST /api/active-profile - Set active profile
router.post('/api/active-profile', (req, res) => {
  const { profile_id } = req.body;
  if (profile_id == null) {
    db.prepare("DELETE FROM settings WHERE key = 'active_profile'").run();
  } else {
    db.prepare(
      "INSERT INTO settings (key, value) VALUES ('active_profile', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(String(profile_id));
  }
  broadcastRefresh();
  res.json({ success: true });
});

// --- Admin endpoints ---

// GET /api/admin/profiles - Get all profiles (admin)
router.get('/api/admin/profiles', requirePin, (req, res) => {
  const profiles = db.prepare('SELECT * FROM profiles ORDER BY sort_order').all();
  res.json(profiles);
});

// POST /api/admin/profiles - Create profile
router.post('/api/admin/profiles', requirePin, (req, res) => {
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

// PUT /api/admin/profiles/reorder - Bulk reorder profiles
router.put('/api/admin/profiles/reorder', requirePin, (req, res) => {
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

// PUT /api/admin/profiles/:id - Update profile
router.put('/api/admin/profiles/:id', requirePin, (req, res) => {
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

// DELETE /api/admin/profiles/:id - Delete profile
router.delete('/api/admin/profiles/:id', requirePin, (req, res) => {
  const profileId = req.params.id;

  const profileCount = db.prepare('SELECT COUNT(*) as count FROM profiles').get();
  if (profileCount.count <= 1) {
    return res.status(400).json({ error: 'Cannot delete the last profile' });
  }

  db.prepare('DELETE FROM challenge_completions WHERE profile_id = ?').run(profileId);
  db.prepare('DELETE FROM app_usage WHERE profile_id = ?').run(profileId);
  db.prepare('DELETE FROM challenges WHERE profile_id = ?').run(profileId);
  db.prepare('DELETE FROM apps WHERE profile_id = ?').run(profileId);
  const result = db.prepare('DELETE FROM profiles WHERE id = ?').run(profileId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  const active = db.prepare("SELECT value FROM settings WHERE key = 'active_profile'").get();
  if (active && active.value === String(profileId)) {
    db.prepare("DELETE FROM settings WHERE key = 'active_profile'").run();
  }

  broadcastRefresh();
  res.status(204).send();
});

export default router;
