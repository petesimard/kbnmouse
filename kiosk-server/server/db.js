import Database from 'better-sqlite3';
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
if (!columns.find(col => col.name === 'max_daily_minutes')) {
  db.exec("ALTER TABLE apps ADD COLUMN max_daily_minutes INTEGER DEFAULT 0");
  console.log('Added max_daily_minutes column to apps table');
}
if (!columns.find(col => col.name === 'config')) {
  db.exec("ALTER TABLE apps ADD COLUMN config TEXT DEFAULT '{}'");
  console.log('Added config column to apps table');
}
if (!columns.find(col => col.name === 'folder_id')) {
  db.exec("ALTER TABLE apps ADD COLUMN folder_id INTEGER DEFAULT NULL");
  console.log('Added folder_id column to apps table');
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

// Create challenge_completions table for tracking bonus playtime earned
db.exec(`
  CREATE TABLE IF NOT EXISTS challenge_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenge_type TEXT NOT NULL,
    minutes_awarded INTEGER NOT NULL,
    completed_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_challenge_completions_completed_at
  ON challenge_completions(completed_at)
`);

// Create challenges table
db.exec(`
  CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    description TEXT DEFAULT '',
    challenge_type TEXT NOT NULL,
    reward_minutes INTEGER NOT NULL DEFAULT 10,
    config TEXT DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create settings table
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

// Create folders table
db.exec(`
  CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '📁',
    color TEXT NOT NULL DEFAULT '#6366f1',
    sort_order INTEGER DEFAULT 0,
    profile_id INTEGER DEFAULT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create profiles table
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '👤',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// --- Profile migration: add profile_id to existing tables ---
const appsColumns = db.prepare("PRAGMA table_info(apps)").all();
if (!appsColumns.find(col => col.name === 'profile_id')) {
  // Create a default profile for existing data
  const existingAppsCount = db.prepare('SELECT COUNT(*) as count FROM apps').get();
  let defaultProfileId = null;

  if (existingAppsCount.count > 0) {
    const result = db.prepare("INSERT INTO profiles (name, icon, sort_order) VALUES (?, ?, ?)").run('Default', '👤', 0);
    defaultProfileId = result.lastInsertRowid;
    console.log(`Created Default profile (id=${defaultProfileId}) for existing data`);
  }

  // Add profile_id columns
  db.exec("ALTER TABLE apps ADD COLUMN profile_id INTEGER DEFAULT NULL");
  db.exec("ALTER TABLE challenges ADD COLUMN profile_id INTEGER DEFAULT NULL");
  db.exec("ALTER TABLE app_usage ADD COLUMN profile_id INTEGER DEFAULT NULL");
  db.exec("ALTER TABLE challenge_completions ADD COLUMN profile_id INTEGER DEFAULT NULL");
  console.log('Added profile_id columns to apps, challenges, app_usage, challenge_completions');

  // Assign existing rows to the default profile
  if (defaultProfileId) {
    db.prepare("UPDATE apps SET profile_id = ? WHERE profile_id IS NULL").run(defaultProfileId);
    db.prepare("UPDATE challenges SET profile_id = ? WHERE profile_id IS NULL").run(defaultProfileId);
    db.prepare("UPDATE app_usage SET profile_id = ? WHERE profile_id IS NULL").run(defaultProfileId);
    db.prepare("UPDATE challenge_completions SET profile_id = ? WHERE profile_id IS NULL").run(defaultProfileId);
    console.log('Assigned existing data to Default profile');
  }
}

// Add max_completions_per_day column to challenges (0 = unlimited)
const challengeColumns = db.prepare("PRAGMA table_info(challenges)").all();
if (!challengeColumns.find(col => col.name === 'max_completions_per_day')) {
  db.exec("ALTER TABLE challenges ADD COLUMN max_completions_per_day INTEGER DEFAULT 0");
  console.log('Added max_completions_per_day column to challenges table');
}

// Migrate old 'math' challenge_type to 'math_addition'
const oldMathChallenges = db.prepare("SELECT id FROM challenges WHERE challenge_type = 'math'").all();
if (oldMathChallenges.length > 0) {
  db.prepare("UPDATE challenges SET challenge_type = 'math_addition', name = 'Math - Addition' WHERE challenge_type = 'math'").run();
  console.log(`Migrated ${oldMathChallenges.length} old 'math' challenge(s) to 'math_addition'`);
}

// Add indexes for profile_id lookups
db.exec("CREATE INDEX IF NOT EXISTS idx_apps_profile ON apps(profile_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_challenges_profile ON challenges(profile_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_app_usage_profile ON app_usage(profile_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_challenge_completions_profile ON challenge_completions(profile_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_apps_folder ON apps(folder_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_folders_profile ON folders(profile_id)");

// --- Account & auth tables ---

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);
db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)");

