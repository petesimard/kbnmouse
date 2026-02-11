import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { broadcastBulletinPin } from '../websocket.js';

const router = Router();

function getEnrichedPin(id) {
  return db.prepare(`
    SELECT bp.*, p.name AS profile_name, p.icon AS profile_icon
    FROM bulletin_pins bp
    LEFT JOIN profiles p ON bp.profile_id = p.id
    WHERE bp.id = ?
  `).get(id);
}

// Return profile IDs belonging to the current account
function accountProfileIds(accountId) {
  return db.prepare('SELECT id FROM profiles WHERE account_id = ?').all(accountId).map(r => r.id);
}

// GET /api/bulletin — Pins from profiles belonging to this account (+ parent pins for this account)
router.get('/api/bulletin', (req, res) => {
  const profileIds = accountProfileIds(req.accountId);
  if (profileIds.length === 0) {
    // Only return parent pins belonging to this account
    const pins = db.prepare(`
      SELECT bp.*, NULL AS profile_name, NULL AS profile_icon
      FROM bulletin_pins bp
      WHERE bp.profile_id IS NULL AND bp.account_id = ?
      ORDER BY bp.created_at ASC
    `).all(req.accountId);
    return res.json(pins);
  }
  const placeholders = profileIds.map(() => '?').join(',');
  const pins = db.prepare(`
    SELECT bp.*, p.name AS profile_name, p.icon AS profile_icon
    FROM bulletin_pins bp
    LEFT JOIN profiles p ON bp.profile_id = p.id
    WHERE bp.profile_id IN (${placeholders}) OR (bp.profile_id IS NULL AND bp.account_id = ?)
    ORDER BY bp.created_at ASC
  `).all(...profileIds, req.accountId);
  res.json(pins);
});

// POST /api/bulletin — Create a pin (kid-facing)
router.post('/api/bulletin', (req, res) => {
  const { pin_type, content, x, y, rotation, color, profile_id } = req.body;

  if (!pin_type || !content || x == null || y == null) {
    return res.status(400).json({ error: 'pin_type, content, x, y are required' });
  }
  if (!profile_id) {
    return res.status(400).json({ error: 'profile_id is required' });
  }

  // Verify profile belongs to this account
  const profile = db.prepare('SELECT id FROM profiles WHERE id = ? AND account_id = ?').get(profile_id, req.accountId);
  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  const result = db.prepare(
    'INSERT INTO bulletin_pins (pin_type, content, x, y, rotation, color, profile_id, is_parent) VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
  ).run(pin_type, content, x, y, rotation || 0, color || '#fef08a', profile_id);

  const pin = getEnrichedPin(result.lastInsertRowid);
  broadcastBulletinPin('add', pin);
  res.json(pin);
});

// Find an empty spot on the board, spiraling outward from center.
// Pin bounding box is roughly 15% wide x 12% tall in board-relative coords.
function findEmptySpot(existingPins) {
  const PIN_W = 15;
  const PIN_H = 12;
  const MARGIN = 10; // keep away from edges

  const overlaps = (cx, cy) =>
    existingPins.some(p => Math.abs(p.x - cx) < PIN_W && Math.abs(p.y - cy) < PIN_H);

  // Try center first, then spiral outward
  for (let ring = 0; ring <= 6; ring++) {
    const step = ring === 0 ? 1 : ring * 4;
    for (let i = 0; i < step; i++) {
      const angle = (i / step) * Math.PI * 2;
      const cx = 50 + Math.cos(angle) * ring * PIN_W;
      const cy = 45 + Math.sin(angle) * ring * PIN_H;
      if (cx < MARGIN || cx > 100 - MARGIN || cy < MARGIN || cy > 100 - MARGIN) continue;
      if (!overlaps(cx, cy)) return { x: cx, y: cy };
    }
  }
  // Fallback: random position with margin
  return { x: MARGIN + Math.random() * (100 - 2 * MARGIN), y: MARGIN + Math.random() * (100 - 2 * MARGIN) };
}

// --- Admin (parent-facing) endpoints ---

// POST /api/admin/bulletin — Create a parent pin
router.post('/api/admin/bulletin', requireAuth, (req, res) => {
  const { content, rotation, color } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'content is required' });
  }

  const profileIds = accountProfileIds(req.accountId);
  let existingPins;
  if (profileIds.length === 0) {
    existingPins = db.prepare('SELECT x, y FROM bulletin_pins WHERE account_id = ?').all(req.accountId);
  } else {
    const placeholders = profileIds.map(() => '?').join(',');
    existingPins = db.prepare(`SELECT x, y FROM bulletin_pins WHERE profile_id IN (${placeholders}) OR account_id = ?`).all(...profileIds, req.accountId);
  }
  const { x, y } = findEmptySpot(existingPins);

  const result = db.prepare(
    'INSERT INTO bulletin_pins (pin_type, content, x, y, rotation, color, profile_id, is_parent, account_id) VALUES (?, ?, ?, ?, ?, ?, NULL, 1, ?)'
  ).run('message', content, x, y, rotation ?? ((Math.random() - 0.5) * 12), color || '#e0f2fe', req.accountId);

  const pin = getEnrichedPin(result.lastInsertRowid);
  broadcastBulletinPin('add', pin);
  res.json(pin);
});

// DELETE /api/admin/bulletin/:id — Delete a pin (must belong to account's profiles or be a parent pin)
router.delete('/api/admin/bulletin/:id', requireAuth, (req, res) => {
  const pin = db.prepare('SELECT * FROM bulletin_pins WHERE id = ?').get(req.params.id);
  if (!pin) return res.status(404).json({ error: 'Pin not found' });

  // Verify pin belongs to this account (via profile or account_id)
  if (pin.profile_id) {
    const profile = db.prepare('SELECT id FROM profiles WHERE id = ? AND account_id = ?').get(pin.profile_id, req.accountId);
    if (!profile) return res.status(404).json({ error: 'Pin not found' });
  } else if (pin.account_id) {
    if (pin.account_id !== req.accountId) return res.status(404).json({ error: 'Pin not found' });
  } else {
    // Orphaned pin (no profile_id, no account_id) — reject
    return res.status(404).json({ error: 'Pin not found' });
  }

  db.prepare('DELETE FROM bulletin_pins WHERE id = ?').run(req.params.id);
  broadcastBulletinPin('remove', { id: Number(req.params.id) });
  res.json({ success: true });
});

export default router;
