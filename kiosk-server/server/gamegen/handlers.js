import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { runAgent, refinePrompt } from './agent.js';
import { generateImage } from './images.js';
import * as git from './git.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const GAMES_DIR = path.resolve(__dirname, '..', '..', 'data', 'games');

export function gameDir(id) {
  return path.join(GAMES_DIR, String(id));
}

async function readManifest(cwd) {
  try {
    const text = await fs.readFile(path.join(cwd, 'manifest.json'), 'utf8');
    const json = JSON.parse(text);
    return {
      textures: Array.isArray(json.textures) ? json.textures : [],
      meshes: Array.isArray(json.meshes) ? json.meshes : [],
    };
  } catch {
    return { textures: [], meshes: [] };
  }
}

async function writeManifest(cwd, manifest) {
  await fs.writeFile(path.join(cwd, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

function setAssetStatus(id, status, error = null) {
  db.prepare(`UPDATE game_assets SET status = ?, error = ?, updated_at = ? WHERE id = ?`)
    .run(status, error, Date.now(), id);
}

async function syncAndGenerateTextures(gameId, cwd, log) {
  const { textures } = await readManifest(cwd);
  await fs.mkdir(path.join(cwd, 'textures'), { recursive: true });
  const apiKey = process.env.OPENAI_API_KEY;
  const newEntries = [];
  for (const t of textures) {
    if (!t?.file || !t?.prompt) continue;
    const existing = db
      .prepare(`SELECT id FROM game_assets WHERE game_id = ? AND file = ?`)
      .get(gameId, t.file);
    if (!existing) {
      db.prepare(
        `INSERT INTO game_assets (game_id, type, file, prompt, status, updated_at) VALUES (?, 'texture', ?, ?, 'pending', ?)`,
      ).run(gameId, t.file, t.prompt, Date.now());
      newEntries.push(t);
    }
  }
  for (const t of newEntries) {
    const row = db.prepare(`SELECT id FROM game_assets WHERE game_id = ? AND file = ?`).get(gameId, t.file);
    setAssetStatus(row.id, 'generating');
    log(`[asset] generating ${t.file}`);
    try {
      const out = path.join(cwd, t.file);
      await fs.mkdir(path.dirname(out), { recursive: true });
      await generateImage({ prompt: t.prompt, outputPath: out, apiKey });
      setAssetStatus(row.id, 'ready');
      log(`[asset] ready ${t.file}`);
    } catch (err) {
      setAssetStatus(row.id, 'failed', String(err?.message ?? err));
      log(`[asset] failed ${t.file}: ${err?.message ?? err}`);
    }
  }
}

async function syncMeshes(gameId, cwd, log) {
  const { meshes } = await readManifest(cwd);
  for (const m of meshes) {
    if (!m?.file) continue;
    const exists = db
      .prepare(`SELECT id FROM game_assets WHERE game_id = ? AND file = ?`)
      .get(gameId, m.file);
    const fileExists = await fs.access(path.join(cwd, m.file)).then(() => true).catch(() => false);
    const status = fileExists ? 'ready' : 'failed';
    if (!exists) {
      db.prepare(
        `INSERT INTO game_assets (game_id, type, file, prompt, status, updated_at) VALUES (?, 'mesh', ?, ?, ?, ?)`,
      ).run(gameId, m.file, m.prompt ?? '', status, Date.now());
      log(`[mesh] registered ${m.file} (${status})`);
    } else {
      db.prepare(`UPDATE game_assets SET prompt = ?, status = ?, updated_at = ? WHERE id = ?`)
        .run(m.prompt ?? '', status, Date.now(), exists.id);
    }
  }
}

export async function handleCreateGame({ gameId, description }, { log }) {
  const cwd = gameDir(gameId);
  await fs.mkdir(cwd, { recursive: true });
  await git.ensureRepo(cwd);
  log(`[create] running agent`);
  const agentLog = await runAgent({ cwd, type: 'create', description });
  log(agentLog);
  // Verify the agent actually produced a game.
  const built = await fs.access(path.join(cwd, 'game.html')).then(() => true).catch(() => false);
  if (!built) throw new Error('The agent did not produce a game. Try a different description.');
  await syncMeshes(gameId, cwd, log);
  await syncAndGenerateTextures(gameId, cwd, log);
  const commitHash = await git.commitAll(cwd, `Initial: ${description.slice(0, 80)}`);
  return { commitHash };
}

export async function handleModify({ gameId, description }, { log }) {
  const cwd = gameDir(gameId);
  await git.ensureRepo(cwd);
  log(`[modify] running agent`);
  const agentLog = await runAgent({ cwd, type: 'modify', description });
  log(agentLog);
  await syncMeshes(gameId, cwd, log);
  await syncAndGenerateTextures(gameId, cwd, log);
  const commitHash = await git.commitAll(cwd, description.slice(0, 80));
  return { commitHash };
}

export async function handleRefineTexture({ gameId, assetId, refinement }, { log }) {
  const cwd = gameDir(gameId);
  const asset = db.prepare(`SELECT * FROM game_assets WHERE id = ?`).get(assetId);
  if (!asset) throw new Error(`Asset ${assetId} not found`);
  await git.ensureRepo(cwd);

  log(`[refine] merging existing prompt with refinement`);
  const newPrompt = await refinePrompt(asset.prompt ?? '', refinement);
  if (!newPrompt) throw new Error('Refinement produced empty prompt');
  log(`[refine] new prompt: ${newPrompt.slice(0, 300)}${newPrompt.length > 300 ? '…' : ''}`);

  db.prepare(`UPDATE game_assets SET prompt = ?, status = 'generating', updated_at = ? WHERE id = ?`)
    .run(newPrompt, Date.now(), assetId);

  const manifest = await readManifest(cwd);
  const idx = manifest.textures.findIndex((t) => t.file === asset.file);
  if (idx >= 0) manifest.textures[idx].prompt = newPrompt;
  else manifest.textures.push({ file: asset.file, prompt: newPrompt });
  await writeManifest(cwd, manifest);

  log(`[refine] generating ${asset.file}`);
  try {
    const out = path.join(cwd, asset.file);
    await fs.mkdir(path.dirname(out), { recursive: true });
    await generateImage({ prompt: newPrompt, outputPath: out, apiKey: process.env.OPENAI_API_KEY });
    setAssetStatus(assetId, 'ready');
  } catch (err) {
    setAssetStatus(assetId, 'failed', String(err?.message ?? err));
    throw err;
  }

  const commitHash = await git.commitAll(cwd, `Refined ${asset.file}`);
  return { commitHash };
}

export async function handleRefineMesh({ gameId, assetId, refinement }, { log }) {
  const cwd = gameDir(gameId);
  const asset = db.prepare(`SELECT * FROM game_assets WHERE id = ? AND type = 'mesh'`).get(assetId);
  if (!asset) throw new Error(`Mesh asset ${assetId} not found`);
  await git.ensureRepo(cwd);

  setAssetStatus(assetId, 'generating');
  log(`[refine-mesh] running agent on ${asset.file}`);
  const agentLog = await runAgent({
    cwd,
    type: 'refine-mesh',
    description: refinement,
    payload: { file: asset.file, existingPrompt: asset.prompt ?? '', refinement },
  });
  log(agentLog);

  await syncMeshes(gameId, cwd, log);
  await syncAndGenerateTextures(gameId, cwd, log);
  const commitHash = await git.commitAll(cwd, `Refined ${asset.file}`);
  return { commitHash };
}

export async function handleRevert({ gameId, hash }, { log }) {
  const cwd = gameDir(gameId);
  log(`[revert] ${hash}`);
  const newHash = await git.revert(cwd, hash);

  const manifest = await readManifest(cwd);
  const currentFiles = new Set([
    ...manifest.textures.map((t) => t.file),
    ...manifest.meshes.map((m) => m.file),
  ]);
  for (const r of db.prepare(`SELECT id, file FROM game_assets WHERE game_id = ?`).all(gameId)) {
    if (!currentFiles.has(r.file)) {
      db.prepare(`DELETE FROM game_assets WHERE id = ?`).run(r.id);
    }
  }
  for (const t of manifest.textures) {
    const existing = db.prepare(`SELECT id FROM game_assets WHERE game_id = ? AND file = ?`).get(gameId, t.file);
    if (!existing) {
      db.prepare(
        `INSERT INTO game_assets (game_id, type, file, prompt, status, updated_at) VALUES (?, 'texture', ?, ?, 'ready', ?)`,
      ).run(gameId, t.file, t.prompt, Date.now());
    } else {
      db.prepare(`UPDATE game_assets SET prompt = ?, status = 'ready', updated_at = ? WHERE id = ?`)
        .run(t.prompt, Date.now(), existing.id);
    }
  }
  await syncMeshes(gameId, cwd, log);

  return { commitHash: newHash };
}

export async function readMeshAssoc(gameId) {
  const cwd = gameDir(gameId);
  const { meshes } = await readManifest(cwd);
  const map = new Map();
  for (const m of meshes) map.set(m.file, m.textures ?? []);
  return map;
}
