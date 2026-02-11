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

// GET /api/apps - Get all enabled apps
router.get('/api/apps', (req, res) => {
  const profileId = req.query.profile;
  if (profileId) {
    if (!verifyProfileOwnership(profileId, req.accountId)) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    const apps = db.prepare('SELECT id, name, url, icon, app_type, folder_id FROM apps WHERE enabled = 1 AND profile_id = ? ORDER BY sort_order').all(profileId);
    return res.json(apps);
  }
  // No profile param — return apps for all account profiles
  const profileIds = accountProfileIds(req.accountId);
  if (profileIds.length === 0) return res.json([]);
  const placeholders = profileIds.map(() => '?').join(',');
  const apps = db.prepare(`SELECT id, name, url, icon, app_type, folder_id FROM apps WHERE enabled = 1 AND profile_id IN (${placeholders}) ORDER BY sort_order`).all(...profileIds);
  res.json(apps);
});

// GET /api/apps/:id - Get single app
router.get('/api/apps/:id', (req, res) => {
  const appRecord = db.prepare('SELECT * FROM apps WHERE id = ?').get(req.params.id);
  if (!appRecord) {
    return res.status(404).json({ error: 'App not found' });
  }
  if (appRecord.profile_id && !verifyProfileOwnership(appRecord.profile_id, req.accountId)) {
    return res.status(404).json({ error: 'App not found' });
  }
  res.json(appRecord);
});

// --- Admin endpoints ---

// GET /api/admin/apps - Get all apps including disabled
router.get('/api/admin/apps', requireAuth, (req, res) => {
  const profileId = req.query.profile;
  let apps;
  if (profileId) {
    if (!verifyProfileOwnership(profileId, req.accountId)) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    apps = db.prepare('SELECT * FROM apps WHERE profile_id = ? ORDER BY sort_order').all(profileId);
  } else {
    const profileIds = accountProfileIds(req.accountId);
    if (profileIds.length === 0) return res.json([]);
    const placeholders = profileIds.map(() => '?').join(',');
    apps = db.prepare(`SELECT * FROM apps WHERE profile_id IN (${placeholders}) ORDER BY sort_order`).all(...profileIds);
  }
  const parsed = apps.map(a => ({ ...a, config: JSON.parse(a.config || '{}') }));
  res.json(parsed);
});

// POST /api/admin/apps - Create new app
router.post('/api/admin/apps', requireAuth, (req, res) => {
  const { name, url, icon, sort_order, app_type = 'url', enabled = 1, daily_limit_minutes = null, weekly_limit_minutes = null, max_daily_minutes = 0, profile_id = null, config = {}, folder_id = null } = req.body;
  if (!name || !url || !icon) {
    return res.status(400).json({ error: 'name, url, and icon are required' });
  }

  if (profile_id && !verifyProfileOwnership(profile_id, req.accountId)) {
    return res.status(404).json({ error: 'Profile not found' });
  }

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
  const result = db.prepare('INSERT INTO apps (name, url, icon, sort_order, app_type, enabled, daily_limit_minutes, weekly_limit_minutes, max_daily_minutes, profile_id, config, folder_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(name, url, icon, finalSortOrder, app_type, enabled, daily_limit_minutes, weekly_limit_minutes, max_daily_minutes, profile_id, configStr, folder_id);
  const newApp = db.prepare('SELECT * FROM apps WHERE id = ?').get(result.lastInsertRowid);
  newApp.config = JSON.parse(newApp.config || '{}');
  broadcastRefresh();
  res.status(201).json(newApp);
});

// PUT /api/admin/apps/reorder - Bulk reorder apps
router.put('/api/admin/apps/reorder', requireAuth, (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'order must be an array' });
  }

  // Only update apps belonging to account's profiles
  const profileIds = accountProfileIds(req.accountId);
  const placeholders = profileIds.map(() => '?').join(',');
  const updateStmt = profileIds.length > 0
    ? db.prepare(`UPDATE apps SET sort_order = ? WHERE id = ? AND profile_id IN (${placeholders})`)
    : null;

  if (updateStmt) {
    const transaction = db.transaction((items) => {
      for (const item of items) {
        updateStmt.run(item.sort_order, item.id, ...profileIds);
      }
    });
    transaction(order);
  }

  const apps = profileIds.length > 0
    ? db.prepare(`SELECT * FROM apps WHERE profile_id IN (${placeholders}) ORDER BY sort_order`).all(...profileIds)
    : [];
  broadcastRefresh();
  res.json(apps);
});

