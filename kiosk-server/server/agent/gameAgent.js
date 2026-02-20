import { query } from '@anthropic-ai/claude-agent-sdk';
import { access, mkdir } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', '..', 'data', 'games');

const ALLOWED_TOOLS = ['Write', 'Edit', 'Read', 'Glob'];

/**
 * Creates a canUseTool callback that restricts all file operations
 * to the given directory. Denies any path that resolves outside it.
 */
function createToolGuard(allowedDir) {
  const resolvedDir = resolve(allowedDir);

  return async (toolName, input) => {
    // Extract the path from the tool input
    const filePath = input.file_path || input.path;
    if (filePath) {
      const resolved = resolve(resolvedDir, String(filePath));
      if (resolved !== resolvedDir && !resolved.startsWith(resolvedDir + '/')) {
        console.log(`[GameAgent] Blocked ${toolName} outside sandbox: ${filePath}`);
        return { behavior: 'deny', message: 'Access denied: path is outside the game directory' };
      }
    }

    return { behavior: 'allow' };
  };
}

function buildThreeJsSystemPrompt() {
  return `You are a game developer creating a fun Three.js browser game for kids.

## Requirements
- Create a complete, playable Three.js game as a single index.html file (you may also create separate .js and .css files if needed)
- Include Three.js via CDN: <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
- The game must work immediately when index.html is opened in a browser
- Make the game fun, colorful, and kid-friendly (ages 6-12)
- Use bright colors, simple controls (keyboard arrows/WASD and mouse), and clear visual feedback
- Include a simple score or objective system
- Add a title/instructions screen or overlay
- Handle window resizing properly
- Keep the game simple enough for kids but engaging

## Style Guidelines
- Use cheerful, bright colors (no dark/scary themes)
- Add simple particle effects or animations for visual flair
- Use clear, large text for any UI elements
- Include sound effects using the Web Audio API (simple beeps/tones) if appropriate

## Important
- Write all files to the current working directory using relative paths (e.g. ./index.html, ./game.js)
- Do NOT use absolute paths — only write files relative to the current directory
- The game should be self-contained and require no build step
- Test your HTML by reading it back to verify correctness
- Make sure the game loop runs smoothly`;
}

function buildPixiJsSystemPrompt() {
  return `You are a game developer creating a fun PixiJS 2D browser game for kids.

## Requirements
- Create a complete, playable 2D game as a single index.html file (you may also create separate .js and .css files if needed)
- Include PixiJS via CDN: <script src="https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.2/pixi.min.js"></script>
- The game must work immediately when index.html is opened in a browser
- Make the game fun, colorful, and kid-friendly (ages 6-12)
- Use bright colors, simple controls (keyboard arrows/WASD and mouse/touch), and clear visual feedback
- Include a simple score or objective system
- Add a title/instructions screen or overlay
- Handle window resizing properly
- Keep the game simple enough for kids but engaging

## PixiJS Guidelines
- Use PIXI.Application for the main game loop
- Use PIXI.Graphics for drawing shapes, or PIXI.Sprite for sprite-based elements
- Draw game assets programmatically with PIXI.Graphics (circles, rectangles, polygons) — do NOT rely on external image files
- Use PIXI.Text for score displays, titles, and UI text
- Use PIXI.Container to group related game objects
- Handle input via keyboard events and PIXI's built-in pointer/touch events
- Use ticker (app.ticker) for the game loop, not requestAnimationFrame directly

## Style Guidelines
- Use cheerful, bright colors (no dark/scary themes)
- Add simple particle effects or animations for visual flair
- Use clear, large text for any UI elements
- Include sound effects using the Web Audio API (simple beeps/tones) if appropriate

## Important
- Write all files to the current working directory using relative paths (e.g. ./index.html, ./game.js)
- Do NOT use absolute paths — only write files relative to the current directory
- The game should be self-contained and require no build step
- Test your HTML by reading it back to verify correctness
- Make sure the game loop runs smoothly`;
}

function buildSystemPrompt(gameType) {
  return gameType === '2d' ? buildPixiJsSystemPrompt() : buildThreeJsSystemPrompt();
}

async function runClaude(prompt, gameDir, systemPrompt) {
  console.log(`[GameAgent] Running in ${gameDir}`);
  console.log(`[GameAgent] Prompt: ${prompt.substring(0, 200)}...`);

  let resultText = '';
  let wroteFiles = false;

  for await (const message of query({
    prompt,
    options: {
      cwd: gameDir,
      systemPrompt,
      allowedTools: ALLOWED_TOOLS,
      disallowedTools: ['Bash', 'Task', 'TodoWrite'],
      model: 'claude-sonnet-4-6',
      permissionMode: 'dontAsk',
      canUseTool: createToolGuard(gameDir),
      maxTurns: 30,
    },
  })) {
    // Log messages for visibility
    if (message.type === 'assistant' && message.message?.content) {
      for (const block of message.message.content) {
        if (block.type === 'text' && block.text) {
          resultText = block.text;
          for (const line of block.text.split('\n')) {
            if (line.trim()) console.log(`[GameAgent] ${line}`);
          }
        } else if (block.type === 'tool_use') {
          if (block.name === 'Write' || block.name === 'Edit') wroteFiles = true;
          console.log(`[GameAgent] Tool: ${block.name}`);
        }
      }
    } else if (message.type === 'result') {
      if (message.result) resultText = message.result;
      console.log(`[GameAgent] Done. Cost: $${message.total_cost_usd?.toFixed(4) ?? '?'}`);
    }
  }

  return { resultText, wroteFiles };
}

export async function generateGame(gameId, prompt, gameType = '3d') {
  const gameDir = join(dataDir, String(gameId));
  await mkdir(gameDir, { recursive: true });

  const systemPrompt = buildSystemPrompt(gameType);
  const engine = gameType === '2d' ? 'PixiJS' : 'Three.js';

  const userPrompt = `Create a ${engine} game based on this description: ${prompt}

Write all game files to the current directory. The main file must be named index.html.`;

  const { resultText, wroteFiles } = await runClaude(userPrompt, gameDir, systemPrompt);

  // Verify that index.html was actually created
  try {
    await access(join(gameDir, 'index.html'));
  } catch {
    throw new Error(resultText || 'The agent did not produce a game. Try a different description.');
  }

  if (!wroteFiles) {
    throw new Error(resultText || 'The agent did not produce a game. Try a different description.');
  }
}

export async function updateGame(gameId, prompt, gameType = '3d') {
  const gameDir = join(dataDir, String(gameId));
  await mkdir(gameDir, { recursive: true });

  const systemPrompt = buildSystemPrompt(gameType);
  const engine = gameType === '2d' ? 'PixiJS' : 'Three.js';

  const userPrompt = `Update the existing ${engine} game based on this request: ${prompt}

Read the existing files in the current directory first to understand the current game, then make the requested changes. Keep the game working and fun.`;

  const { resultText, wroteFiles } = await runClaude(userPrompt, gameDir, systemPrompt);

  if (!wroteFiles) {
    throw new Error(resultText || 'The agent declined to update the game.');
  }
}
