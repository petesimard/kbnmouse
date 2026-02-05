import crypto from 'crypto';

// Simple token storage (in production, use proper session management)
const validTokens = new Map();

// Generate auth token
export function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Store a token
export function storeToken(token) {
  validTokens.set(token, { createdAt: Date.now() });
}

// Clean up old tokens (older than 1 hour)
export function cleanupTokens() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [t, data] of validTokens.entries()) {
    if (data.createdAt < oneHourAgo) {
      validTokens.delete(t);
    }
  }
}

// PIN verification middleware for admin routes
export function requirePin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || !validTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