// PUT /api/admin/apps/:id - Update app
router.put('/api/admin/apps/:id', requireAuth, (req, res) => {
  const { name, url, icon, sort_order, enabled, app_type, daily_limit_minutes, weekly_limit_minutes, max_daily_minutes, config } = req.body;
  const existing = db.prepare('SELECT * FROM apps WHERE id = ?').get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'App not found' });
  }
  if (existing.profile_id && !verifyProfileOwnership(existing.profile_id, req.accountId)) {
    return res.status(404).json({ error: 'App not found' });
  }

  const finalDailyLimit = daily_limit_minutes !== undefined ? daily_limit_minutes : existing.daily_limit_minutes;
  const finalWeeklyLimit = weekly_limit_minutes !== undefined ? weekly_limit_minutes : existing.weekly_limit_minutes;
  const finalMaxDaily = max_daily_minutes !== undefined ? max_daily_minutes : existing.max_daily_minutes;
  const finalConfig = config !== undefined ? (typeof config === 'string' ? config : JSON.stringify(config)) : existing.config;
  const finalFolderId = Object.prototype.hasOwnProperty.call(req.body, 'folder_id') ? req.body.folder_id : existing.folder_id;

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
        config = ?,
        folder_id = ?
    WHERE id = ?
  `).run(name, url, icon, sort_order, enabled, app_type, finalDailyLimit, finalWeeklyLimit, finalMaxDaily, finalConfig, finalFolderId, req.params.id);

  const updated = db.prepare('SELECT * FROM apps WHERE id = ?').get(req.params.id);
  updated.config = JSON.parse(updated.config || '{}');
  broadcastRefresh();
  res.json(updated);
});

// DELETE /api/admin/apps/:id - Delete app
router.delete('/api/admin/apps/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT profile_id FROM apps WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'App not found' });
  }
  if (existing.profile_id && !verifyProfileOwnership(existing.profile_id, req.accountId)) {
    return res.status(404).json({ error: 'App not found' });
  }

  db.prepare('DELETE FROM apps WHERE id = ?').run(req.params.id);
  broadcastRefresh();
  res.status(204).send();
});

// --- Legacy endpoints (backwards compatibility) ---

router.post('/api/apps', (req, res) => {
  const { name, url, icon, sort_order = 0, profile_id } = req.body;
  if (!name || !url || !icon) {
    return res.status(400).json({ error: 'name, url, and icon are required' });
  }

  if (profile_id && !verifyProfileOwnership(profile_id, req.accountId)) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  const result = db.prepare('INSERT INTO apps (name, url, icon, sort_order, profile_id) VALUES (?, ?, ?, ?, ?)').run(name, url, icon, sort_order, profile_id || null);
  const newApp = db.prepare('SELECT * FROM apps WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(newApp);
});

router.put('/api/apps/:id', (req, res) => {
  const { name, url, icon, sort_order, enabled } = req.body;
  const existing = db.prepare('SELECT * FROM apps WHERE id = ?').get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'App not found' });
  }
  if (existing.profile_id && !verifyProfileOwnership(existing.profile_id, req.accountId)) {
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

router.delete('/api/apps/:id', (req, res) => {
  const existing = db.prepare('SELECT profile_id FROM apps WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'App not found' });
  }
  if (existing.profile_id && !verifyProfileOwnership(existing.profile_id, req.accountId)) {
    return res.status(404).json({ error: 'App not found' });
  }

  db.prepare('DELETE FROM apps WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

export default router;
