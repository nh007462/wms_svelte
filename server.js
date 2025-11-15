// server.js
import { handler } from './build/handler.js'; // SvelteKitのビルド結果
import express from 'express';
import { createServer } from 'http';
import { setupWebSocket } from './src/lib/server/signaling.js'; // シグナリングサーバー

const app = express();
const server = createServer(app);
const port = process.env.PORT || 3000;

// ★ 1. WebSocketサーバーをHTTPサーバーにアタッチ
setupWebSocket(server);

// ★ 2. SvelteKitのハンドラをExpressのミドルウェアとして使用
//    (WebSocket以外のすべてのリクエストをSvelteKitが処理する)
app.use(handler);

server.listen(port, () => {
  console.log(`Production server with WebSocket listening on http://localhost:${port}`);
});