import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const claudeBin = join(__dirname, '..', '..', '..', 'node_modules', '.bin', 'claude');

const args = [
  '--print',
  '--dangerously-skip-permissions',
  '--allowedTools', 'Write,Edit,Read,Bash,Glob',
  '--max-budget-usd', '1',
  'Create a simple index.html that says Hello World in big red text',
];

console.log('Binary:', claudeBin);
console.log('Args:', args);
console.log('CWD:', __dirname);
console.log('Spawning...');

const child = spawn(claudeBin, args, {
  cwd: __dirname,
  env: { ...process.env, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' },
});

child.stdin.end();

console.log('PID:', child.pid);

child.stdout.on('data', (d) => console.log('[stdout]', d.toString()));
child.stderr.on('data', (d) => console.error('[stderr]', d.toString()));
child.on('close', (code) => console.log('[close] exit code:', code));
child.on('error', (err) => console.error('[error]', err.message));
