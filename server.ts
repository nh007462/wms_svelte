// server.ts
import { handler } from './build/handler.js';
import express from 'express';
import { createServer } from 'http';
// TypeScriptファイル(.ts)を拡張子なしでインポート
import { setupWebSocket } from './src/lib/server/signaling'; 

const app = express();
const server = createServer(app);
const port = process.env.PORT || 3000;

setupWebSocket(server);
app.use(handler);

server.listen(port, () => {
  console.log(`Production server with WebSocket listening on http://localhost:${port}`);
});