import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { broadcastRefresh } from '../websocket.js';

const router = Router();

function verifyProfileOwnership(profileId, accountId) {
  return db.prepare('SELECT id FROM profiles WHERE id = ? AND account_id = ?').get(profileId, accountId);
}

function accountProfileIds(accountId) {
  return db.prepare('SELECT id FROM profiles WHERE account_id = ?').all(accountId).map(r => r.id);
}

// --- Public endpoints ---

// GET /api/folders - Get all folders for a profile
router.get('/api/folders', (req, res) => {
  const profileId = req.query.profile;
  if (profileId) {
    if (!verifyProfileOwnership(profileId, req.accountId)) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    const folders = db.prepare('SELECT id, name, icon, color, sort_order FROM folders WHERE profile_id = ? ORDER BY sort_order').all(profileId);
    return res.json(folders);
  }
  // No profile param — scope to account's profiles
  const profileIds = accountProfileIds(req.accountId);
  if (profileIds.length === 0) return res.json([]);
  const placeholders = profileIds.map(() => '?').join(',');
  const folders = db.prepare(`SELECT id, name, icon, color, sort_order FROM folders WHERE profile_id IN (${placeholders}) ORDER BY sort_order`).all(...profileIds);
  res.json(folders);
});

// --- Admin endpoints ---

// GET /api/admin/folders - Get all folders (admin)
router.get('/api/admin/folders', requireAuth, (req, res) => {
  const profileId = req.query.profile;
  let folders;
  if (profileId) {
    if (!verifyProfileOwnership(profileId, req.accountId)) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    folders = db.prepare('SELECT * FROM folders WHERE profile_id = ? ORDER BY sort_order').all(profileId);
  } else {
    const profileIds = accountProfileIds(req.accountId);
    if (profileIds.length === 0) return res.json([]);
    const placeholders = profileIds.map(() => '?').join(',');
    folders = db.prepare(`SELECT * FROM folders WHERE profile_id IN (${placeholders}) ORDER BY sort_order`).all(...profileIds);
  }
  res.json(folders);
});

// POST /api/admin/folders - Create folder
router.post('/api/admin/folders', requireAuth, (req, res) => {
  const { name, icon = '📁', color = '#6366f1', sort_order, profile_id } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!profile_id) {
    return res.status(400).json({ error: 'profile_id is required' });
  }

  if (!verifyProfileOwnership(profile_id, req.accountId)) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  let finalSortOrder = sort_order;
  if (finalSortOrder === undefined) {
    let maxOrder;
    if (profile_id) {
      maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM folders WHERE profile_id = ?').get(profile_id);
    } else {
      maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM folders').get();
    }
    finalSortOrder = (maxOrder.max || 0) + 1;
  }

  const result = db.prepare('INSERT INTO folders (name, icon, color, sort_order, profile_id) VALUES (?, ?, ?, ?, ?)').run(name, icon, color, finalSortOrder, profile_id);
  const newFolder = db.prepare('SELECT * FROM folders WHERE id = ?').get(result.lastInsertRowid);
  broadcastRefresh();
  res.status(201).json(newFolder);
});

// PUT /api/admin/folders/reorder - Bulk reorder folders
router.put('/api/admin/folders/reorder', requireAuth, (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'order must be an array' });
  }

  const profileIds = accountProfileIds(req.accountId);
  const placeholders = profileIds.map(() => '?').join(',');
  const updateStmt = profileIds.length > 0
    ? db.prepare(`UPDATE folders SET sort_order = ? WHERE id = ? AND profile_id IN (${placeholders})`)
    : null;

  if (updateStmt) {
    const transaction = db.transaction((items) => {
      for (const item of items) {
        updateStmt.run(item.sort_order, item.id, ...profileIds);
      }
    });
    transaction(order);
  }

  const folders = profileIds.length > 0
    ? db.prepare(`SELECT * FROM folders WHERE profile_id IN (${placeholders}) ORDER BY sort_order`).all(...profileIds)
    : [];
  broadcastRefresh();
  res.json(folders);
});

// PUT /api/admin/folders/:id - Update folder
router.put('/api/admin/folders/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM folders WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Folder not found' });
  }
  if (!existing.profile_id || !verifyProfileOwnership(existing.profile_id, req.accountId)) {
    return res.status(404).json({ error: 'Folder not found' });
  }

  const { name, icon, color, sort_order } = req.body;

  db.prepare(`
    UPDATE folders
    SET name = COALESCE(?, name),
        icon = COALESCE(?, icon),
        color = COALESCE(?, color),
        sort_order = COALESCE(?, sort_order)
    WHERE id = ?
  `).run(name, icon, color, sort_order, req.params.id);

  const updated = db.prepare('SELECT * FROM folders WHERE id = ?').get(req.params.id);
  broadcastRefresh();
  res.json(updated);
});

// DELETE /api/admin/folders/:id - Delete folder (moves apps to root first)
router.delete('/api/admin/folders/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM folders WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Folder not found' });
  }
  if (!existing.profile_id || !verifyProfileOwnership(existing.profile_id, req.accountId)) {
    return res.status(404).json({ error: 'Folder not found' });
  }

  // Move apps in this folder to root level
  db.prepare('UPDATE apps SET folder_id = NULL WHERE folder_id = ?').run(req.params.id);

  db.prepare('DELETE FROM folders WHERE id = ?').run(req.params.id);
  broadcastRefresh();
  res.status(204).send();
});

export default router;
