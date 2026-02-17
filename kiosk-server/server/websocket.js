import { WebSocketServer } from 'ws';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Track connected clients (browsers/menu views)
const clients = new Set();

// Track connected kiosks: kioskId -> { ws, gitHash }
const kioskConnections = new Map();

// Reverse lookup: ws -> kioskId (for cleanup on disconnect)
const wsToKioskId = new Map();

// Cached server git hash
let cachedServerHash = null;

export function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`Client connected. Total clients: ${clients.size}`);

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        handleWsMessage(ws, msg);
      } catch {}
    });

    ws.on('close', () => {
      clients.delete(ws);
      const kioskId = wsToKioskId.get(ws);
      if (kioskId != null) {
        kioskConnections.delete(kioskId);
        wsToKioskId.delete(ws);
        console.log(`Kiosk ${kioskId} disconnected`);
        // Notify dashboard clients
        broadcastToDashboards({ type: 'kiosk_status_change', kioskId, connected: false });
      }
      console.log(`Client disconnected. Total clients: ${clients.size}`);
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
      clients.delete(ws);
      const kioskId = wsToKioskId.get(ws);
      if (kioskId != null) {
        kioskConnections.delete(kioskId);
        wsToKioskId.delete(ws);
      }
    });
  });

  return wss;
}

function handleWsMessage(ws, msg) {
  if (msg.type === 'identify' && msg.clientType === 'kiosk' && msg.token) {
    // Look up kiosk by token in DB
    const kiosk = db.prepare('SELECT id FROM kiosks WHERE token = ?').get(msg.token);
    if (!kiosk) {
      console.warn('Kiosk WS identify failed: invalid token');
      return;
    }
    const kioskId = kiosk.id;
    kioskConnections.set(kioskId, { ws, gitHash: null });
    wsToKioskId.set(ws, kioskId);
    console.log(`Kiosk ${kioskId} identified via WebSocket`);

    // Immediately request git hash
    ws.send(JSON.stringify({ type: 'get_version' }));

    // Notify dashboard clients
    broadcastToDashboards({ type: 'kiosk_status_change', kioskId, connected: true });
  }

  if (msg.type === 'version_response' && msg.hash) {
    const kioskId = wsToKioskId.get(ws);
    if (kioskId != null) {
      const conn = kioskConnections.get(kioskId);
      if (conn) {
        conn.gitHash = msg.hash;
        console.log(`Kiosk ${kioskId} git hash: ${msg.hash.slice(0, 8)}`);
      }
      // Notify dashboards of updated hash
      broadcastToDashboards({ type: 'kiosk_version', kioskId, gitHash: msg.hash });
    }
  }

  if (msg.type === 'update_status') {
    const kioskId = wsToKioskId.get(ws);
    if (kioskId != null) {
      broadcastToDashboards({
        type: 'kiosk_update_status',
        kioskId,
        status: msg.status,
        error: msg.error || undefined,
      });
    }
  }
}

// Broadcast a message to all non-kiosk clients (dashboard/browser clients)
function broadcastToDashboards(payload) {
  const message = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === 1 && !wsToKioskId.has(client)) {
      client.send(message);
    }
  }
}

// Get connection info for all kiosks
export function getKioskConnectionInfo() {
  const info = new Map();
  for (const [kioskId, conn] of kioskConnections) {
    info.set(kioskId, { connected: true, gitHash: conn.gitHash });
  }
  return info;
}

// Send a message to a specific kiosk
export function sendToKiosk(kioskId, message) {
  const conn = kioskConnections.get(kioskId);
  if (!conn || conn.ws.readyState !== 1) {
    return false;
  }
  conn.ws.send(JSON.stringify(message));
  return true;
}

// Get server's own git hash (cached)
export function getServerGitHash() {
  if (!cachedServerHash) {
    refreshServerGitHash();
  }
  return cachedServerHash;
}

export function refreshServerGitHash() {
  try {
    const repoRoot = path.resolve(__dirname, '..');
    cachedServerHash = execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf-8' }).trim();
  } catch {
    cachedServerHash = null;
  }
  return cachedServerHash;
}

// Broadcast refresh message to all connected clients
export function broadcastRefresh() {
  const message = JSON.stringify({ type: 'refresh' });
  for (const client of clients) {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  }
  console.log(`Broadcast refresh to ${clients.size} clients`);
}

// Broadcast a new message to all connected clients for instant delivery
export function broadcastNewMessage(msg) {
  const payload = JSON.stringify({ type: 'new_message', message: msg });
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}

// Broadcast bulletin board pin update
export function broadcastBulletinPin(action, pin) {
  const payload = JSON.stringify({ type: 'bulletin_pin', action, pin });
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}

// Broadcast that a message was marked as read
export function broadcastMessageRead(messageId, recipientProfileId) {
  const payload = JSON.stringify({ type: 'message_read', message_id: messageId, recipient_profile_id: recipientProfileId });
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}
