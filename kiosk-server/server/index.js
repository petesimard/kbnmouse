import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';
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

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 3001;

// Create HTTP server and WebSocket server
const server = createServer(app);
setupWebSocket(server);

app.use(express.json({ limit: '2mb' }));

// Mount all routes (each router defines its full paths)
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

// Serve static game files at /customgames/:id/
// When ?kiosk=1 is present, inject an overlay Back button into HTML files
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
      const backBtn = `<div id="kiosk-back" style="position:fixed;bottom:12px;left:12px;z-index:99999"><button onclick="window.location.href='/game/${gameId}'" style="background:rgba(30,41,59,0.85);color:#e2e8f0;border:1px solid rgba(100,116,139,0.4);padding:6px 14px;border-radius:9999px;font:600 14px/1 system-ui,sans-serif;cursor:pointer;display:flex;align-items:center;gap:6px;backdrop-filter:blur(4px);transition:background 0.2s,transform 0.2s" onmouseover="this.style.background='rgba(30,41,59,0.95)';this.style.transform='scale(1.05)'" onmouseout="this.style.background='rgba(30,41,59,0.85)';this.style.transform='scale(1)'">\u2190 Back</button></div>`;
      res.type('html').send(html.replace('</body>', backBtn + '</body>'));
    })
    .catch(() => gamesStatic(req, res, next));
}, gamesStatic);

server.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
  console.log(`WebSocket server running at ws://localhost:${PORT}/ws`);
});
