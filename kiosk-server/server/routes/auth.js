import { Router } from 'express';
import db from '../db.js';
import { createSession, cleanupSessions, requireAuth } from '../middleware/auth.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { sendEmail } from '../services/email.js';
import crypto from 'crypto';

const router = Router();

// POST /api/auth/register — create a new account
router.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const existing = db.prepare('SELECT id FROM accounts WHERE email = ?').get(email);
  if (existing) {
    return res.status(400).json({ error: 'An account with that email already exists' });
  }

  const passwordHash = await hashPassword(password);
  const result = db.prepare('INSERT INTO accounts (email, password_hash) VALUES (?, ?)').run(email, passwordHash);
  const accountId = result.lastInsertRowid;

  const token = createSession(accountId);
  cleanupSessions();

  res.json({ token });
});

// POST /api/auth/login
router.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  const account = db.prepare('SELECT * FROM accounts WHERE email = ?').get(email);
  if (!account) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await verifyPassword(password, account.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = createSession(account.id);
  cleanupSessions();

  res.json({ token });
});

// POST /api/auth/magic-link — send a magic login link via email
router.post('/api/auth/magic-link', async (req, res) => {
  const { email } = req.body;

  const account = db.prepare('SELECT * FROM accounts WHERE email = ?').get(email);
  if (!account) {
    return res.json({ success: true });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  db.prepare('INSERT INTO email_tokens (token, account_id, token_type, expires_at) VALUES (?, ?, ?, ?)')
    .run(token, account.id, 'magic_link', expiresAt);

  const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
  const link = `${origin}/dashboard?magic=${token}`;

  try {
    await sendEmail({
      to: account.email,
      subject: 'Your login link',
      html: `<p>Click <a href="${link}">here</a> to log in to your Kiosk dashboard.</p><p>This link expires in 15 minutes.</p>`,
      accountId: account.id,
    });
  } catch (err) {
    console.error('Failed to send magic link email:', err);
  }

  res.json({ success: true });
});

// POST /api/auth/verify-magic-link
router.post('/api/auth/verify-magic-link', (req, res) => {
  const { token } = req.body;

  const row = db.prepare(
    'SELECT * FROM email_tokens WHERE token = ? AND token_type = ? AND expires_at > ? AND used = 0'
  ).get(token, 'magic_link', new Date().toISOString());

  if (!row) {
    return res.status(400).json({ error: 'Invalid or expired link' });
  }

  db.prepare('UPDATE email_tokens SET used = 1 WHERE token = ?').run(row.token);

  const sessionToken = createSession(row.account_id);
  cleanupSessions();

  res.json({ token: sessionToken });
});

// POST /api/auth/forgot-password — send a password reset link
router.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;

  const account = db.prepare('SELECT * FROM accounts WHERE email = ?').get(email);
  if (!account) {
    return res.json({ success: true });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  db.prepare('INSERT INTO email_tokens (token, account_id, token_type, expires_at) VALUES (?, ?, ?, ?)')
    .run(token, account.id, 'password_reset', expiresAt);

  const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
  const link = `${origin}/dashboard?reset=${token}`;

  try {
    await sendEmail({
      to: account.email,
      subject: 'Reset your password',
      html: `<p>Click <a href="${link}">here</a> to reset your Kiosk dashboard password.</p><p>This link expires in 15 minutes.</p>`,
      accountId: account.id,
    });
  } catch (err) {
    console.error('Failed to send password reset email:', err);
  }

  res.json({ success: true });
});

// POST /api/auth/reset-password
router.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body;

  const row = db.prepare(
    'SELECT * FROM email_tokens WHERE token = ? AND token_type = ? AND expires_at > ? AND used = 0'
  ).get(token, 'password_reset', new Date().toISOString());

  if (!row) {
    return res.status(400).json({ error: 'Invalid or expired link' });
  }

  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const passwordHash = await hashPassword(password);
  db.prepare('UPDATE accounts SET password_hash = ? WHERE id = ?').run(passwordHash, row.account_id);
  db.prepare('UPDATE email_tokens SET used = 1 WHERE token = ?').run(row.token);

  const sessionToken = createSession(row.account_id);
  cleanupSessions();

  res.json({ token: sessionToken });
});

// POST /api/auth/change-password (authenticated)
router.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.accountId);
  if (!account) {
    return res.status(401).json({ error: 'Account not found' });
  }

  const valid = await verifyPassword(currentPassword, account.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid current password' });
  }

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const passwordHash = await hashPassword(newPassword);
  db.prepare('UPDATE accounts SET password_hash = ? WHERE id = ?').run(passwordHash, account.id);

  res.json({ success: true });
});

// DELETE /api/auth/session (authenticated) — logout
router.delete('/api/auth/session', requireAuth, (req, res) => {
  const token = req.headers['x-admin-token'];
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);

  res.json({ success: true });
});

export default router;
