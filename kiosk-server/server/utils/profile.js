import db from '../db.js';

export function verifyProfileOwnership(profileId, accountId) {
  return db.prepare('SELECT id FROM profiles WHERE id = ? AND account_id = ?').get(profileId, accountId);
}

export function accountProfileIds(accountId) {
  return db.prepare('SELECT id FROM profiles WHERE account_id = ?').all(accountId).map(r => r.id);
}
