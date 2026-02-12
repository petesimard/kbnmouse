import { Router } from 'express';
import db from '../db.js';

const router = Router();

function verifyProfileOwnership(profileId, accountId) {
  return db.prepare('SELECT id FROM profiles WHERE id = ? AND account_id = ?').get(profileId, accountId);
}

// GET /api/drawings?profile=<id> — list drawings (thumbnails only, no full image_data)
router.get('/', (req, res) => {
  const profileId = req.query.profile;
  if (!profileId) {
    return res.status(400).json({ error: 'profile query param is required' });
  }
  if (!verifyProfileOwnership(profileId, req.accountId)) {
    return res.status(404).json({ error: 'Profile not found' });
  }
  const drawings = db.prepare(
    'SELECT id, name, thumbnail, created_at, updated_at FROM drawings WHERE profile_id = ? ORDER BY updated_at DESC'
  ).all(profileId);
  res.json(drawings);
});

// GET /api/drawings/:id — get full drawing (includes image_data)
router.get('/:id', (req, res) => {
  const drawing = db.prepare('SELECT * FROM drawings WHERE id = ?').get(req.params.id);
  if (!drawing) {
    return res.status(404).json({ error: 'Drawing not found' });
  }
  if (!verifyProfileOwnership(drawing.profile_id, req.accountId)) {
    return res.status(404).json({ error: 'Drawing not found' });
  }
  res.json(drawing);
});

// POST /api/drawings — save new drawing
router.post('/', (req, res) => {
  const { name, image_data, thumbnail, profile_id } = req.body;
  if (!name || !image_data || !profile_id) {
    return res.status(400).json({ error: 'name, image_data, and profile_id are required' });
  }
  if (!verifyProfileOwnership(profile_id, req.accountId)) {
    return res.status(404).json({ error: 'Profile not found' });
  }
  const result = db.prepare(
    'INSERT INTO drawings (name, profile_id, image_data, thumbnail) VALUES (?, ?, ?, ?)'
  ).run(name, profile_id, image_data, thumbnail || null);
  const drawing = db.prepare('SELECT id, name, thumbnail, created_at, updated_at FROM drawings WHERE id = ?').get(result.lastInsertRowid);
  res.json(drawing);
});

// PUT /api/drawings/:id — update existing drawing
router.put('/:id', (req, res) => {
  const drawing = db.prepare('SELECT * FROM drawings WHERE id = ?').get(req.params.id);
  if (!drawing) {
    return res.status(404).json({ error: 'Drawing not found' });
  }
  if (!verifyProfileOwnership(drawing.profile_id, req.accountId)) {
    return res.status(404).json({ error: 'Drawing not found' });
  }
  const { name, image_data, thumbnail } = req.body;
  db.prepare(
    'UPDATE drawings SET name = COALESCE(?, name), image_data = COALESCE(?, image_data), thumbnail = COALESCE(?, thumbnail), updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(name || null, image_data || null, thumbnail || null, req.params.id);
  const updated = db.prepare('SELECT id, name, thumbnail, created_at, updated_at FROM drawings WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/drawings/:id — delete drawing
router.delete('/:id', (req, res) => {
  const drawing = db.prepare('SELECT * FROM drawings WHERE id = ?').get(req.params.id);
  if (!drawing) {
    return res.status(404).json({ error: 'Drawing not found' });
  }
  if (!verifyProfileOwnership(drawing.profile_id, req.accountId)) {
    return res.status(404).json({ error: 'Drawing not found' });
  }
  db.prepare('DELETE FROM drawings WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
