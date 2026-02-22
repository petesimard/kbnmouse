import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

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

// Create settings table (account-scoped)
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    account_id INTEGER NOT NULL,
    UNIQUE(key, account_id)
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

// Migration: add account_id to profiles
const profileCols = db.prepare("PRAGMA table_info(profiles)").all();
if (!profileCols.some(c => c.name === 'account_id')) {
  db.exec('ALTER TABLE profiles ADD COLUMN account_id INTEGER');
  // Backfill: assign orphaned profiles to the first account (if any)
  const firstAccount = db.prepare('SELECT id FROM accounts ORDER BY id LIMIT 1').get();
  if (firstAccount) {
    db.prepare('UPDATE profiles SET account_id = ? WHERE account_id IS NULL').run(firstAccount.id);
    console.log(`Backfilled profiles with account_id = ${firstAccount.id}`);
  }
}

// Migration: add age to profiles
const profileCols2 = db.prepare("PRAGMA table_info(profiles)").all();
if (!profileCols2.some(c => c.name === 'age')) {
  db.exec('ALTER TABLE profiles ADD COLUMN age INTEGER');
}

// Migration: add screen_time_preset to profiles
if (!profileCols2.some(c => c.name === 'screen_time_preset')) {
  db.exec("ALTER TABLE profiles ADD COLUMN screen_time_preset TEXT DEFAULT 'off'");
}

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

// Migration: add active_profile_id to kiosks for per-kiosk profile selection
{
  const kioskCols = db.prepare("PRAGMA table_info(kiosks)").all();
  if (!kioskCols.find(c => c.name === 'active_profile_id')) {
    db.exec('ALTER TABLE kiosks ADD COLUMN active_profile_id INTEGER DEFAULT NULL');
    console.log('Added active_profile_id column to kiosks table');
  }
}

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

// Default time limits (in minutes) for builtin apps at the "medium" preset.
// High = half, Low = double, Off = no limit.
const BUILTIN_DEFAULT_TIME_LIMITS = {
  drawing: 30,
  chatbot: 30,
  imagegen: 30,
  _games: 30,  // used for gamecreator's default_daily_limit config (not the creator itself)
};

// Known free kids games — matched against kiosk installed apps exec commands
const KNOWN_GAMES = [
  { name: 'GCompris', execMatch: 'gcompris', icon: '🎓' },
  { name: 'Tux Paint', execMatch: 'tuxpaint', icon: '🐧' },
  { name: 'Tux Math', execMatch: 'tuxmath', icon: '🔢' },
  { name: 'SuperTuxKart', execMatch: 'supertuxkart', icon: '🏎️' },
  { name: 'Frozen Bubble', execMatch: 'frozen-bubble', icon: '🫧' },
];

const GAME_DEFAULT_DAILY_LIMIT = 10;

export function computeTimeLimit(appUrl, screenTimePreset) {
  if (!screenTimePreset || screenTimePreset === 'off') return null;
  const base = BUILTIN_DEFAULT_TIME_LIMITS[appUrl];
  if (!base) return null;
  if (screenTimePreset === 'medium') return base;
  if (screenTimePreset === 'high') return Math.round(base * 2);
  if (screenTimePreset === 'low') return Math.round(base / 2);
  return null;
}

// Default max completions per day for challenges at the "medium" preset.
// High = 2x, Low = half (min 1), Off = 0 (unlimited).
const DEFAULT_MAX_COMPLETIONS = 2;

export function computeMaxCompletions(screenTimePreset) {
  if (!screenTimePreset || screenTimePreset === 'off') return 0;
  if (screenTimePreset === 'medium') return DEFAULT_MAX_COMPLETIONS;
  if (screenTimePreset === 'high') return DEFAULT_MAX_COMPLETIONS * 2;
  if (screenTimePreset === 'low') return Math.max(1, Math.round(DEFAULT_MAX_COMPLETIONS / 2));
  return 0;
}

