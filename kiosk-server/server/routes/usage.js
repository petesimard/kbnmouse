import { Router } from 'express';
import db from '../db.js';
import { requirePin } from '../middleware/auth.js';

const router = Router();

// GET /api/bonus-time - Get today's bonus minutes from challenge completions
router.get('/api/bonus-time', (req, res) => {
  const profileId = req.query.profile;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  let result;
  if (profileId) {
    result = db.prepare(
      'SELECT COALESCE(SUM(minutes_awarded), 0) as total FROM challenge_completions WHERE completed_at >= ? AND profile_id = ?'
    ).get(todayStart, profileId);
  } else {
    result = db.prepare(
      'SELECT COALESCE(SUM(minutes_awarded), 0) as total FROM challenge_completions WHERE completed_at >= ?'
    ).get(todayStart);
  }

  res.json({ today_bonus_minutes: result.total });
});

// GET /api/apps/:id/usage - Get usage summary for an app
router.get('/api/apps/:id/usage', (req, res) => {
  const appRecord = db.prepare('SELECT * FROM apps WHERE id = ?').get(req.params.id);
  if (!appRecord) {
    return res.status(404).json({ error: 'App not found' });
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset).toISOString();

  const todayUsage = db.prepare(
    'SELECT COALESCE(SUM(duration_seconds), 0) as total FROM app_usage WHERE app_id = ? AND started_at >= ?'
  ).get(req.params.id, todayStart);

  const weekUsage = db.prepare(
    'SELECT COALESCE(SUM(duration_seconds), 0) as total FROM app_usage WHERE app_id = ? AND started_at >= ?'
  ).get(req.params.id, weekStart);

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
router.get('/api/admin/usage-summary', requirePin, (req, res) => {
  const profileId = req.query.profile;
  const now = new Date();
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  let apps;
  if (profileId) {
    apps = db.prepare('SELECT id, name, icon FROM apps WHERE profile_id = ? ORDER BY sort_order').all(profileId);
  } else {
    apps = db.prepare('SELECT id, name, icon FROM apps ORDER BY sort_order').all();
  }
  const startDate = dates[0] + 'T00:00:00.000Z';

  let usageRows;
  if (profileId) {
    usageRows = db.prepare(
      `SELECT app_id, DATE(started_at) as date, SUM(duration_seconds) as seconds
       FROM app_usage
       WHERE started_at >= ? AND profile_id = ?
       GROUP BY app_id, DATE(started_at)`
    ).all(startDate, profileId);
  } else {
    usageRows = db.prepare(
      `SELECT app_id, DATE(started_at) as date, SUM(duration_seconds) as seconds
       FROM app_usage
       WHERE started_at >= ?
       GROUP BY app_id, DATE(started_at)`
    ).all(startDate);
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
