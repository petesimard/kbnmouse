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

// GET /api/challenges - Get all enabled challenges
router.get('/api/challenges', (req, res) => {
  const profileId = req.query.profile;
  const todayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).toISOString();

  if (profileId) {
    if (!verifyProfileOwnership(profileId, req.accountId)) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    const challenges = db.prepare(`
      SELECT c.id, c.name, c.icon, c.description, c.challenge_type, c.reward_minutes, c.config, c.sort_order, c.max_completions_per_day,
        (SELECT COUNT(*) FROM challenge_completions cc WHERE cc.challenge_type = c.challenge_type AND cc.profile_id = c.profile_id AND cc.completed_at >= ?) as today_completions
      FROM challenges c WHERE c.enabled = 1 AND c.profile_id = ? ORDER BY c.sort_order
    `).all(todayStart, profileId);
    const parsed = challenges.map(c => ({ ...c, config: JSON.parse(c.config || '{}') }));
    return res.json(parsed);
  }

  // No profile param — scope to account's profiles
  const profileIds = accountProfileIds(req.accountId);
  if (profileIds.length === 0) return res.json([]);
  const placeholders = profileIds.map(() => '?').join(',');
  const challenges = db.prepare(`
    SELECT c.id, c.name, c.icon, c.description, c.challenge_type, c.reward_minutes, c.config, c.sort_order, c.max_completions_per_day,
      (SELECT COUNT(*) FROM challenge_completions cc WHERE cc.challenge_type = c.challenge_type AND cc.profile_id = c.profile_id AND cc.completed_at >= ?) as today_completions
    FROM challenges c WHERE c.enabled = 1 AND c.profile_id IN (${placeholders}) ORDER BY c.sort_order
  `).all(todayStart, ...profileIds);
  const parsed = challenges.map(c => ({ ...c, config: JSON.parse(c.config || '{}') }));
  res.json(parsed);
});

// POST /api/challenges/complete - Record challenge completion
router.post('/api/challenges/complete', (req, res) => {
  const { challenge_id, profile_id } = req.body;
  if (!challenge_id || !profile_id) {
    return res.status(400).json({ error: 'challenge_id and profile_id are required' });
  }

  // Verify profile belongs to this account
  if (!verifyProfileOwnership(profile_id, req.accountId)) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  // Look up challenge — must exist and belong to this profile
  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ? AND profile_id = ?').get(challenge_id, profile_id);
  if (!challenge) {
    return res.status(404).json({ error: 'Challenge not found' });
  }

  // Check max_completions_per_day limit
  if (challenge.max_completions_per_day > 0) {
    const todayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).toISOString();
    const todayCount = db.prepare(
      'SELECT COUNT(*) as count FROM challenge_completions WHERE challenge_type = ? AND profile_id = ? AND completed_at >= ?'
    ).get(challenge.challenge_type, profile_id, todayStart);
    if (todayCount.count >= challenge.max_completions_per_day) {
      return res.status(400).json({ error: 'Daily completion limit reached for this challenge' });
    }
  }

  // Use server-side reward_minutes — never trust client-provided value
  db.prepare(
    'INSERT INTO challenge_completions (challenge_type, minutes_awarded, completed_at, profile_id) VALUES (?, ?, ?, ?)'
  ).run(challenge.challenge_type, challenge.reward_minutes, new Date().toISOString(), profile_id);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const result = db.prepare(
    'SELECT COALESCE(SUM(minutes_awarded), 0) as total FROM challenge_completions WHERE completed_at >= ? AND profile_id = ?'
  ).get(todayStart, profile_id);

  broadcastRefresh();
  res.json({ success: true, today_bonus_minutes: result.total });
});

// --- Admin endpoints ---

// GET /api/admin/challenge-completions - Get completion history
router.get('/api/admin/challenge-completions', requireAuth, (req, res) => {
  const profileId = req.query.profile;
  if (profileId) {
    if (!verifyProfileOwnership(profileId, req.accountId)) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    const completions = db.prepare(`
      SELECT cc.id, cc.challenge_type, cc.minutes_awarded, cc.completed_at, cc.profile_id,
             (SELECT c.name FROM challenges c WHERE c.challenge_type = cc.challenge_type AND c.profile_id = cc.profile_id LIMIT 1) as challenge_name
      FROM challenge_completions cc
      WHERE cc.profile_id = ?
      ORDER BY cc.completed_at DESC
    `).all(profileId);
    return res.json(completions);
  }

  // No profile param — scope to account's profiles
  const profileIds = accountProfileIds(req.accountId);
  if (profileIds.length === 0) return res.json([]);
  const placeholders = profileIds.map(() => '?').join(',');
  const completions = db.prepare(`
    SELECT cc.id, cc.challenge_type, cc.minutes_awarded, cc.completed_at, cc.profile_id,
           (SELECT c.name FROM challenges c WHERE c.challenge_type = cc.challenge_type AND c.profile_id = cc.profile_id LIMIT 1) as challenge_name
    FROM challenge_completions cc
    WHERE cc.profile_id IN (${placeholders})
    ORDER BY cc.completed_at DESC
  `).all(...profileIds);
  res.json(completions);
});

