import { Router } from 'express';
import { rm } from 'fs/promises';
import { existsSync } from 'fs';
import db from '../db.js';
import { broadcastRefresh } from '../websocket.js';
import { verifyProfileOwnership, accountProfileIds } from '../utils/profile.js';
import * as queue from '../gamegen/queue.js';
import * as handlers from '../gamegen/handlers.js';
import * as git from '../gamegen/git.js';

const router = Router();

// The kiosk app URL for a game. ?kiosk=1 makes the server inject the Manage
// overlay; shared QR links omit it. game.html is the agent's entry file.
const gameUrl = (id) => `/customgames/${id}/game.html?kiosk=1`;

// Load a game and verify the requesting account owns its profile, else 404.
function loadOwnedGame(req, res) {
  const game = db.prepare('SELECT * FROM custom_games WHERE id = ?').get(req.params.id);
  if (!game || !verifyProfileOwnership(game.profile_id, req.accountId)) {
    res.status(404).json({ error: 'Game not found' });
    return null;
  }
  return game;
}

// GET /api/games?profile=<id> — list games for profile
router.get('/', (req, res) => {
  const profileId = req.query.profile;
  if (!profileId) {
    return res.status(400).json({ error: 'profile query param is required' });
  }
  if (!verifyProfileOwnership(profileId, req.accountId)) {
    return res.status(404).json({ error: 'Profile not found' });
  }
  const games = db.prepare(
    'SELECT id, name, description, prompt, status, error_message, created_at, updated_at FROM custom_games WHERE profile_id = ? ORDER BY created_at DESC'
  ).all(profileId);
  res.json(games);
});

// GET /api/games/:id — game details + active job
router.get('/:id', (req, res) => {
  const game = loadOwnedGame(req, res);
  if (!game) return;
  res.json({ ...game, activeJob: queue.getActiveJob(game.id) ?? null });
});

// POST /api/games — create game and start generation
router.post('/', (req, res) => {
  const { name, prompt, profile_id } = req.body;
  if (!name || !prompt || !profile_id) {
    return res.status(400).json({ error: 'name, prompt, and profile_id are required' });
  }
  if (!verifyProfileOwnership(profile_id, req.accountId)) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  const result = db.prepare(
    'INSERT INTO custom_games (name, prompt, description, profile_id) VALUES (?, ?, ?, ?)'
  ).run(name, prompt, prompt, profile_id);
  const game = db.prepare('SELECT * FROM custom_games WHERE id = ?').get(result.lastInsertRowid);

  startGeneration(game.id, name, prompt, profile_id);
  res.status(201).json(game);
});

