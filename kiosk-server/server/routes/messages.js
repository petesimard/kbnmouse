import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { broadcastNewMessage, broadcastMessageRead } from '../websocket.js';

const router = Router();

// Fetch a message with JOINed profile names/icons for broadcasting
function getEnrichedMessage(id) {
  return db.prepare(`
    SELECT m.*,
      sp.name AS sender_profile_name, sp.icon AS sender_profile_icon,
      rp.name AS recipient_profile_name, rp.icon AS recipient_profile_icon
    FROM messages m
    LEFT JOIN profiles sp ON m.sender_type = 'profile' AND m.sender_profile_id = sp.id
    LEFT JOIN profiles rp ON m.recipient_type = 'profile' AND m.recipient_profile_id = rp.id
    WHERE m.id = ?
  `).get(id);
}

// --- Public (kid-facing) endpoints ---

// GET /api/messages?profile=<id> — All messages where profile is sender or recipient
router.get('/api/messages', (req, res) => {
  const profileId = req.query.profile;
  if (!profileId) {
    return res.status(400).json({ error: 'profile query param is required' });
  }

  const messages = db.prepare(`
    SELECT m.*,
      sp.name AS sender_profile_name, sp.icon AS sender_profile_icon,
      rp.name AS recipient_profile_name, rp.icon AS recipient_profile_icon
    FROM messages m
    LEFT JOIN profiles sp ON m.sender_type = 'profile' AND m.sender_profile_id = sp.id
    LEFT JOIN profiles rp ON m.recipient_type = 'profile' AND m.recipient_profile_id = rp.id
    WHERE (m.sender_type = 'profile' AND m.sender_profile_id = ?)
       OR (m.recipient_type = 'profile' AND m.recipient_profile_id = ?)
    ORDER BY m.created_at ASC
  `).all(profileId, profileId);

  res.json(messages);
});

// POST /api/messages — Send from a profile
router.post('/api/messages', (req, res) => {
  const { sender_profile_id, recipient_type, recipient_profile_id, content } = req.body;

  if (!sender_profile_id || !recipient_type || !content) {
    return res.status(400).json({ error: 'sender_profile_id, recipient_type, and content are required' });
  }
  if (!['profile', 'parent'].includes(recipient_type)) {
    return res.status(400).json({ error: 'recipient_type must be profile or parent' });
  }
  if (recipient_type === 'profile' && !recipient_profile_id) {
    return res.status(400).json({ error: 'recipient_profile_id is required when recipient_type is profile' });
  }
  if (content.length > 500) {
    return res.status(400).json({ error: 'Message must be 500 characters or less' });
  }

  const result = db.prepare(`
    INSERT INTO messages (sender_type, sender_profile_id, recipient_type, recipient_profile_id, content)
    VALUES ('profile', ?, ?, ?, ?)
  `).run(sender_profile_id, recipient_type, recipient_profile_id || null, content.trim());

  const message = getEnrichedMessage(result.lastInsertRowid);
  broadcastNewMessage(message);
  res.status(201).json(message);
});

// GET /api/messages/unread-count?profile=<id> — Count of unread messages for a profile
router.get('/api/messages/unread-count', (req, res) => {
  const profileId = req.query.profile;
  if (!profileId) {
    return res.status(400).json({ error: 'profile query param is required' });
  }

  const row = db.prepare(`
    SELECT COUNT(*) as count FROM messages
    WHERE recipient_type = 'profile' AND recipient_profile_id = ? AND read = 0
  `).get(profileId);
  res.json({ count: row.count });
});

// PUT /api/messages/:id/read — Mark message read
router.put('/api/messages/:id/read', (req, res) => {
  const msg = db.prepare('SELECT recipient_profile_id FROM messages WHERE id = ?').get(req.params.id);
  db.prepare('UPDATE messages SET read = 1 WHERE id = ?').run(req.params.id);
  if (msg) broadcastMessageRead(req.params.id, msg.recipient_profile_id);
  res.json({ success: true });
});

// --- Admin (parent-facing) endpoints ---

// GET /api/admin/messages/unread-count — Count of unread messages addressed to parent
router.get('/api/admin/messages/unread-count', requireAuth, (req, res) => {
  const row = db.prepare(`
    SELECT COUNT(*) as count FROM messages
    WHERE recipient_type = 'parent' AND read = 0
  `).get();
  res.json({ count: row.count });
});

