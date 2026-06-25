import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { setupWebSocket } from './websocket.js';

// Import routes
import profilesRouter from './routes/profiles.js';
import appsRouter from './routes/apps.js';
import challengesRouter from './routes/challenges.js';
import usageRouter from './routes/usage.js';
import settingsRouter from './routes/settings.js';
import chatbotRouter from './routes/chatbot.js';
import imagegenRouter from './routes/imagegen.js';
import foldersRouter from './routes/folders.js';
import uploadsRouter from './routes/uploads.js';
import storywriterRouter from './routes/storywriter.js';
import gamecreatorRouter from './routes/gamecreator.js';
import authRouter from './routes/auth.js';
import pairingRouter from './routes/pairing.js';
import messagesRouter from './routes/messages.js';
import bulletinRouter from './routes/bulletin.js';
import drawingsRouter from './routes/drawings.js';
import speechtotextRouter from './routes/speechtotext.js';
import { requireAnyAuth } from './middleware/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT, 10) || (isProduction ? 80 : 3001);
const distDir = join(__dirname, '..', 'dist');

// Create HTTP server and WebSocket server
const server = createServer(app);
setupWebSocket(server);

app.use(express.json({ limit: '2mb' }));

// Protect all API routes — require either a kiosk token or admin session
// Exempt: auth endpoints (login/register) and pairing endpoints (pre-token)
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/') || req.path.startsWith('/pairing/') || req.path.startsWith('/admin/app-icon/')) {
    return next();
  }
  requireAnyAuth(req, res, next);
});

// Mount all routes (each router defines its full paths)
app.use(authRouter);
app.use(pairingRouter);
app.use(profilesRouter);
app.use(appsRouter);
app.use(challengesRouter);
app.use(usageRouter);
app.use(settingsRouter);
app.use('/api/chatbot', chatbotRouter);
app.use('/api/imagegen', imagegenRouter);
app.use(foldersRouter);
app.use(uploadsRouter);
app.use('/api/storywriter', storywriterRouter);
app.use('/api/games', gamecreatorRouter);
app.use(messagesRouter);
app.use(bulletinRouter);
app.use('/api/drawings', drawingsRouter);
app.use('/api/speechtotext', speechtotextRouter);

// Serve bulletin photos
const photosDir = join(__dirname, '..', 'data', 'bulletin-photos');
app.use('/bulletin-photos', requireAnyAuth, express.static(photosDir));

// Serve static game files at /customgames/:id/
// Public so QR code sharing works without auth
// When ?kiosk=1 is present, inject an overlay Manage button into HTML files
const gamesDir = join(__dirname, '..', 'data', 'games');
const gamesStatic = express.static(gamesDir);
app.use('/customgames', (req, res, next) => {
  if (!req.query.kiosk || !/\.html?$/i.test(req.path)) {
    return gamesStatic(req, res, next);
  }
  const gameId = req.path.split('/')[1];
  const filePath = join(gamesDir, req.path);
  readFile(filePath, 'utf8')
    .then((html) => {
      const backBtn = `<div id="kiosk-back" style="position:fixed;bottom:12px;left:12px;z-index:99999"><button onclick="window.location.href='/game/${gameId}'" style="background:rgba(30,41,59,0.85);color:#e2e8f0;border:1px solid rgba(100,116,139,0.4);padding:6px 14px;border-radius:9999px;font:600 14px/1 system-ui,sans-serif;cursor:pointer;display:flex;align-items:center;gap:6px;backdrop-filter:blur(4px);transition:background 0.2s,transform 0.2s" onmouseover="this.style.background='rgba(30,41,59,0.95)';this.style.transform='scale(1.05)'" onmouseout="this.style.background='rgba(30,41,59,0.85)';this.style.transform='scale(1)'">\u2190 Manage</button></div>`;
      res.type('html').send(html.replace('</body>', backBtn + '</body>'));
    })
    .catch(() => gamesStatic(req, res, next));
}, gamesStatic);

// Public rotating 3D preview of a generated game's procedural mesh module.
// Reads texture associations from the game's manifest.json on disk (no DB/auth),
// then renders the mesh via the same Three.js importmap the game uses.
app.get('/gamepreview/:id', async (req, res) => {
  const { id } = req.params;
  const file = String(req.query.file || '');
  if (!file.startsWith('meshes/') || file.includes('..')) return res.status(400).end();
  let textureFiles = [];
  try {
    const manifest = JSON.parse(await readFile(join(gamesDir, id, 'manifest.json'), 'utf8'));
    const mesh = (manifest.meshes || []).find((m) => m.file === file);
    textureFiles = mesh?.textures ?? [];
  } catch { /* mesh may have no manifest entry yet */ }

  const autoRotate = req.query.spin === '0' ? 'false' : 'true';
  const bg = typeof req.query.bg === 'string' ? req.query.bg : '#eef2f7';

  res.type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"/>
<style>html,body{margin:0;height:100%;background:${bg};overflow:hidden;}canvas{display:block;}#err{position:absolute;inset:8px;font:12px monospace;color:#b91c1c;white-space:pre-wrap;}</style>
<script type="importmap">{"imports":{"three":"https://unpkg.com/three@0.160.0/build/three.module.js","three/addons/":"https://unpkg.com/three@0.160.0/examples/jsm/"}}</script>
</head><body>
<div id="err"></div>
<script type="module">
try {
  const GAME = ${JSON.stringify(id)};
  const FILE = ${JSON.stringify(file)};
  const TEX_FILES = ${JSON.stringify(textureFiles)};
  const AUTO_ROTATE = ${autoRotate};
  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
  const mod = await import('/customgames/' + GAME + '/' + FILE + '?t=' + Date.now());
  const loader = new THREE.TextureLoader();
  const textures = {};
  await Promise.all(TEX_FILES.map((f) => new Promise((resolve) => {
    loader.load('/customgames/' + GAME + '/' + f, (t) => { textures[f] = t; resolve(); }, undefined, () => resolve());
  })));
  const obj = mod.build(textures);
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(5, 10, 7); scene.add(dl);
  scene.add(obj);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3()).length() || 2;
  const center = box.getCenter(new THREE.Vector3());
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.01, 1000);
  camera.position.set(center.x + size * 1.4, center.y + size * 0.8, center.z + size * 1.4);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(devicePixelRatio);
  document.body.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(center); controls.update();
  controls.autoRotate = AUTO_ROTATE; controls.autoRotateSpeed = 1.6;
  function loop() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); }
  loop();
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
} catch (e) {
  document.getElementById('err').textContent = String(e && (e.stack || e.message) || e);
}
</script>
</body></html>`);
});

// In production, serve the built React frontend
if (isProduction && existsSync(distDir)) {
  app.use(express.static(distDir));

  // SPA fallback — serve index.html for any non-API, non-file request
  app.use((req, res) => {
    res.sendFile(join(distDir, 'index.html'));
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`${isProduction ? 'Production' : 'API'} server running at http://0.0.0.0:${PORT}`);
  console.log(`WebSocket server running at ws://0.0.0.0:${PORT}/ws`);
});