// POST /api/games/:id/update — modify game with a new prompt
router.post('/:id/update', (req, res) => {
  const game = loadOwnedGame(req, res);
  if (!game) return;
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  db.prepare(
    "UPDATE custom_games SET status = 'generating', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(game.id);
  startUpdate(game.id, prompt);
  res.json(db.prepare('SELECT * FROM custom_games WHERE id = ?').get(game.id));
});

// GET /api/games/:id/jobs — job history
router.get('/:id/jobs', (req, res) => {
  const game = loadOwnedGame(req, res);
  if (!game) return;
  res.json(queue.listJobs(game.id));
});

// GET /api/games/:id/jobs/:jobId — single job (for a commit's log)
router.get('/:id/jobs/:jobId', (req, res) => {
  const game = loadOwnedGame(req, res);
  if (!game) return;
  const job = queue.getJob(Number(req.params.jobId));
  if (!job || job.game_id !== game.id) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// GET /api/games/:id/commits — git history enriched with job info
router.get('/:id/commits', async (req, res) => {
  const game = loadOwnedGame(req, res);
  if (!game) return;
  const cwd = handlers.gameDir(game.id);
  if (!existsSync(cwd)) return res.json([]);
  try {
    const commits = await git.log(cwd);
    res.json(commits.map((c) => {
      const j = queue.findJobByCommit(game.id, c.hash);
      return { ...c, jobId: j?.id ?? null, jobType: j?.type ?? null };
    }));
  } catch (e) {
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});

// POST /api/games/:id/commits/:hash/revert — revert a change
router.post('/:id/commits/:hash/revert', (req, res) => {
  const game = loadOwnedGame(req, res);
  if (!game) return;
  const { hash } = req.params;
  const jobId = queue.enqueue(game.id, 'revert', `Revert ${hash.slice(0, 7)}`, (ctx) =>
    handlers.handleRevert({ gameId: game.id, hash }, ctx),
  );
  res.json({ jobId });
});

// GET /api/games/:id/textures
router.get('/:id/textures', (req, res) => {
  const game = loadOwnedGame(req, res);
  if (!game) return;
  res.json(db.prepare(
    `SELECT * FROM game_assets WHERE game_id = ? AND type = 'texture' ORDER BY id ASC`
  ).all(game.id));
});

// POST /api/games/:id/textures/:assetId/refine
router.post('/:id/textures/:assetId/refine', (req, res) => {
  const game = loadOwnedGame(req, res);
  if (!game) return;
  const refinement = (req.body?.refinement ?? '').trim();
  if (!refinement) return res.status(400).json({ error: 'refinement required' });
  const assetId = Number(req.params.assetId);
  const asset = db.prepare(
    `SELECT * FROM game_assets WHERE id = ? AND game_id = ? AND type = 'texture'`
  ).get(assetId, game.id);
  if (!asset) return res.status(404).json({ error: 'texture not found' });

  const jobId = queue.enqueue(game.id, 'refine-texture', `Refine ${asset.file}`, (ctx) =>
    handlers.handleRefineTexture({ gameId: game.id, assetId, refinement }, ctx),
  );
  res.json({ jobId });
});

// GET /api/games/:id/meshes — meshes with their texture associations
router.get('/:id/meshes', async (req, res) => {
  const game = loadOwnedGame(req, res);
  if (!game) return;
  const rows = db.prepare(
    `SELECT * FROM game_assets WHERE game_id = ? AND type = 'mesh' ORDER BY id ASC`
  ).all(game.id);
  try {
    const assoc = await handlers.readMeshAssoc(game.id);
    res.json(rows.map((r) => ({ ...r, textures: assoc.get(r.file) ?? [] })));
  } catch {
    res.json(rows.map((r) => ({ ...r, textures: [] })));
  }
});

// POST /api/games/:id/meshes/:assetId/refine
router.post('/:id/meshes/:assetId/refine', (req, res) => {
  const game = loadOwnedGame(req, res);
  if (!game) return;
  const refinement = (req.body?.refinement ?? '').trim();
  if (!refinement) return res.status(400).json({ error: 'refinement required' });
  const assetId = Number(req.params.assetId);
  const asset = db.prepare(
    `SELECT * FROM game_assets WHERE id = ? AND game_id = ? AND type = 'mesh'`
  ).get(assetId, game.id);
  if (!asset) return res.status(404).json({ error: 'mesh not found' });

  const jobId = queue.enqueue(game.id, 'refine-mesh', `Refine ${asset.file}`, (ctx) =>
    handlers.handleRefineMesh({ gameId: game.id, assetId, refinement }, ctx),
  );
  res.json({ jobId });
});

// PATCH /api/games/:id — rename or toggle sharing
router.patch('/:id', (req, res) => {
  const game = loadOwnedGame(req, res);
  if (!game) return;
  const { name, shared } = req.body;

  if (name !== undefined) {
    const trimmedName = name.trim();
    if (!trimmedName) return res.status(400).json({ error: 'name is required' });
    db.prepare('UPDATE custom_games SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(trimmedName, game.id);
    db.prepare('UPDATE apps SET name = ? WHERE url = ?').run(trimmedName, gameUrl(game.id));
  }

  if (shared !== undefined) {
    const sharedVal = shared ? 1 : 0;
    db.prepare('UPDATE custom_games SET shared = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(sharedVal, game.id);
    if (shared && game.status === 'ready') {
      createSharedAppEntries(game.id, game.name, game.profile_id, req.accountId);
    } else if (!shared) {
      removeSharedAppEntries(game.id, game.profile_id);
    }
  }

  broadcastRefresh();
  res.json(db.prepare('SELECT * FROM custom_games WHERE id = ?').get(game.id));
});

// DELETE /api/games/:id — delete game + files + app entries + job/asset rows
router.delete('/:id', async (req, res) => {
  const game = loadOwnedGame(req, res);
  if (!game) return;

  db.prepare('DELETE FROM apps WHERE url = ?').run(gameUrl(game.id));
  db.prepare('DELETE FROM custom_games WHERE id = ?').run(game.id);
  db.prepare('DELETE FROM game_jobs WHERE game_id = ?').run(game.id);
  db.prepare('DELETE FROM game_assets WHERE game_id = ?').run(game.id);

  try {
    await rm(handlers.gameDir(game.id), { recursive: true, force: true });
  } catch (err) {
    console.error(`[GameCreator] Failed to delete game directory for ${game.id}:`, err.message);
  }

  broadcastRefresh();
  res.status(204).send();
});

// Enqueue the create job; mark the game ready (+ add to profile) on success.
function startGeneration(gameId, name, prompt, profileId) {
  queue.enqueue(gameId, 'create-game', prompt, async (ctx) => {
    try {
      const result = await handlers.handleCreateGame({ gameId, description: prompt }, ctx);
      onGameReady(gameId, name, profileId);
      return result;
    } catch (err) {
      console.error(`[GameCreator] Generation failed for game ${gameId}:`, err.message);
      db.prepare(
        "UPDATE custom_games SET status = 'error', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(err.message, gameId);
      broadcastRefresh();
      throw err;
    }
  });
}

// Enqueue a modify job; the game stays playable from its previous build.
function startUpdate(gameId, prompt) {
  queue.enqueue(gameId, 'modify', prompt, async (ctx) => {
    try {
      const result = await handlers.handleModify({ gameId, description: prompt }, ctx);
      db.prepare(
        "UPDATE custom_games SET status = 'ready', error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(gameId);
      broadcastRefresh();
      return result;
    } catch (err) {
      console.error(`[GameCreator] Update failed for game ${gameId}:`, err.message);
      db.prepare(
        "UPDATE custom_games SET status = 'ready', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(err.message, gameId);
      broadcastRefresh();
      throw err;
    }
  });
}

// Get or create the "My Games" folder for a profile.
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
  return result.lastInsertRowid;
}

// Inherit the per-profile default daily limit from the gamecreator app config.
function defaultDailyLimit(profileId) {
  const creatorApp = db.prepare(
    "SELECT config FROM apps WHERE app_type = 'builtin' AND url = 'gamecreator' AND profile_id = ?"
  ).get(profileId);
  return JSON.parse(creatorApp?.config || '{}').default_daily_limit || null;
}

// Add the game as a kiosk app inside a profile's "My Games" folder.
function addGameApp(gameId, name, profileId) {
  const folderId = getOrCreateMyGamesFolder(profileId);
  const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM apps WHERE profile_id = ?').get(profileId);
  const sortOrder = (maxOrder?.max || 0) + 1;
  db.prepare(
    'INSERT INTO apps (name, url, icon, sort_order, app_type, enabled, profile_id, folder_id, daily_limit_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(name, gameUrl(gameId), '🎮', sortOrder, 'url', 1, profileId, folderId, defaultDailyLimit(profileId));
}

// Create app entries for a shared game in the account's other profiles.
function createSharedAppEntries(gameId, gameName, ownerProfileId, accountId) {
  const others = accountProfileIds(accountId).filter(id => id !== Number(ownerProfileId));
  for (const profileId of others) {
    const existing = db.prepare('SELECT id FROM apps WHERE url = ? AND profile_id = ?').get(gameUrl(gameId), profileId);
    if (existing) continue;
    addGameApp(gameId, gameName, profileId);
  }
}

// Remove shared app entries from every profile except the owner.
function removeSharedAppEntries(gameId, ownerProfileId) {
  db.prepare('DELETE FROM apps WHERE url = ? AND profile_id != ?').run(gameUrl(gameId), ownerProfileId);
}

// Mark a game ready and surface it as a kiosk app (its own play entry).
function onGameReady(gameId, name, profileId) {
  db.prepare(
    "UPDATE custom_games SET status = 'ready', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(gameId);

  addGameApp(gameId, name, profileId);

  const game = db.prepare('SELECT shared FROM custom_games WHERE id = ?').get(gameId);
  if (game?.shared) {
    const profile = db.prepare('SELECT account_id FROM profiles WHERE id = ?').get(profileId);
    if (profile) createSharedAppEntries(gameId, name, profileId, profile.account_id);
  }

  broadcastRefresh();
  console.log(`[GameCreator] Game ${gameId} ready and added to apps`);
}

export default router;
