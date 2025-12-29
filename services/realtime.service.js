const WebSocket = require('ws');

const clients = new Map();
let wss;

exports.init = (server) => {
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    const userId = req.url.split('/').pop();
    clients.set(userId, ws);

    console.log(`🔌 WebSocket connected: ${userId}`);

    ws.on('close', () => {
      clients.delete(userId);
      console.log(`🔌 WebSocket disconnected: ${userId}`);
    });
  });
};

exports.sendToUser = (userId, payload) => {
  const client = clients.get(userId.toString());
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(payload));
  }
};
