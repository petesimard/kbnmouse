import db from '../db.js';

// Per-game serial job queue. Jobs for the same game run one at a time;
// different games run concurrently. In-memory — a restart drops queued work.
const queues = new Map();

export function enqueue(gameId, type, description, handler) {
  const now = Date.now();
  const info = db
    .prepare(
      `INSERT INTO game_jobs (game_id, type, status, description, created_at) VALUES (?, ?, 'queued', ?, ?)`,
    )
    .run(gameId, type, description ?? null, now);
  const jobId = info.lastInsertRowid;

  const prev = queues.get(gameId) ?? Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(() => runJob(jobId, handler));
  queues.set(gameId, next);
  return jobId;
}

async function runJob(jobId, handler) {
  db.prepare(`UPDATE game_jobs SET status = 'running', started_at = ? WHERE id = ?`).run(Date.now(), jobId);
  const logLines = [];
  const log = (line) => {
    logLines.push(line);
    db.prepare(`UPDATE game_jobs SET log = ? WHERE id = ?`).run(logLines.join('\n'), jobId);
  };
  try {
    const result = await handler({ jobId, log });
    const commitHash = result?.commitHash ?? null;
    db.prepare(
      `UPDATE game_jobs SET status = 'done', finished_at = ?, commit_hash = ? WHERE id = ?`,
    ).run(Date.now(), commitHash, jobId);
  } catch (err) {
    const msg = err?.stack || String(err);
    logLines.push(`[fatal] ${msg}`);
    db.prepare(
      `UPDATE game_jobs SET status = 'failed', finished_at = ?, error = ?, log = ? WHERE id = ?`,
    ).run(Date.now(), String(err?.message ?? err), logLines.join('\n'), jobId);
  }
}

export function getActiveJob(gameId) {
  return db
    .prepare(
      `SELECT * FROM game_jobs WHERE game_id = ? AND status IN ('queued','running') ORDER BY id ASC LIMIT 1`,
    )
    .get(gameId);
}

export function listJobs(gameId, limit = 100) {
  return db
    .prepare(`SELECT * FROM game_jobs WHERE game_id = ? ORDER BY id DESC LIMIT ?`)
    .all(gameId, limit);
}

export function getJob(jobId) {
  return db.prepare(`SELECT * FROM game_jobs WHERE id = ?`).get(jobId);
}

export function findJobByCommit(gameId, hash) {
  return db
    .prepare(`SELECT * FROM game_jobs WHERE game_id = ? AND commit_hash = ? LIMIT 1`)
    .get(gameId, hash);
}
