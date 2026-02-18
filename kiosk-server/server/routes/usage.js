import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { verifyProfileOwnership, accountProfileIds } from '../utils/profile.js';

const router = Router();

// GET /api/bonus-time - Get today's bonus minutes from challenge completions
router.get('/api/bonus-time', (req, res) => {
  const profileId = req.query.profile;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  if (profileId) {
    if (!verifyProfileOwnership(profileId, req.accountId)) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    const result = db.prepare(
      'SELECT COALESCE(SUM(minutes_awarded), 0) as total FROM challenge_completions WHERE completed_at >= ? AND profile_id = ?'
    ).get(todayStart, profileId);
    return res.json({ today_bonus_minutes: result.total });
  }

  // No profile param — scope to account's profiles
  const profileIds = accountProfileIds(req.accountId);
  if (profileIds.length === 0) return res.json({ today_bonus_minutes: 0 });
  const placeholders = profileIds.map(() => '?').join(',');
  const result = db.prepare(
    `SELECT COALESCE(SUM(minutes_awarded), 0) as total FROM challenge_completions WHERE completed_at >= ? AND profile_id IN (${placeholders})`
  ).get(todayStart, ...profileIds);
  res.json({ today_bonus_minutes: result.total });
});

// GET /api/apps/:id/usage - Get usage summary for an app
router.get('/api/apps/:id/usage', (req, res) => {
  const appRecord = db.prepare('SELECT * FROM apps WHERE id = ?').get(req.params.id);
  if (!appRecord) {
    return res.status(404).json({ error: 'App not found' });
  }
  if (!appRecord.profile_id || !verifyProfileOwnership(appRecord.profile_id, req.accountId)) {
    return res.status(404).json({ error: 'App not found' });
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset).toISOString();

  // Check if this app is in a "My Games" folder with shared limits enabled
  let usageAppIds = [req.params.id];
  if (appRecord.folder_id) {
    const folder = db.prepare('SELECT id, name FROM folders WHERE id = ?').get(appRecord.folder_id);
    if (folder && folder.name === 'My Games') {
      // Check the gamecreator builtin app's config for share_daily_limit
      const gcApp = db.prepare(
        "SELECT config FROM apps WHERE app_type = 'builtin' AND url = 'gamecreator' AND profile_id = ?"
      ).get(appRecord.profile_id);
      let shareEnabled = true; // default to true
      if (gcApp && gcApp.config) {
        try {
          const config = JSON.parse(gcApp.config);
          if (config.share_daily_limit === false) shareEnabled = false;
        } catch {}
      }
      if (shareEnabled) {
        const folderApps = db.prepare('SELECT id FROM apps WHERE folder_id = ?').all(folder.id);
        usageAppIds = folderApps.map(a => a.id);
      }
    }
  }

  const placeholders = usageAppIds.map(() => '?').join(',');

  const todayUsage = db.prepare(
    `SELECT COALESCE(SUM(duration_seconds), 0) as total FROM app_usage WHERE app_id IN (${placeholders}) AND started_at >= ?`
  ).get(...usageAppIds, todayStart);

  const weekUsage = db.prepare(
    `SELECT COALESCE(SUM(duration_seconds), 0) as total FROM app_usage WHERE app_id IN (${placeholders}) AND started_at >= ?`
  ).get(...usageAppIds, weekStart);

  const profileId = appRecord.profile_id;
  let bonusResult;
  if (profileId) {
    bonusResult = db.prepare(
      'SELECT COALESCE(SUM(minutes_awarded), 0) as total FROM challenge_completions WHERE completed_at >= ? AND profile_id = ?'
    ).get(todayStart, profileId);
  } else {
    bonusResult = db.prepare(
      'SELECT COALESCE(SUM(minutes_awarded), 0) as total FROM challenge_completions WHERE completed_at >= ?'
    ).get(todayStart);
  }

  res.json({
    today_seconds: todayUsage.total,
    week_seconds: weekUsage.total,
    daily_limit_minutes: appRecord.daily_limit_minutes,
    weekly_limit_minutes: appRecord.weekly_limit_minutes,
    max_daily_minutes: appRecord.max_daily_minutes || 0,
    bonus_minutes_today: bonusResult.total,
  });
});

// POST /api/apps/:id/usage - Record usage session for an app
router.post('/api/apps/:id/usage', (req, res) => {
  const appRecord = db.prepare('SELECT id, profile_id FROM apps WHERE id = ?').get(req.params.id);
  if (!appRecord) {
    return res.status(404).json({ error: 'App not found' });
  }
  if (!appRecord.profile_id || !verifyProfileOwnership(appRecord.profile_id, req.accountId)) {
    return res.status(404).json({ error: 'App not found' });
  }

  const { started_at, ended_at, duration_seconds } = req.body;
  if (!started_at || !ended_at || duration_seconds == null) {
    return res.status(400).json({ error: 'started_at, ended_at, and duration_seconds are required' });
  }

  db.prepare(
    'INSERT INTO app_usage (app_id, started_at, ended_at, duration_seconds, profile_id) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.id, started_at, ended_at, duration_seconds, appRecord.profile_id || null);

  res.status(201).json({ success: true });
});

// GET /api/admin/usage-summary - Get aggregated usage summary for all apps over past 7 days
router.get('/api/admin/usage-summary', requireAuth, (req, res) => {
  const profileId = req.query.profile;
  const now = new Date();
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  let apps;
  let usageRows;
  const startDate = dates[0] + 'T00:00:00.000Z';

  if (profileId) {
    if (!verifyProfileOwnership(profileId, req.accountId)) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    apps = db.prepare('SELECT id, name, icon FROM apps WHERE profile_id = ? ORDER BY sort_order').all(profileId);
    usageRows = db.prepare(
      `SELECT app_id, DATE(started_at) as date, SUM(duration_seconds) as seconds
       FROM app_usage
       WHERE started_at >= ? AND profile_id = ?
       GROUP BY app_id, DATE(started_at)`
    ).all(startDate, profileId);
  } else {
    const profileIds = accountProfileIds(req.accountId);
    if (profileIds.length === 0) return res.json({ dates, apps: [] });
    const placeholders = profileIds.map(() => '?').join(',');
    apps = db.prepare(`SELECT id, name, icon FROM apps WHERE profile_id IN (${placeholders}) ORDER BY sort_order`).all(...profileIds);
    usageRows = db.prepare(
      `SELECT app_id, DATE(started_at) as date, SUM(duration_seconds) as seconds
       FROM app_usage
       WHERE started_at >= ? AND profile_id IN (${placeholders})
       GROUP BY app_id, DATE(started_at)`
    ).all(startDate, ...profileIds);
  }

  const usageMap = {};
  for (const row of usageRows) {
    if (!usageMap[row.app_id]) usageMap[row.app_id] = {};
    usageMap[row.app_id][row.date] = row.seconds;
  }

  const result = apps.map(app => ({
    id: app.id,
    name: app.name,
    icon: app.icon,
    daily: dates.map(date => ({
      date,
      seconds: (usageMap[app.id] && usageMap[app.id][date]) || 0,
    })),
  }));

  res.json({ dates, apps: result });
});

export default router;
