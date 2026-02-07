import { Router } from 'express';
import db from '../db.js';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Migration: add kiosk columns to pairing_codes if not present
const pairingCols = db.prepare("PRAGMA table_info(pairing_codes)").all();
if (!pairingCols.find(col => col.name === 'kiosk_id')) {
  db.exec("ALTER TABLE pairing_codes ADD COLUMN kiosk_id INTEGER DEFAULT NULL");
  db.exec("ALTER TABLE pairing_codes ADD COLUMN kiosk_token TEXT DEFAULT NULL");
}

// POST /api/pairing/code — Kiosk generates a 5-digit pairing code
router.post('/api/pairing/code', (req, res) => {
  const code = String(Math.floor(10000 + Math.random() * 90000));
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Clean up expired codes
  db.prepare('DELETE FROM pairing_codes WHERE expires_at < ?').run(new Date().toISOString());

  db.prepare('INSERT INTO pairing_codes (code, expires_at, claimed) VALUES (?, ?, 0)').run(code, expires_at);

  res.json({ code, expires_at });
});

// POST /api/pairing/claim — Dashboard claims a code and registers a kiosk
router.post('/api/pairing/claim', requireAuth, (req, res) => {
  const { code, name = 'Kiosk' } = req.body;

  const row = db.prepare(
    'SELECT * FROM pairing_codes WHERE code = ? AND expires_at > ? AND claimed = 0'
  ).get(code, new Date().toISOString());

  if (!row) {
    return res.status(400).json({ error: 'Invalid or expired pairing code' });
  }

  const kioskToken = crypto.randomBytes(32).toString('hex');
  const result = db.prepare('INSERT INTO kiosks (name, token, account_id) VALUES (?, ?, ?)').run(name, kioskToken, req.accountId);
  const kioskId = result.lastInsertRowid;

  db.prepare('UPDATE pairing_codes SET claimed = 1, kiosk_id = ?, kiosk_token = ? WHERE code = ?').run(kioskId, kioskToken, code);

  res.json({ kioskId: Number(kioskId), kioskToken });
});

// GET /api/pairing/status/:code — Kiosk polls for claim result
router.get('/api/pairing/status/:code', (req, res) => {
  const row = db.prepare('SELECT * FROM pairing_codes WHERE code = ?').get(req.params.code);

  if (!row) {
    return res.status(404).json({ error: 'Pairing code not found' });
  }

  if (!row.claimed) {
    return res.json({ claimed: false });
  }

  res.json({ claimed: true, kioskId: row.kiosk_id, kioskToken: row.kiosk_token });
});

// GET /api/admin/kiosks — List registered kiosks
router.get('/api/admin/kiosks', requireAuth, (req, res) => {
  const kiosks = db.prepare('SELECT id, name, created_at FROM kiosks WHERE account_id = ? ORDER BY created_at DESC').all(req.accountId);
  res.json(kiosks);
});

// DELETE /api/admin/kiosks/:id — Remove a kiosk
router.delete('/api/admin/kiosks/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM kiosks WHERE id = ? AND account_id = ?').run(req.params.id, req.accountId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Kiosk not found' });
  }

  res.status(204).end();
});

export default router;
