import Database from 'better-sqlite3';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'data', 'kiosk.db');

const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS apps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    icon TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    enabled INTEGER DEFAULT 1,
    app_type TEXT DEFAULT 'url',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Add app_type column if it doesn't exist (migration for existing databases)
const columns = db.prepare("PRAGMA table_info(apps)").all();
if (!columns.find(col => col.name === 'app_type')) {
  db.exec("ALTER TABLE apps ADD COLUMN app_type TEXT DEFAULT 'url'");
  console.log('Added app_type column to apps table');
}
if (!columns.find(col => col.name === 'daily_limit_minutes')) {
  db.exec("ALTER TABLE apps ADD COLUMN daily_limit_minutes INTEGER DEFAULT NULL");
  console.log('Added daily_limit_minutes column to apps table');
}
if (!columns.find(col => col.name === 'weekly_limit_minutes')) {
  db.exec("ALTER TABLE apps ADD COLUMN weekly_limit_minutes INTEGER DEFAULT NULL");
  console.log('Added weekly_limit_minutes column to apps table');
}

// Create app_usage table for tracking native app session durations
db.exec(`
  CREATE TABLE IF NOT EXISTS app_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    started_at TEXT NOT NULL,
    ended_at TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Add index for fast date-range queries on app_usage
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_app_usage_app_started
  ON app_usage(app_id, started_at)
`);

// Create settings table
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

// Hash function for PIN
export function hashPin(pin) {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

// Initialize default PIN (1234) if not set
const existingPin = db.prepare("SELECT value FROM settings WHERE key = 'pin'").get();
if (!existingPin) {
  db.prepare("INSERT INTO settings (key, value) VALUES ('pin', ?)").run(hashPin('1234'));
  console.log('Default PIN initialized');
}

// Seed with default apps if table is empty
const count = db.prepare('SELECT COUNT(*) as count FROM apps').get();
if (count.count === 0) {
  const insert = db.prepare('INSERT INTO apps (name, url, icon, sort_order, app_type) VALUES (?, ?, ?, ?, ?)');
  const defaultApps = [
    { name: 'Home', url: '/test-content', icon: '🏠', sort_order: 0, app_type: 'url' },
    { name: 'Clock', url: 'clock', icon: '🕐', sort_order: 1, app_type: 'builtin' },
    { name: 'Drawing', url: 'drawing', icon: '🎨', sort_order: 2, app_type: 'builtin' },
    { name: 'Timer', url: 'timer', icon: '⏱️', sort_order: 3, app_type: 'builtin' },
  ];

  for (const app of defaultApps) {
    insert.run(app.name, app.url, app.icon, app.sort_order, app.app_type);
  }
  console.log('Database seeded with default apps');
}

export default db;
