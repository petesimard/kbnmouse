import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
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
app.use('/customgames', express.static(join(__dirname, '..', 'data', 'games')));

server.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
  console.log(`WebSocket server running at ws://localhost:${PORT}/ws`);
});
