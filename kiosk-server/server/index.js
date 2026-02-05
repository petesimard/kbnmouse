import express from 'express';
import { createServer } from 'http';
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

const app = express();
const PORT = 3001;

// Create HTTP server and WebSocket server
const server = createServer(app);
setupWebSocket(server);

app.use(express.json());

// Mount all routes (each router defines its full paths)
app.use(profilesRouter);
app.use(appsRouter);
app.use(challengesRouter);
app.use(usageRouter);
app.use(settingsRouter);
app.use('/api/chatbot', chatbotRouter);
app.use('/api/imagegen', imagegenRouter);
app.use(foldersRouter);

server.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
  console.log(`WebSocket server running at ws://localhost:${PORT}/ws`);
});
