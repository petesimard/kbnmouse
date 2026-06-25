import { query } from '@anthropic-ai/claude-agent-sdk';
import { resolve } from 'path';

const SYSTEM = `You are a ThreeJS game author for a kids' game generator.

You are working inside a game's directory. Produce or edit the following files:

== game.html ==
ONE self-contained HTML file containing a Three.js game. Always include this importmap so 'three' resolves both inside the game and inside our mesh-preview iframes:
  <script type="importmap">{ "imports": { "three": "https://unpkg.com/three@0.160.0/build/three.module.js", "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/" } }</script>
The module script does \`import * as THREE from 'three'\`. The game MUST fill the viewport, use requestAnimationFrame, handle window resize, and work on desktop (keyboard/mouse) and touch where practical. Keep controls simple for kids.

The game uses textures AND mesh modules. Load each mesh via dynamic import:
  const tree = await import('./meshes/tree.js'); scene.add(tree.build(textures));
where \`textures\` is an object map { 'textures/<file>.png': THREE.Texture } populated from manifest.

== meshes/<name>.js ==
A real procedural Three.js mesh module — NOT just a single textured cube. Compose multiple primitives (BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, ExtrudeGeometry, LatheGeometry, TorusGeometry, BufferGeometry, etc.) into a recognizable shape. Examples: a tree = trunk cylinder + foliage cones; a duck = body sphere + head sphere + beak cone; a water gun = handle box + barrel cylinder + trigger box. Apply textures only where they make visual sense (bark on trunk, leaves on foliage). Use materials like MeshStandardMaterial.

Module shape (exact):
  import * as THREE from 'three';
  export function build(textures) {
    const group = new THREE.Group();
    // ... construct geometry ...
    return group; // or a single THREE.Mesh
  }

The build function MUST be synchronous and pure — no DOM, no fetches, no top-level side effects.

== manifest.json ==
A JSON object of EXACTLY this shape:
  {
    "textures": [
      { "file": "textures/<name>.png", "prompt": "<detailed image-gen prompt>" }
    ],
    "meshes": [
      {
        "file": "meshes/<name>.js",
        "prompt": "<short description of what this mesh represents and its style>",
        "textures": ["textures/<name>.png", ...]
      }
    ]
  }
List EVERY texture and mesh referenced by game.html. The "textures" field on a mesh entry must list every texture file that mesh's build() reads from the textures map.

Rules:
  - Use ACTUAL composed meshes for non-trivial visible objects (characters, props, weapons, vehicles, plants). Reserve raw primitives for ground planes, skyboxes, and abstract UI.
  - Generate textures for EVERYTHING visual — skyboxes, ground, walls, character skins, mesh surfaces, item icons, UI. Prefer many textures.
  - Texture prompts must be detailed and kid-friendly (bright, colorful, playful, no scary imagery).
  - Use \`import * as THREE from 'three'\` in mesh modules (not absolute URLs); the importmap handles resolution everywhere.
  - File paths in manifest must be relative: textures under "textures/", meshes under "meshes/".
  - Do not modify existing manifest.json entries unless the user explicitly asks. You may add new entries.
  - Do not reference external asset URLs other than the three.js CDN import.
  - Do not create sub-directories other than "textures/" and "meshes/".
  - Output only file edits. Your conversational response is not shown to the user.`;

const CREATE_PROMPT = (desc) => `Create a new kids' ThreeJS game described as:

"""
${desc}
"""

Write game.html, manifest.json, and one or more mesh modules under meshes/. Compose real meshes for any non-trivial visible object — players, enemies, props, weapons, plants, vehicles. Generate plenty of textures.`;

const MODIFY_PROMPT = (desc) => `The user wants to modify this game with:

"""
${desc}
"""

Edit game.html. Add new mesh modules under meshes/ and new texture entries to manifest.json as needed. Do not change existing manifest.json entries.`;

