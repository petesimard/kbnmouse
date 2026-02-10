import { WebSocketServer } from 'ws';

// Track connected clients
const clients = new Set();

export function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`Client connected. Total clients: ${clients.size}`);

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`Client disconnected. Total clients: ${clients.size}`);
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
      clients.delete(ws);
    });
  });

  return wss;
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

// Broadcast that a message was marked as read
export function broadcastMessageRead(messageId, recipientProfileId) {
  const payload = JSON.stringify({ type: 'message_read', message_id: messageId, recipient_profile_id: recipientProfileId });
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}
