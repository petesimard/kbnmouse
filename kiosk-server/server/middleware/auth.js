import crypto from 'crypto';
import db from '../db.js';

// Create a new session for an account (24h expiry)
export function createSession(accountId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, account_id, expires_at) VALUES (?, ?, ?)').run(token, accountId, expiresAt);
  return token;
}

// Delete expired sessions
export function cleanupSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
}

// Check whether any account exists
export function hasAccount() {
  const row = db.prepare('SELECT COUNT(*) as count FROM accounts').get();
  return row.count > 0;
}

// Middleware: require a valid session token via X-Admin-Token header
export function requireAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const session = db.prepare('SELECT account_id FROM sessions WHERE token = ? AND expires_at > ?').get(token, new Date().toISOString());
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.accountId = session.account_id;
  next();
}

// Middleware: require a valid kiosk token via X-Kiosk-Token header
export function requireKiosk(req, res, next) {
  const token = req.headers['x-kiosk-token'];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const kiosk = db.prepare('SELECT id, account_id FROM kiosks WHERE token = ?').get(token);
  if (!kiosk) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.kioskId = kiosk.id;
  req.accountId = kiosk.account_id;
  next();
}