// GET /api/admin/messages/profile-all?profile=<id> — All messages for a profile (parent + sibling convos)
router.get('/api/admin/messages/profile-all', requireAuth, (req, res) => {
  const profileId = req.query.profile;
  if (!profileId) {
    return res.status(400).json({ error: 'profile query param is required' });
  }

  const messages = db.prepare(`
    SELECT m.*,
      sp.name AS sender_profile_name, sp.icon AS sender_profile_icon,
      rp.name AS recipient_profile_name, rp.icon AS recipient_profile_icon
    FROM messages m
    LEFT JOIN profiles sp ON m.sender_type = 'profile' AND m.sender_profile_id = sp.id
    LEFT JOIN profiles rp ON m.recipient_type = 'profile' AND m.recipient_profile_id = rp.id
    WHERE (m.sender_type = 'profile' AND m.sender_profile_id = ?)
       OR (m.recipient_type = 'profile' AND m.recipient_profile_id = ?)
    ORDER BY m.created_at ASC
  `).all(profileId, profileId);

  res.json(messages);
});

// GET /api/admin/messages?profile=<id> — Messages between parent and specific child
router.get('/api/admin/messages', requireAuth, (req, res) => {
  const profileId = req.query.profile;

  let messages;
  if (profileId) {
    messages = db.prepare(`
      SELECT m.*,
        sp.name AS sender_profile_name, sp.icon AS sender_profile_icon,
        rp.name AS recipient_profile_name, rp.icon AS recipient_profile_icon
      FROM messages m
      LEFT JOIN profiles sp ON m.sender_type = 'profile' AND m.sender_profile_id = sp.id
      LEFT JOIN profiles rp ON m.recipient_type = 'profile' AND m.recipient_profile_id = rp.id
      WHERE (m.sender_type = 'parent' AND m.recipient_type = 'profile' AND m.recipient_profile_id = ?)
         OR (m.sender_type = 'profile' AND m.sender_profile_id = ? AND m.recipient_type = 'parent')
      ORDER BY m.created_at ASC
    `).all(profileId, profileId);
  } else {
    messages = db.prepare(`
      SELECT m.*,
        sp.name AS sender_profile_name, sp.icon AS sender_profile_icon,
        rp.name AS recipient_profile_name, rp.icon AS recipient_profile_icon
      FROM messages m
      LEFT JOIN profiles sp ON m.sender_type = 'profile' AND m.sender_profile_id = sp.id
      LEFT JOIN profiles rp ON m.recipient_type = 'profile' AND m.recipient_profile_id = rp.id
      WHERE m.sender_type = 'parent' OR m.recipient_type = 'parent'
      ORDER BY m.created_at ASC
    `).all();
  }

  res.json(messages);
});

// POST /api/admin/messages — Send from parent
router.post('/api/admin/messages', requireAuth, (req, res) => {
  const { recipient_type, recipient_profile_id, content } = req.body;

  if (!recipient_type || !content) {
    return res.status(400).json({ error: 'recipient_type and content are required' });
  }
  if (!['profile', 'parent'].includes(recipient_type)) {
    return res.status(400).json({ error: 'recipient_type must be profile or parent' });
  }
  if (recipient_type === 'profile' && !recipient_profile_id) {
    return res.status(400).json({ error: 'recipient_profile_id is required when recipient_type is profile' });
  }
  if (content.length > 500) {
    return res.status(400).json({ error: 'Message must be 500 characters or less' });
  }

  const result = db.prepare(`
    INSERT INTO messages (sender_type, sender_profile_id, recipient_type, recipient_profile_id, content)
    VALUES ('parent', NULL, ?, ?, ?)
  `).run(recipient_type, recipient_profile_id || null, content.trim());

  const message = getEnrichedMessage(result.lastInsertRowid);
  broadcastNewMessage(message);
  res.status(201).json(message);
});

// PUT /api/admin/messages/:id/read — Mark read (admin)
router.put('/api/admin/messages/:id/read', requireAuth, (req, res) => {
  db.prepare('UPDATE messages SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
