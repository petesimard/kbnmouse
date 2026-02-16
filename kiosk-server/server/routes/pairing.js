import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import express from 'express';
import db from '../db.js';
import crypto from 'crypto';
import { requireAuth, requireKiosk } from '../middleware/auth.js';

const router = Router();

// Rate limiting for pairing endpoints
const rateLimitMaps = { status: new Map(), codeGen: new Map() };
const RATE_WINDOW_MS = 60_000;
const MAX_STATUS_CHECKS = 30;
const MAX_CODE_GENS = 6;

setInterval(() => {
  const now = Date.now();
  for (const map of Object.values(rateLimitMaps)) {
    for (const [ip, attempts] of map) {
      const recent = attempts.filter(t => now - t < RATE_WINDOW_MS);
      if (recent.length === 0) map.delete(ip);
      else map.set(ip, recent);
    }
  }
}, 5 * 60_000);

function checkRateLimit(map, ip, max) {
  const now = Date.now();
  const attempts = (map.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (attempts.length >= max) return false;
  attempts.push(now);
  map.set(ip, attempts);
  return true;
}

// Migration: add kiosk columns to pairing_codes if not present
const pairingCols = db.prepare("PRAGMA table_info(pairing_codes)").all();
if (!pairingCols.find(col => col.name === 'kiosk_id')) {
  db.exec("ALTER TABLE pairing_codes ADD COLUMN kiosk_id INTEGER DEFAULT NULL");
  db.exec("ALTER TABLE pairing_codes ADD COLUMN kiosk_token TEXT DEFAULT NULL");
}
// Migration: add claim_secret column for secure polling
if (!pairingCols.find(col => col.name === 'claim_secret')) {
  db.exec("ALTER TABLE pairing_codes ADD COLUMN claim_secret TEXT DEFAULT NULL");
}

// Migration: add installed_apps column to kiosks if not present
const kioskCols = db.prepare("PRAGMA table_info(kiosks)").all();
if (!kioskCols.find(col => col.name === 'installed_apps')) {
  db.exec("ALTER TABLE kiosks ADD COLUMN installed_apps TEXT DEFAULT NULL");
}
// Migration: add heartbeat/update columns to kiosks
if (!kioskCols.find(col => col.name === 'app_version')) {
  db.exec("ALTER TABLE kiosks ADD COLUMN app_version TEXT DEFAULT NULL");
}
if (!kioskCols.find(col => col.name === 'update_status')) {
  db.exec("ALTER TABLE kiosks ADD COLUMN update_status TEXT DEFAULT NULL");
}
if (!kioskCols.find(col => col.name === 'last_seen_at')) {
  db.exec("ALTER TABLE kiosks ADD COLUMN last_seen_at TEXT DEFAULT NULL");
}
if (!kioskCols.find(col => col.name === 'pending_action')) {
  db.exec("ALTER TABLE kiosks ADD COLUMN pending_action TEXT DEFAULT NULL");
}

// POST /api/pairing/code — Kiosk generates a 5-digit pairing code
router.post('/api/pairing/code', (req, res) => {
  if (!checkRateLimit(rateLimitMaps.codeGen, req.ip, MAX_CODE_GENS)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const code = String(Math.floor(10000 + Math.random() * 90000));
  const claimSecret = crypto.randomBytes(32).toString('hex');
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Clean up expired codes
  db.prepare('DELETE FROM pairing_codes WHERE expires_at < ?').run(new Date().toISOString());

  db.prepare('INSERT INTO pairing_codes (code, expires_at, claimed, claim_secret) VALUES (?, ?, 0, ?)').run(code, expires_at, claimSecret);

  res.json({ code, claimSecret, expires_at });
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

// GET /api/pairing/status/:code — Kiosk polls for claim result (requires claim_secret)
router.get('/api/pairing/status/:code', (req, res) => {
  if (!checkRateLimit(rateLimitMaps.status, req.ip, MAX_STATUS_CHECKS)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const secret = req.query.secret;
  if (!secret) {
    return res.status(400).json({ error: 'secret query param is required' });
  }

  const row = db.prepare('SELECT * FROM pairing_codes WHERE code = ? AND claim_secret = ?').get(req.params.code, secret);

  if (!row) {
    return res.status(404).json({ error: 'Pairing code not found' });
  }

  if (!row.claimed) {
    return res.json({ claimed: false });
  }

  res.json({ claimed: true, kioskId: row.kiosk_id, kioskToken: row.kiosk_token });
});

// POST /api/kiosk/heartbeat — Kiosk reports version and update status
router.post('/api/kiosk/heartbeat', requireKiosk, (req, res) => {
  const { app_version, update_status } = req.body;
  db.prepare(
    'UPDATE kiosks SET app_version = ?, update_status = ?, last_seen_at = ? WHERE id = ?'
  ).run(app_version || null, update_status || null, new Date().toISOString(), req.kioskId);

  const kiosk = db.prepare('SELECT pending_action FROM kiosks WHERE id = ?').get(req.kioskId);
  const action = kiosk?.pending_action || null;
  if (action) {
    db.prepare('UPDATE kiosks SET pending_action = NULL WHERE id = ?').run(req.kioskId);
  }
  res.json({ ok: true, action });
});

// GET /api/admin/kiosks — List registered kiosks
router.get('/api/admin/kiosks', requireAuth, (req, res) => {
  const kiosks = db.prepare('SELECT id, name, created_at, app_version, update_status, last_seen_at, pending_action FROM kiosks WHERE account_id = ? ORDER BY created_at DESC').all(req.accountId);
  res.json(kiosks);
});

// POST /api/admin/kiosks/:id/update — Queue an update command for the kiosk
router.post('/api/admin/kiosks/:id/update', requireAuth, (req, res) => {
  const result = db.prepare('UPDATE kiosks SET pending_action = ? WHERE id = ? AND account_id = ?').run('update', req.params.id, req.accountId);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Kiosk not found' });
  }
  res.json({ ok: true });
});

// DELETE /api/admin/kiosks/:id — Remove a kiosk
router.delete('/api/admin/kiosks/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM kiosks WHERE id = ? AND account_id = ?').run(req.params.id, req.accountId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Kiosk not found' });
  }

  res.status(204).end();
});

// GET /api/kiosk/verify — Kiosk verifies its token is still valid
router.get('/api/kiosk/verify', requireKiosk, (req, res) => {
  res.json({ ok: true, kioskId: req.kioskId });
});

// POST /api/kiosk/installed-apps — Kiosk pushes its list of installed desktop apps
router.post('/api/kiosk/installed-apps', requireKiosk, (req, res) => {
  const { apps } = req.body;
  if (!Array.isArray(apps)) {
    return res.status(400).json({ error: 'apps must be an array' });
  }

  db.prepare('UPDATE kiosks SET installed_apps = ? WHERE id = ?').run(JSON.stringify(apps), req.kioskId);
  res.json({ ok: true });
});

// POST /api/kiosk/app-icons — Kiosk pushes icon files (lazy, in batches)
router.post('/api/kiosk/app-icons', requireKiosk, express.json({ limit: '5mb' }), (req, res) => {
  const { icons } = req.body;
  if (!Array.isArray(icons)) {
    return res.status(400).json({ error: 'icons must be an array' });
  }

  const iconsDir = path.join(process.cwd(), 'data', 'app-icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  for (const icon of icons) {
    if (!icon.name || !icon.data) continue;
    const safeName = icon.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(iconsDir, `${safeName}.png`);
    try {
      fs.writeFileSync(filePath, Buffer.from(icon.data, 'base64'));
    } catch {}
  }

  res.json({ ok: true });
});

// GET /api/admin/app-icon/:name — Serve an app icon file (PNG)
router.get('/api/admin/app-icon/:name', requireAuth, (req, res) => {
  const safeName = req.params.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const iconsDir = path.join(process.cwd(), 'data', 'app-icons');
  const contentTypes = { '.png': 'image/png', '.svg': 'image/svg+xml', '.xpm': 'image/x-xpixmap' };

  // Check pushed icons first (always PNG after kiosk conversion)
  const pngPath = path.join(iconsDir, `${safeName}.png`);
  if (fs.existsSync(pngPath)) {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(path.resolve(pngPath));
  }

  // Fallback: resolve from local icon themes (works when server runs on same machine)
  const resolved = resolveLocalIcon(req.params.name);
  if (resolved) {
    const ext = path.extname(resolved);
    res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(path.resolve(resolved));
  }

  res.status(404).end();
});

function resolveLocalIcon(iconName) {
  if (!iconName) return null;
  const extensions = ['.png', '.svg', '.xpm'];

  for (const ext of extensions) {
    const p = `/usr/share/pixmaps/${iconName}${ext}`;
    if (fs.existsSync(p)) return p;
  }

  const iconBases = ['/usr/share/icons'];
  const homedir = process.env.HOME;
  if (homedir) iconBases.push(path.join(homedir, '.local/share/icons'));

  const prefSizes = ['64', '48', '256', '128', '96', '32', '64x64', '48x48', '128x128', '256x256', 'scalable'];

  for (const iconsBase of iconBases) {
    let themeDirs = [];
    try {
      themeDirs = fs.readdirSync(iconsBase).filter(d => {
        try { return fs.statSync(path.join(iconsBase, d)).isDirectory(); } catch { return false; }
      });
    } catch { continue; }

    for (const theme of themeDirs) {
      const themeBase = path.join(iconsBase, theme);

      for (const size of prefSizes) {
        // Standard layout: theme/size/*/icon (hicolor, Adwaita)
        const stdSizeDir = path.join(themeBase, size);
        try {
          for (const sub of fs.readdirSync(stdSizeDir)) {
            for (const ext of extensions) {
              const p = path.join(stdSizeDir, sub, `${iconName}${ext}`);
              if (fs.existsSync(p)) return p;
            }
          }
        } catch {}
      }

      // Flat layout: theme/*/size/icon (Mint-Y, Papirus)
      let topDirs = [];
      try {
        topDirs = fs.readdirSync(themeBase).filter(d => {
          try { return fs.statSync(path.join(themeBase, d)).isDirectory(); } catch { return false; }
        });
      } catch {}

      for (const sub of topDirs) {
        for (const size of prefSizes) {
          for (const ext of extensions) {
            const flat = path.join(themeBase, sub, size, `${iconName}${ext}`);
            if (fs.existsSync(flat)) return flat;
            const hidpi = path.join(themeBase, sub, `${size}@2x`, `${iconName}${ext}`);
            if (fs.existsSync(hidpi)) return hidpi;
          }
        }
      }
    }
  }

  return null;
}

// GET /api/admin/installed-apps — Dashboard fetches installed apps from kiosks
router.get('/api/admin/installed-apps', requireAuth, (req, res) => {
  const kiosks = db.prepare(
    'SELECT installed_apps FROM kiosks WHERE account_id = ? AND installed_apps IS NOT NULL ORDER BY created_at DESC'
  ).all(req.accountId);

  if (kiosks.length === 0) {
    return res.json([]);
  }

  // Merge apps from all kiosks, deduplicating by exec command
  const seen = new Set();
  const merged = [];
  for (const kiosk of kiosks) {
    try {
      const apps = JSON.parse(kiosk.installed_apps);
      for (const app of apps) {
        if (!seen.has(app.exec)) {
          seen.add(app.exec);
          merged.push(app);
        }
      }
    } catch {}
  }

  merged.sort((a, b) => a.name.localeCompare(b.name));
  res.json(merged);
});

export default router;
