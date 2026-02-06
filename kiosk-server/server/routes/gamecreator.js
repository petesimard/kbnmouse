import { Router } from 'express';
import { rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { broadcastRefresh } from '../websocket.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', '..', 'data', 'games');

const router = Router();

// GET /api/games?profile=<id> — list games for profile
router.get('/', (req, res) => {
  const profileId = req.query.profile;
  if (!profileId) {
    return res.status(400).json({ error: 'profile query param is required' });
  }
  const games = db.prepare(
    'SELECT id, name, description, prompt, status, error_message, created_at, updated_at FROM custom_games WHERE profile_id = ? ORDER BY created_at DESC'
  ).all(profileId);
  res.json(games);
});

// GET /api/games/:id — get game details + status
router.get('/:id', (req, res) => {
  const game = db.prepare('SELECT * FROM custom_games WHERE id = ?').get(req.params.id);
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }
  res.json(game);
});

// POST /api/games — create game and start generation
router.post('/', async (req, res) => {
  const { name, prompt, profile_id } = req.body;
  if (!name || !prompt || !profile_id) {
    return res.status(400).json({ error: 'name, prompt, and profile_id are required' });
  }

  const result = db.prepare(
    'INSERT INTO custom_games (name, prompt, profile_id) VALUES (?, ?, ?)'
  ).run(name, prompt, profile_id);

  const game = db.prepare('SELECT * FROM custom_games WHERE id = ?').get(result.lastInsertRowid);

  // Start generation in background (imported dynamically to avoid circular deps)
  startGeneration(game.id, name, prompt, profile_id);

  res.status(201).json(game);
});

// POST /api/games/:id/update — update game with new prompt
router.post('/:id/update', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const game = db.prepare('SELECT * FROM custom_games WHERE id = ?').get(req.params.id);
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  db.prepare(
    "UPDATE custom_games SET status = 'generating', prompt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(prompt, game.id);

  const updated = db.prepare('SELECT * FROM custom_games WHERE id = ?').get(game.id);

  // Start update generation in background
  startUpdate(game.id, prompt);

  res.json(updated);
});

// DELETE /api/games/:id — delete game + files + app entry
router.delete('/:id', async (req, res) => {
  const game = db.prepare('SELECT * FROM custom_games WHERE id = ?').get(req.params.id);
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  // Remove app entry that references this game
  db.prepare("DELETE FROM apps WHERE url = ? AND profile_id = ?").run(`/game/${game.id}`, game.profile_id);

  // Remove game record
  db.prepare('DELETE FROM custom_games WHERE id = ?').run(game.id);

  // Remove game files from disk
  const gameDir = join(dataDir, String(game.id));
  try {
    await rm(gameDir, { recursive: true, force: true });
  } catch (err) {
    console.error(`[GameCreator] Failed to delete game directory ${gameDir}:`, err.message);
  }

  broadcastRefresh();
  res.status(204).send();
});

// Background generation helper
function startGeneration(gameId, name, prompt, profileId) {
  (async () => {
    try {
      const { generateGame } = await import('../agent/gameAgent.js');
      await generateGame(gameId, prompt);
      onGameReady(gameId, name, profileId);
    } catch (err) {
      console.error(`[GameCreator] Generation failed for game ${gameId}:`, err.message);
      db.prepare(
        "UPDATE custom_games SET status = 'error', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(err.message, gameId);
      broadcastRefresh();
    }
  })();
}

// Background update helper
function startUpdate(gameId, prompt) {
  (async () => {
    try {
      const game = db.prepare('SELECT * FROM custom_games WHERE id = ?').get(gameId);
      const { updateGame } = await import('../agent/gameAgent.js');
      await updateGame(gameId, prompt);
      db.prepare(
        "UPDATE custom_games SET status = 'ready', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(gameId);
      broadcastRefresh();
    } catch (err) {
      console.error(`[GameCreator] Update failed for game ${gameId}:`, err.message);
      db.prepare(
        "UPDATE custom_games SET status = 'error', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(err.message, gameId);
      broadcastRefresh();
    }
  })();
}

// Get or create the "My Games" folder for a profile
function getOrCreateMyGamesFolder(profileId) {
  const existing = db.prepare(
    "SELECT id FROM folders WHERE name = 'My Games' AND profile_id = ?"
  ).get(profileId);
  if (existing) return existing.id;

  const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM folders WHERE profile_id = ?').get(profileId);
  const sortOrder = (maxOrder?.max || 0) + 1;
  const result = db.prepare(
    'INSERT INTO folders (name, icon, color, sort_order, profile_id) VALUES (?, ?, ?, ?, ?)'
  ).run('My Games', '🎮', '#6366f1', sortOrder, profileId);
  console.log(`[GameCreator] Created "My Games" folder (id=${result.lastInsertRowid}) for profile ${profileId}`);
  return result.lastInsertRowid;
}

// When generation completes successfully
function onGameReady(gameId, name, profileId) {
  db.prepare(
    "UPDATE custom_games SET status = 'ready', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(gameId);

  const folderId = getOrCreateMyGamesFolder(profileId);

  // Read default_daily_limit from the gamecreator app's config
  const creatorApp = db.prepare(
    "SELECT config FROM apps WHERE app_type = 'builtin' AND url = 'gamecreator' AND profile_id = ?"
  ).get(profileId);
  const creatorConfig = JSON.parse(creatorApp?.config || '{}');
  const dailyLimit = creatorConfig.default_daily_limit || null;

  // Get max sort_order for this profile's apps
  const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM apps WHERE profile_id = ?').get(profileId);
  const sortOrder = (maxOrder?.max || 0) + 1;

  // Add to apps table inside the "My Games" folder
  db.prepare(
    'INSERT INTO apps (name, url, icon, sort_order, app_type, enabled, profile_id, folder_id, daily_limit_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(name, `/game/${gameId}`, '\uD83C\uDFAE', sortOrder, 'url', 1, profileId, folderId, dailyLimit);

  broadcastRefresh();
  console.log(`[GameCreator] Game ${gameId} ready and added to apps${dailyLimit ? ` (daily limit: ${dailyLimit}min)` : ''}`);
}

export default router;
