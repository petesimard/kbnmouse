import { query } from '@anthropic-ai/claude-agent-sdk';
import { access, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', '..', 'data', 'games');

function buildSystemPrompt(gameDir) {
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
- Write all files to ${gameDir} using absolute paths
- The game should be self-contained and require no build step
- Test your HTML by reading it back to verify correctness
- Make sure the game loop runs smoothly`;
}

async function runClaude(prompt, cwd, systemPrompt) {
  console.log(`[GameAgent] Running in ${cwd}`);
  console.log(`[GameAgent] Prompt: ${prompt.substring(0, 200)}...`);

  let resultText = '';
  let wroteFiles = false;

  for await (const message of query({
    prompt,
    options: {
      cwd,
      systemPrompt,
      allowedTools: ['Write', 'Edit', 'Read', 'Bash', 'Glob'],
      maxTurns: 30,
      permissionMode: 'bypassPermissions',
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

export async function generateGame(gameId, prompt) {
  const gameDir = join(dataDir, String(gameId));
  await mkdir(gameDir, { recursive: true });

  const systemPrompt = buildSystemPrompt(gameDir);

  const userPrompt = `Create a Three.js game based on this description: ${prompt}

Write all game files to ${gameDir}. The main file must be named index.html (i.e. ${gameDir}/index.html).`;

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

export async function updateGame(gameId, prompt) {
  const gameDir = join(dataDir, String(gameId));
  await mkdir(gameDir, { recursive: true });

  const systemPrompt = buildSystemPrompt(gameDir);

  const userPrompt = `Update the existing Three.js game in ${gameDir} based on this request: ${prompt}

Read the existing files first to understand the current game, then make the requested changes. Keep the game working and fun.`;

  const { resultText, wroteFiles } = await runClaude(userPrompt, gameDir, systemPrompt);

  if (!wroteFiles) {
    throw new Error(resultText || 'The agent declined to update the game.');
  }
}