const REFINE_MESH_PROMPT = ({ file, existingPrompt, refinement }) => `Refine the procedural Three.js mesh module at \`${file}\`.

EXISTING DESCRIPTION OF THIS MESH:
"""
${existingPrompt || '(none)'}
"""

USER REFINEMENT:
"""
${refinement}
"""

Rewrite ${file} so build(textures) produces a mesh that integrates the refinement while preserving the strong points of the original design. If new textures would help (e.g., new patterns), append entries to manifest.json AND update the mesh's "textures" array in manifest.json. Update the mesh entry's "prompt" field in manifest.json to the new combined description. Do not modify other meshes or game.html unless strictly required.`;

// Restrict every file operation to the game directory.
function createToolGuard(allowedDir) {
  const resolvedDir = resolve(allowedDir);
  return async (toolName, input) => {
    const filePath = input.file_path || input.path;
    if (filePath) {
      const r = resolve(resolvedDir, String(filePath));
      if (r !== resolvedDir && !r.startsWith(resolvedDir + '/')) {
        return { behavior: 'deny', message: 'Access denied: path is outside the game directory' };
      }
    }
    return { behavior: 'allow' };
  };
}

export async function runAgent({ cwd, type, description, payload }) {
  let prompt;
  if (type === 'create') prompt = CREATE_PROMPT(description);
  else if (type === 'refine-mesh') prompt = REFINE_MESH_PROMPT(payload);
  else prompt = MODIFY_PROMPT(description);

  const q = query({
    prompt,
    options: {
      cwd,
      systemPrompt: { type: 'preset', preset: 'claude_code', append: SYSTEM },
      allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep'],
      disallowedTools: ['Bash', 'Task', 'TodoWrite'],
      model: 'claude-sonnet-4-6',
      permissionMode: 'dontAsk',
      canUseTool: createToolGuard(cwd),
      maxTurns: 40,
    },
  });

  const log = [];
  for await (const msg of q) {
    if (msg.type === 'assistant' && msg.message?.content) {
      for (const block of msg.message.content) {
        if (block.type === 'text' && block.text) log.push(`[assistant] ${block.text}`);
        else if (block.type === 'tool_use') log.push(`[tool_use] ${block.name} ${JSON.stringify(block.input).slice(0, 400)}`);
      }
    } else if (msg.type === 'user' && Array.isArray(msg.message?.content)) {
      for (const block of msg.message.content) {
        if (block.type === 'tool_result') {
          const txt = typeof block.content === 'string'
            ? block.content
            : Array.isArray(block.content)
              ? block.content.map((c) => c.text ?? '').join('')
              : '';
          log.push(`[tool_result] ${txt.slice(0, 400)}`);
        }
      }
    } else if (msg.type === 'result') {
      log.push(`[result] ${msg.subtype ?? ''} ${msg.is_error ? 'ERROR' : 'OK'}`);
      if (msg.is_error && msg.result) log.push(`[error] ${msg.result}`);
    }
  }

  return log.join('\n');
}

const REFINE_SYSTEM = `You are a prompt editor for an image-generation pipeline.
You receive an EXISTING image-gen prompt and a USER REFINEMENT request.
Produce a single revised image-gen prompt that integrates the refinement while
preserving the good details from the original (style, framing, kid-friendly tone, seamless/tileable constraints, etc.).
Output ONLY the new prompt as plain text — no quotes, no preamble, no commentary, no markdown.`;

export async function refinePrompt(existing, refinement) {
  const userMsg = `EXISTING PROMPT:
"""
${existing || '(no existing prompt)'}
"""

USER REFINEMENT:
"""
${refinement}
"""`;

  const q = query({
    prompt: userMsg,
    options: {
      systemPrompt: REFINE_SYSTEM,
      allowedTools: [],
      model: 'claude-sonnet-4-6',
      permissionMode: 'dontAsk',
    },
  });

  let text = '';
  for await (const msg of q) {
    if (msg.type === 'assistant' && msg.message?.content) {
      for (const block of msg.message.content) {
        if (block.type === 'text' && block.text) text += block.text;
      }
    }
  }
  return text.trim();
}
