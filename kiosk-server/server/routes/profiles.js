import { Router } from 'express';
import db, { seedProfileDefaults, getSetting, setSetting, deleteSetting } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { broadcastRefresh } from '../websocket.js';

const router = Router();

// --- Kiosk endpoints (blanket requireAnyAuth in index.js sets req.accountId) ---

// GET /api/profiles - Get profiles for current account
router.get('/api/profiles', (req, res) => {
  const profiles = db.prepare('SELECT id, name, icon, sort_order FROM profiles WHERE account_id = ? ORDER BY sort_order').all(req.accountId);
  res.json(profiles);
});

// GET /api/active-profile - Get active profile (validated against account)
router.get('/api/active-profile', (req, res) => {
  const value = getSetting('active_profile', req.accountId);
  if (value) {
    // Only return if the profile belongs to this account
    const profile = db.prepare('SELECT id FROM profiles WHERE id = ? AND account_id = ?').get(Number(value), req.accountId);
    return res.json({ profile_id: profile ? profile.id : null });
  }
  res.json({ profile_id: null });
});

// POST /api/active-profile - Set active profile (must belong to account)
router.post('/api/active-profile', (req, res) => {
  const { profile_id } = req.body;
  if (profile_id == null) {
    deleteSetting('active_profile', req.accountId);
  } else {
    // Verify the profile belongs to this account
    const profile = db.prepare('SELECT id FROM profiles WHERE id = ? AND account_id = ?').get(profile_id, req.accountId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    setSetting('active_profile', String(profile_id), req.accountId);
  }
  broadcastRefresh();
  res.json({ success: true });
});

// --- Admin endpoints ---

// GET /api/admin/profiles - Get profiles for this account
router.get('/api/admin/profiles', requireAuth, (req, res) => {
  const profiles = db.prepare('SELECT * FROM profiles WHERE account_id = ? ORDER BY sort_order').all(req.accountId);
  res.json(profiles);
});

// POST /api/admin/profiles - Create profile
router.post('/api/admin/profiles', requireAuth, (req, res) => {
  const { name, icon = '👤', age } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM profiles WHERE account_id = ?').get(req.accountId);
  const sortOrder = (maxOrder.max || 0) + 1;

  const parsedAge = age != null ? Number(age) || null : null;
  const result = db.prepare('INSERT INTO profiles (name, icon, sort_order, account_id, age) VALUES (?, ?, ?, ?, ?)').run(name, icon, sortOrder, req.accountId, parsedAge);
  const profileId = result.lastInsertRowid;

  seedProfileDefaults(profileId, parsedAge);

  const newProfile = db.prepare('SELECT * FROM profiles WHERE id = ? AND account_id = ?').get(profileId, req.accountId);
  broadcastRefresh();
  res.status(201).json(newProfile);
});

// PUT /api/admin/profiles/reorder - Bulk reorder profiles
router.put('/api/admin/profiles/reorder', requireAuth, (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'order must be an array' });
  }

  const updateStmt = db.prepare('UPDATE profiles SET sort_order = ? WHERE id = ? AND account_id = ?');
  const transaction = db.transaction((items) => {
    for (const item of items) {
      updateStmt.run(item.sort_order, item.id, req.accountId);
    }
  });
  transaction(order);

  const profiles = db.prepare('SELECT * FROM profiles WHERE account_id = ? ORDER BY sort_order').all(req.accountId);
  broadcastRefresh();
  res.json(profiles);
});

// PUT /api/admin/profiles/:id - Update profile
router.put('/api/admin/profiles/:id', requireAuth, (req, res) => {
  const { name, icon, age } = req.body;
  const existing = db.prepare('SELECT * FROM profiles WHERE id = ? AND account_id = ?').get(req.params.id, req.accountId);
  if (!existing) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  const parsedAge = age !== undefined ? (age != null ? Number(age) || null : null) : undefined;
  db.prepare(`
    UPDATE profiles
    SET name = COALESCE(?, name),
        icon = COALESCE(?, icon),
        age = COALESCE(?, age)
    WHERE id = ? AND account_id = ?
  `).run(name, icon, parsedAge !== undefined ? parsedAge : existing.age, req.params.id, req.accountId);

  const updated = db.prepare('SELECT * FROM profiles WHERE id = ? AND account_id = ?').get(req.params.id, req.accountId);
  broadcastRefresh();
  res.json(updated);
});

// DELETE /api/admin/profiles/:id - Delete profile
router.delete('/api/admin/profiles/:id', requireAuth, (req, res) => {
  const profileId = req.params.id;

  // Verify ownership before deleting
  const existing = db.prepare('SELECT id FROM profiles WHERE id = ? AND account_id = ?').get(profileId, req.accountId);
  if (!existing) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  db.prepare('DELETE FROM messages WHERE sender_profile_id = ? OR recipient_profile_id = ?').run(profileId, profileId);
  db.prepare('DELETE FROM challenge_completions WHERE profile_id = ?').run(profileId);
  db.prepare('DELETE FROM app_usage WHERE profile_id = ?').run(profileId);
  db.prepare('DELETE FROM challenges WHERE profile_id = ?').run(profileId);
  db.prepare('DELETE FROM folders WHERE profile_id = ?').run(profileId);
  db.prepare('DELETE FROM apps WHERE profile_id = ?').run(profileId);
  db.prepare('DELETE FROM profiles WHERE id = ? AND account_id = ?').run(profileId, req.accountId);

  const active = getSetting('active_profile', req.accountId);
  if (active === String(profileId)) {
    deleteSetting('active_profile', req.accountId);
  }

  broadcastRefresh();
  res.status(204).send();
});

export default router;
