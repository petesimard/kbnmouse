import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';

const run = promisify(execFile);
const SEP = '|~|';

async function git(cwd, ...args) {
  const { stdout } = await run('git', args, { cwd, maxBuffer: 16 * 1024 * 1024 });
  return stdout;
}

// True only when the directory has its OWN repo (not one inherited from a
// parent like the root project repo).
function hasOwnRepo(cwd) {
  return existsSync(join(cwd, '.git'));
}

export async function init(cwd) {
  await git(cwd, 'init', '-q', '-b', 'main');
  await git(cwd, 'config', 'user.email', 'gamegen@local');
  await git(cwd, 'config', 'user.name', 'GameGen');
  await git(cwd, 'commit', '--allow-empty', '-m', 'Repository initialized');
}

// Initialize a per-game repo if one doesn't already exist in this directory.
// Without this, git commands in a repo-less game dir would walk up and operate
// on the root project repo. Capturing existing files in the initial commit.
export async function ensureRepo(cwd) {
  if (hasOwnRepo(cwd)) return;
  await git(cwd, 'init', '-q', '-b', 'main');
  await git(cwd, 'config', 'user.email', 'gamegen@local');
  await git(cwd, 'config', 'user.name', 'GameGen');
  await git(cwd, 'add', '-A');
  await git(cwd, 'commit', '--allow-empty', '-m', 'Repository initialized');
}

export async function commitAll(cwd, message) {
  await ensureRepo(cwd);
  await git(cwd, 'add', '-A');
  const status = await git(cwd, 'status', '--porcelain');
  if (!status.trim()) return null;
  await git(cwd, 'commit', '-m', message);
  return (await git(cwd, 'rev-parse', 'HEAD')).trim();
}

export async function log(cwd, limit = 50) {
  if (!hasOwnRepo(cwd)) return [];
  const out = await git(
    cwd,
    'log',
    `--pretty=format:%H${SEP}%at${SEP}%s`,
    '-n', String(limit),
  );
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, at, subject] = line.split(SEP);
      return { hash, at: Number(at) * 1000, subject };
    });
}

export async function revert(cwd, hash) {
  if (!hasOwnRepo(cwd)) throw new Error('This game has no change history to revert');
  await git(cwd, 'revert', '--no-edit', hash);
  return (await git(cwd, 'rev-parse', 'HEAD')).trim();
}