// GET /api/admin/challenges - Get all challenges including disabled
router.get('/api/admin/challenges', requireAuth, (req, res) => {
  const profileId = req.query.profile;
  let challenges;
  if (profileId) {
    if (!verifyProfileOwnership(profileId, req.accountId)) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    challenges = db.prepare('SELECT * FROM challenges WHERE profile_id = ? ORDER BY sort_order').all(profileId);
  } else {
    const profileIds = accountProfileIds(req.accountId);
    if (profileIds.length === 0) return res.json([]);
    const placeholders = profileIds.map(() => '?').join(',');
    challenges = db.prepare(`SELECT * FROM challenges WHERE profile_id IN (${placeholders}) ORDER BY sort_order`).all(...profileIds);
  }
  const parsed = challenges.map(c => ({ ...c, config: JSON.parse(c.config || '{}') }));
  res.json(parsed);
});

// POST /api/admin/challenges - Create new challenge
router.post('/api/admin/challenges', requireAuth, (req, res) => {
  const { name, icon, description = '', challenge_type, reward_minutes = 10, config = {}, sort_order, enabled = 1, profile_id, max_completions_per_day = 0 } = req.body;
  if (!name || !icon || !challenge_type) {
    return res.status(400).json({ error: 'name, icon, and challenge_type are required' });
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
      maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM challenges WHERE profile_id = ?').get(profile_id);
    } else {
      maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM challenges').get();
    }
    finalSortOrder = (maxOrder.max || 0) + 1;
  }

  const configStr = typeof config === 'string' ? config : JSON.stringify(config);
  const result = db.prepare(
    'INSERT INTO challenges (name, icon, description, challenge_type, reward_minutes, config, sort_order, enabled, profile_id, max_completions_per_day) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(name, icon, description, challenge_type, reward_minutes, configStr, finalSortOrder, enabled, profile_id, max_completions_per_day);

  const newChallenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(result.lastInsertRowid);
  newChallenge.config = JSON.parse(newChallenge.config || '{}');
  broadcastRefresh();
  res.status(201).json(newChallenge);
});

// PUT /api/admin/challenges/reorder - Bulk reorder challenges
router.put('/api/admin/challenges/reorder', requireAuth, (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'order must be an array' });
  }

  const profileIds = accountProfileIds(req.accountId);
  const placeholders = profileIds.map(() => '?').join(',');
  const updateStmt = profileIds.length > 0
    ? db.prepare(`UPDATE challenges SET sort_order = ? WHERE id = ? AND profile_id IN (${placeholders})`)
    : null;

  if (updateStmt) {
    const transaction = db.transaction((items) => {
      for (const item of items) {
        updateStmt.run(item.sort_order, item.id, ...profileIds);
      }
    });
    transaction(order);
  }

  const challenges = profileIds.length > 0
    ? db.prepare(`SELECT * FROM challenges WHERE profile_id IN (${placeholders}) ORDER BY sort_order`).all(...profileIds)
    : [];
  const parsed = challenges.map(c => ({ ...c, config: JSON.parse(c.config || '{}') }));
  broadcastRefresh();
  res.json(parsed);
});

// PUT /api/admin/challenges/:id - Update challenge
router.put('/api/admin/challenges/:id', requireAuth, (req, res) => {
  const { name, icon, description, challenge_type, reward_minutes, config, sort_order, enabled, max_completions_per_day } = req.body;
  const existing = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Challenge not found' });
  }
  if (!existing.profile_id || !verifyProfileOwnership(existing.profile_id, req.accountId)) {
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
        enabled = COALESCE(?, enabled),
        max_completions_per_day = COALESCE(?, max_completions_per_day)
    WHERE id = ?
  `).run(name, icon, description, challenge_type, reward_minutes, configStr, sort_order, enabled, max_completions_per_day, req.params.id);

  const updated = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);
  updated.config = JSON.parse(updated.config || '{}');
  broadcastRefresh();
  res.json(updated);
});

// DELETE /api/admin/challenges/:id - Delete challenge
router.delete('/api/admin/challenges/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT profile_id FROM challenges WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Challenge not found' });
  }
  if (!existing.profile_id || !verifyProfileOwnership(existing.profile_id, req.accountId)) {
    return res.status(404).json({ error: 'Challenge not found' });
  }

  db.prepare('DELETE FROM challenges WHERE id = ?').run(req.params.id);
  broadcastRefresh();
  res.status(204).send();
});

export default router;
