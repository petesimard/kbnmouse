import { Router } from 'express';
import db from '../db.js';
import { broadcastBulletinPin } from '../websocket.js';

const router = Router();

// GET /api/bulletin — All pins
router.get('/api/bulletin', (req, res) => {
  const pins = db.prepare(`
    SELECT bp.*, p.name AS profile_name, p.icon AS profile_icon
    FROM bulletin_pins bp
    LEFT JOIN profiles p ON bp.profile_id = p.id
    ORDER BY bp.created_at ASC
  `).all();
  res.json(pins);
});

// POST /api/bulletin — Create a pin
router.post('/api/bulletin', (req, res) => {
  const { pin_type, content, x, y, rotation, color, profile_id } = req.body;

  if (!pin_type || !content || x == null || y == null) {
    return res.status(400).json({ error: 'pin_type, content, x, y are required' });
  }

  const result = db.prepare(
    'INSERT INTO bulletin_pins (pin_type, content, x, y, rotation, color, profile_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(pin_type, content, x, y, rotation || 0, color || '#fef08a', profile_id || null);

  const pin = db.prepare(`
    SELECT bp.*, p.name AS profile_name, p.icon AS profile_icon
    FROM bulletin_pins bp
    LEFT JOIN profiles p ON bp.profile_id = p.id
    WHERE bp.id = ?
  `).get(result.lastInsertRowid);

  broadcastBulletinPin('add', pin);
  res.json(pin);
});

// DELETE /api/bulletin/:id — Remove a pin
router.delete('/api/bulletin/:id', (req, res) => {
  const pin = db.prepare('SELECT * FROM bulletin_pins WHERE id = ?').get(req.params.id);
  if (!pin) return res.status(404).json({ error: 'Pin not found' });

  db.prepare('DELETE FROM bulletin_pins WHERE id = ?').run(req.params.id);
  broadcastBulletinPin('remove', { id: Number(req.params.id) });
  res.json({ success: true });
});

export default router;