db.exec(`
  CREATE TABLE IF NOT EXISTS kiosks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS pairing_codes (
    code TEXT PRIMARY KEY,
    expires_at TEXT NOT NULL,
    claimed INTEGER DEFAULT 0
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS email_tokens (
    token TEXT PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    token_type TEXT NOT NULL CHECK(token_type IN ('magic_link', 'password_reset')),
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Seed default apps and challenges for a given profile
export function seedProfileDefaults(profileId) {
  const insertApp = db.prepare('INSERT INTO apps (name, url, icon, sort_order, app_type, profile_id) VALUES (?, ?, ?, ?, ?, ?)');
  const defaultApps = [
    { name: 'Home', url: '/test-content', icon: '🏠', sort_order: 0, app_type: 'url' },
    { name: 'Clock', url: 'clock', icon: '🕐', sort_order: 1, app_type: 'builtin' },
    { name: 'Drawing', url: 'drawing', icon: '🎨', sort_order: 2, app_type: 'builtin' },
    { name: 'Timer', url: 'timer', icon: '⏱️', sort_order: 3, app_type: 'builtin' },
    { name: 'Challenges', url: 'challenges', icon: '🏆', sort_order: 4, app_type: 'builtin' },
    { name: 'Game Creator', url: 'gamecreator', icon: '🎮', sort_order: 5, app_type: 'builtin' },
  ];
  for (const app of defaultApps) {
    insertApp.run(app.name, app.url, app.icon, app.sort_order, app.app_type, profileId);
  }

  const insertChallenge = db.prepare(
    'INSERT INTO challenges (name, icon, description, challenge_type, reward_minutes, config, sort_order, profile_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  insertChallenge.run('Math - Addition', '➕', 'Solve 10 addition problems', 'math_addition', 10, '{}', 0, profileId);
  insertChallenge.run('Math - Subtraction', '➖', 'Solve 10 subtraction problems', 'math_subtraction', 10, '{}', 1, profileId);
  insertChallenge.run('Math - Multiplication', '✖️', 'Solve 10 multiplication problems', 'math_multiplication', 10, '{}', 2, profileId);
  insertChallenge.run('Math - Division', '➗', 'Solve 10 division problems', 'math_division', 10, '{}', 3, profileId);
  insertChallenge.run('Typing', '⌨️', 'Type 10 words correctly', 'typing', 10, '{}', 4, profileId);

  console.log(`Seeded default apps and challenges for profile ${profileId}`);
}


// Create custom_games table for game creator feature
db.exec(`
  CREATE TABLE IF NOT EXISTS custom_games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    prompt TEXT NOT NULL,
    profile_id INTEGER NOT NULL,
    status TEXT DEFAULT 'generating',
    error_message TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);
db.exec("CREATE INDEX IF NOT EXISTS idx_custom_games_profile ON custom_games(profile_id)");

// Create messages table
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_type TEXT NOT NULL CHECK(sender_type IN ('profile', 'parent')),
    sender_profile_id INTEGER DEFAULT NULL,
    recipient_type TEXT NOT NULL CHECK(recipient_type IN ('profile', 'parent')),
    recipient_profile_id INTEGER DEFAULT NULL,
    content TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);
db.exec("CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_type, sender_profile_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_type, recipient_profile_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)");

// Create bulletin_pins table for community bulletin board
db.exec(`
  CREATE TABLE IF NOT EXISTS bulletin_pins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pin_type TEXT NOT NULL CHECK(pin_type IN ('message', 'emoji')),
    content TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    rotation REAL DEFAULT 0,
    color TEXT DEFAULT '#fef08a',
    profile_id INTEGER DEFAULT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);
db.exec("CREATE INDEX IF NOT EXISTS idx_bulletin_pins_created ON bulletin_pins(created_at)");

// Seed default bulletin pin if table is empty
const pinCount = db.prepare('SELECT COUNT(*) as count FROM bulletin_pins').get();
if (pinCount.count === 0) {
  db.prepare(
    'INSERT INTO bulletin_pins (pin_type, content, x, y, rotation, color) VALUES (?, ?, ?, ?, ?, ?)'
  ).run('message', 'Click the icons below to explore, or post your own note on this board for everyone to see!', 50, 45, -2, '#fef08a');
  console.log('Seeded default bulletin board pin');
}

// Fresh DB seeding: if no apps exist and no profiles exist, create a Default profile and seed
const appCount = db.prepare('SELECT COUNT(*) as count FROM apps').get();
const profileCount = db.prepare('SELECT COUNT(*) as count FROM profiles').get();
if (appCount.count === 0 && profileCount.count === 0) {
  const result = db.prepare("INSERT INTO profiles (name, icon, sort_order) VALUES (?, ?, ?)").run('Default', '👤', 0);
  seedProfileDefaults(result.lastInsertRowid);
  console.log('Fresh database: created Default profile with default apps and challenges');
}

export default db;
