import { Router } from 'express';
import db from '../db.js';
import { requirePin } from '../middleware/auth.js';
import { broadcastRefresh } from '../websocket.js';

const router = Router();

// --- Public endpoints ---

// GET /api/challenges - Get all enabled challenges
router.get('/api/challenges', (req, res) => {
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

// POST /api/challenges/complete - Record challenge completion
router.post('/api/challenges/complete', (req, res) => {
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

// --- Admin endpoints ---

// GET /api/admin/challenges - Get all challenges including disabled
router.get('/api/admin/challenges', requirePin, (req, res) => {
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

// POST /api/admin/challenges - Create new challenge
router.post('/api/admin/challenges', requirePin, (req, res) => {
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

// PUT /api/admin/challenges/reorder - Bulk reorder challenges
router.put('/api/admin/challenges/reorder', requirePin, (req, res) => {
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

// PUT /api/admin/challenges/:id - Update challenge
router.put('/api/admin/challenges/:id', requirePin, (req, res) => {
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

// DELETE /api/admin/challenges/:id - Delete challenge
router.delete('/api/admin/challenges/:id', requirePin, (req, res) => {
  const result = db.prepare('DELETE FROM challenges WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Challenge not found' });
  }
  broadcastRefresh();
  res.status(204).send();
});

export default router;
