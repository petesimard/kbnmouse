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

function buildSystemPrompt3D() {
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

function buildSystemPrompt2D() {
  return `You are a game developer creating a fun 2D browser game for kids using PixiJS.

## PixiJS Setup
- Include PixiJS via CDN: <script src="https://cdnjs.cloudflare.com/ajax/libs/pixi.js/8.6.6/pixi.min.js"></script>
- PixiJS 8 exposes everything under the global \`PIXI\` namespace

## PixiJS API Quick Reference
- App init (async):
  \`\`\`js
  const app = new PIXI.Application();
  await app.init({ width: 800, height: 600, background: '#1099bb', resizeTo: window });
  document.body.appendChild(app.canvas);
  \`\`\`
- Display objects: \`new PIXI.Container()\`, \`new PIXI.Sprite(texture)\`, \`new PIXI.AnimatedSprite(textures)\`
- Graphics (shape drawing):
  \`\`\`js
  const g = new PIXI.Graphics();
  g.rect(x, y, w, h).fill(0xff0000);         // rectangle
  g.circle(x, y, radius).fill(0x00ff00);      // circle
  g.moveTo(x1,y1).lineTo(x2,y2).stroke({ width: 2, color: 0xffffff }); // line
  g.roundRect(x, y, w, h, radius).fill(color); // rounded rectangle
  \`\`\`
- Text: \`new PIXI.Text({ text: 'Hello', style: { fontSize: 32, fill: 0xffffff, fontFamily: 'Arial' } })\`
- Positioning: \`obj.x\`, \`obj.y\`, \`obj.rotation\`, \`obj.scale.set(sx, sy)\`, \`obj.anchor.set(0.5)\` (sprites)
- Game loop: \`app.ticker.add((ticker) => { const dt = ticker.deltaTime; /* update logic */ })\`
- Adding to stage: \`app.stage.addChild(obj)\`, \`container.addChild(obj)\`, \`obj.destroy()\`
- Keyboard input: listen to \`window.addEventListener('keydown'/'keyup', e => { ... })\` and track key state in an object
- Mouse/Touch: \`obj.eventMode = 'static'; obj.on('pointerdown', handler)\` or use global \`app.stage.eventMode = 'static'; app.stage.on('pointermove', handler)\`
- Collision detection: manual — use simple AABB or distance checks:
  \`\`\`js
  function hitTest(a, b, radius) { return Math.hypot(a.x - b.x, a.y - b.y) < radius; }
  function boundsOverlap(a, b) { return a.getBounds().intersects(b.getBounds()); }
  \`\`\`
- Screen size: \`app.screen.width\`, \`app.screen.height\`
- Random: \`Math.random() * (max - min) + min\`
- Tween/animation: use ticker-based lerp or simple velocity patterns
- Particles: draw with Graphics in the ticker, or use simple arrays of particle objects

## Requirements
- Create a complete, playable 2D game as a single index.html file (you may also create separate .js files if needed)
- The game must work immediately when index.html is opened in a browser
- Do NOT use any external image/sprite files — draw everything with PIXI.Graphics shapes and PIXI.Text
- Make the game fun, colorful, and kid-friendly (ages 6-12)
- Use bright colors, simple controls (keyboard arrows/WASD and mouse), and clear visual feedback
- Include a simple score or objective system
- Add a title/instructions screen or overlay
- Keep the game simple enough for kids but engaging
- Use async/await for app initialization (PixiJS 8 requires it)

## Style Guidelines
- Use cheerful, bright colors (no dark/scary themes)
- Create simple particle effects with Graphics objects for visual flair
- Use PIXI.Text for UI/HUD elements with clear, large text
- Use the Web Audio API for simple sound effects (beeps/tones) if appropriate

## Important
- Write all files to the current working directory using relative paths (e.g. ./index.html, ./game.js)
- Do NOT use absolute paths — only write files relative to the current directory
- The game should be self-contained and require no build step
- Do NOT reference any image/sprite files — use only PIXI.Graphics shapes and PIXI.Text
- Test your HTML by reading it back to verify correctness
- Make sure the game loop runs smoothly
- PixiJS 8 app init is async — wrap game setup in an async function`;
}

function buildSystemPrompt(gameType) {
  return gameType === '2d' ? buildSystemPrompt2D() : buildSystemPrompt3D();
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
  const engineLabel = gameType === '2d' ? 'PixiJS 2D' : 'Three.js';

  const userPrompt = `Create a ${engineLabel} game based on this description: ${prompt}

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
  const engineLabel = gameType === '2d' ? 'PixiJS 2D' : 'Three.js';

  const userPrompt = `Update the existing ${engineLabel} game based on this request: ${prompt}

Read the existing files in the current directory first to understand the current game, then make the requested changes. Keep the game working and fun.`;

  const { resultText, wroteFiles } = await runClaude(userPrompt, gameDir, systemPrompt);

  if (!wroteFiles) {
    throw new Error(resultText || 'The agent declined to update the game.');
  }
}