// Seed default apps and challenges for a given profile
export function seedProfileDefaults(profileId, age, screenTimePreset) {
  const insertApp = db.prepare('INSERT INTO apps (name, url, icon, sort_order, app_type, profile_id, daily_limit_minutes) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insertAppWithConfig = db.prepare('INSERT INTO apps (name, url, icon, sort_order, app_type, profile_id, daily_limit_minutes, config) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insertAppInFolder = db.prepare('INSERT INTO apps (name, url, icon, sort_order, app_type, profile_id, folder_id, daily_limit_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

  // Compute default_daily_limit for created games based on preset (same 30min base)
  const gameCreatorLimit = computeTimeLimit('_games', screenTimePreset);
  const gameCreatorConfig = gameCreatorLimit ? JSON.stringify({ default_daily_limit: gameCreatorLimit }) : '{}';

  const defaultApps = [
    { name: 'Clock', url: 'clock', icon: '🕐', sort_order: 0, app_type: 'builtin' },
    { name: 'Drawing', url: 'drawing', icon: '🎨', sort_order: 1, app_type: 'builtin' },
    { name: 'Calculator', url: 'calculator', icon: '🧮', sort_order: 2, app_type: 'builtin' },
    { name: 'Challenges', url: 'challenges', icon: '🏆', sort_order: 3, app_type: 'builtin' },
    { name: 'Game Creator', url: 'gamecreator', icon: '🎮', sort_order: 4, app_type: 'builtin', config: gameCreatorConfig },
    { name: 'Message Center', url: 'messages', icon: '✉️', sort_order: 5, app_type: 'builtin' },
  ];
  for (const app of defaultApps) {
    const limit = computeTimeLimit(app.url, screenTimePreset);
    if (app.config) {
      insertAppWithConfig.run(app.name, app.url, app.icon, app.sort_order, app.app_type, profileId, limit, app.config);
    } else {
      insertApp.run(app.name, app.url, app.icon, app.sort_order, app.app_type, profileId, limit);
    }
  }

  // Create "AI" folder with AI-powered apps
  const aiFolderId = db.prepare(
    'INSERT INTO folders (name, icon, color, sort_order, profile_id) VALUES (?, ?, ?, ?, ?)'
  ).run('AI', '🤖', '#8b5cf6', 6, profileId).lastInsertRowid;
  insertAppInFolder.run('Image Generator', 'imagegen', '🖼️', 0, 'builtin', profileId, aiFolderId, computeTimeLimit('imagegen', screenTimePreset));
  insertAppInFolder.run('ChatBot', 'chatbot', '🤖', 1, 'builtin', profileId, aiFolderId, computeTimeLimit('chatbot', screenTimePreset));

  // Tune challenge configs based on age
  let addSubConfig, mulDivConfig, typingConfig;
  if (age && age <= 5) {
    addSubConfig = { min_number: 0, max_number: 10 };
    typingConfig = { difficulty: 'easy' };
  } else if (age && age <= 7) {
    addSubConfig = { min_number: 0, max_number: 20 };
    typingConfig = { difficulty: 'easy' };
  } else if (age && age <= 9) {
    addSubConfig = { min_number: 0, max_number: 50 };
    mulDivConfig = { min_number: 2, max_number: 10 };
    typingConfig = { difficulty: 'medium' };
  } else if (age && age <= 11) {
    addSubConfig = { min_number: 10, max_number: 500 };
    mulDivConfig = { min_number: 2, max_number: 12 };
    typingConfig = { difficulty: 'medium' };
  } else if (age && age >= 12) {
    addSubConfig = { min_number: 10, max_number: 999 };
    mulDivConfig = { min_number: 2, max_number: 20 };
    typingConfig = { difficulty: 'hard' };
  } else {
    // No age provided — use component defaults
    addSubConfig = {};
    mulDivConfig = {};
    typingConfig = {};
  }

  const maxCompletions = computeMaxCompletions(screenTimePreset);
  const insertChallenge = db.prepare(
    'INSERT INTO challenges (name, icon, description, challenge_type, reward_minutes, config, sort_order, profile_id, max_completions_per_day) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  let order = 0;
  insertChallenge.run('Math - Addition', '➕', 'Solve addition problems', 'math_addition', 10, JSON.stringify(addSubConfig), order++, profileId, maxCompletions);
  insertChallenge.run('Math - Subtraction', '➖', 'Solve subtraction problems', 'math_subtraction', 10, JSON.stringify(addSubConfig), order++, profileId, maxCompletions);
  if (!age || age >= 8) {
    insertChallenge.run('Math - Multiplication', '✖️', 'Solve multiplication problems', 'math_multiplication', 10, JSON.stringify(mulDivConfig), order++, profileId, maxCompletions);
    insertChallenge.run('Math - Division', '➗', 'Solve division problems', 'math_division', 10, JSON.stringify(mulDivConfig), order++, profileId, maxCompletions);
  }
  insertChallenge.run('Typing', '⌨️', 'Type the words correctly', 'typing', 10, JSON.stringify(typingConfig), order++, profileId, maxCompletions);

  console.log(`Seeded default apps and challenges for profile ${profileId}${age ? ` (age ${age})` : ''}`);

  // Auto-provision known games from any kiosk already connected to this account
  const profile = db.prepare('SELECT account_id FROM profiles WHERE id = ?').get(profileId);
  if (profile?.account_id) {
    const kiosks = db.prepare('SELECT id, installed_apps FROM kiosks WHERE account_id = ? AND installed_apps IS NOT NULL').all(profile.account_id);
    for (const kiosk of kiosks) {
      try {
        const apps = JSON.parse(kiosk.installed_apps);
        seedKnownGamesForProfile(profileId, screenTimePreset, apps, kiosk.id);
      } catch {}
    }
  }
}

// Auto-provision known games for a profile based on kiosk's installed apps.
// Returns the number of games added.
export function seedKnownGamesForProfile(profileId, screenTimePreset, installedApps, kioskId) {
  let added = 0;
  const dailyLimit = (!screenTimePreset || screenTimePreset === 'off') ? null : GAME_DEFAULT_DAILY_LIMIT;

  for (const game of KNOWN_GAMES) {
    // Check if any installed app's exec matches this known game
    const match = installedApps.find(app => {
      const basename = app.exec.split('/').pop().split(' ')[0];
      return basename === game.execMatch || app.exec.includes(game.execMatch);
    });
    if (!match) continue;

    // Idempotency: skip if this profile already has a native app with matching exec
    const existing = db.prepare(
      "SELECT id FROM apps WHERE profile_id = ? AND app_type = 'native' AND url LIKE ?"
    ).get(profileId, `%${game.execMatch}%`);
    if (existing) continue;

    // Create or reuse "Games" folder for this profile
    let folder = db.prepare(
      "SELECT id FROM folders WHERE profile_id = ? AND name = 'Games'"
    ).get(profileId);
    if (!folder) {
      const result = db.prepare(
        'INSERT INTO folders (name, icon, color, sort_order, profile_id) VALUES (?, ?, ?, ?, ?)'
      ).run('Games', '🎮', '#22c55e', 100, profileId);
      folder = { id: result.lastInsertRowid };
    }

    // Use kiosk icon URL only if the icon file was actually pushed
    const iconFile = kioskId && match.iconKey
      ? join(__dirname, '..', 'data', 'app-icons', String(kioskId), `${match.iconKey}.png`)
      : null;
    const icon = iconFile && existsSync(iconFile)
      ? `/api/admin/app-icon/${kioskId}/${match.iconKey}`
      : game.icon;

    db.prepare(
      'INSERT INTO apps (name, url, icon, sort_order, app_type, profile_id, folder_id, daily_limit_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(game.name, match.exec, icon, added, 'native', profileId, folder.id, dailyLimit);
    added++;
  }

  if (added > 0) {
    console.log(`Auto-provisioned ${added} known game(s) for profile ${profileId}`);
  }
  return added;
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

// Migration: add game_type column to custom_games
{
  const cols = db.prepare("PRAGMA table_info(custom_games)").all();
  if (!cols.find(c => c.name === 'game_type')) {
    db.exec("ALTER TABLE custom_games ADD COLUMN game_type TEXT DEFAULT '3d'");
  }
  if (!cols.find(c => c.name === 'shared')) {
    db.exec("ALTER TABLE custom_games ADD COLUMN shared INTEGER DEFAULT 0");
  }
}

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

// Create drawings table for save/load in Drawing builtin
db.exec(`
  CREATE TABLE IF NOT EXISTS drawings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    profile_id INTEGER NOT NULL,
    image_data TEXT NOT NULL,
    thumbnail TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);
db.exec("CREATE INDEX IF NOT EXISTS idx_drawings_profile ON drawings(profile_id)");

// Migration: add is_parent column to bulletin_pins
const bpCols = db.prepare("PRAGMA table_info(bulletin_pins)").all();
if (!bpCols.find(col => col.name === 'is_parent')) {
  db.exec("ALTER TABLE bulletin_pins ADD COLUMN is_parent INTEGER DEFAULT 0");
  console.log('Added is_parent column to bulletin_pins table');
}

// Migration: add account_id to bulletin_pins for scoping parent pins
if (!bpCols.find(col => col.name === 'account_id')) {
  db.exec("ALTER TABLE bulletin_pins ADD COLUMN account_id INTEGER DEFAULT NULL");
  // Backfill: assign orphaned parent pins to the first account (if any)
  const firstAccount = db.prepare('SELECT id FROM accounts ORDER BY id LIMIT 1').get();
  if (firstAccount) {
    db.prepare('UPDATE bulletin_pins SET account_id = ? WHERE is_parent = 1 AND account_id IS NULL').run(firstAccount.id);
  }
  console.log('Added account_id column to bulletin_pins table');
}


// Migration: add 'photo' to pin_type CHECK constraint
const bpSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='bulletin_pins'").get();
if (bpSchema && !bpSchema.sql.includes("'photo'")) {
  db.exec(`CREATE TABLE bulletin_pins_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pin_type TEXT NOT NULL CHECK(pin_type IN ('message', 'emoji', 'photo')),
    content TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    rotation REAL DEFAULT 0,
    color TEXT DEFAULT '#fef08a',
    profile_id INTEGER DEFAULT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    is_parent INTEGER DEFAULT 0,
    account_id INTEGER DEFAULT NULL
  )`);
  db.exec('INSERT INTO bulletin_pins_new SELECT * FROM bulletin_pins');
  db.exec('DROP TABLE bulletin_pins');
  db.exec('ALTER TABLE bulletin_pins_new RENAME TO bulletin_pins');
  db.exec("CREATE INDEX IF NOT EXISTS idx_bulletin_pins_created ON bulletin_pins(created_at)");
  console.log('Migrated bulletin_pins to support photo pin type');
}

// --- Migration: make settings account-scoped ---
const settingsCols = db.prepare("PRAGMA table_info(settings)").all();
if (!settingsCols.find(col => col.name === 'account_id')) {
  // Save existing settings (skip active_profile — it's transient)
  const oldSettings = db.prepare("SELECT key, value FROM settings WHERE key != 'active_profile'").all();

  // Recreate table with account_id
  db.exec('DROP TABLE settings');
  db.exec(`
    CREATE TABLE settings (
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      account_id INTEGER NOT NULL,
      UNIQUE(key, account_id)
    )
  `);

  // Copy settings to all existing accounts
  const allAccounts = db.prepare('SELECT id FROM accounts').all();
  if (allAccounts.length > 0 && oldSettings.length > 0) {
    const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value, account_id) VALUES (?, ?, ?)');
    for (const account of allAccounts) {
      for (const setting of oldSettings) {
        insertSetting.run(setting.key, setting.value, account.id);
      }
    }
  }

  console.log('Migrated settings table to account-scoped');
}

// Migration: point game app URLs directly to /customgames/ for accurate time tracking
// (Previously they pointed to /game/:id management page, which counted management time)
const gameUrlMigrated = db.prepare("SELECT COUNT(*) as c FROM apps WHERE url LIKE '/game/%'").get();
if (gameUrlMigrated.c > 0) {
  const gameApps = db.prepare("SELECT id, url FROM apps WHERE url LIKE '/game/%'").all();
  const update = db.prepare("UPDATE apps SET url = ? WHERE id = ?");
  for (const app of gameApps) {
    const gameId = app.url.replace('/game/', '');
    update.run(`/customgames/${gameId}/index.html?kiosk=1`, app.id);
  }
  console.log(`Migrated ${gameApps.length} game app URL(s) from /game/ to /customgames/`);
}

// --- Settings helpers ---

export function getSetting(key, accountId) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ? AND account_id = ?').get(key, accountId);
  return row?.value ?? null;
}

export function setSetting(key, value, accountId) {
  db.prepare(
    'INSERT INTO settings (key, value, account_id) VALUES (?, ?, ?) ON CONFLICT(key, account_id) DO UPDATE SET value = excluded.value'
  ).run(key, String(value), accountId);
}

export function deleteSetting(key, accountId) {
  db.prepare('DELETE FROM settings WHERE key = ? AND account_id = ?').run(key, accountId);
}

export default db;
