// server.js
// SvelteKitのビルド結果（ハンドラ）をインポート
import { handler } from './build/handler.js';
import express from 'express';
import { createServer } from 'http';
// シグナリングサーバーのロジックをインポート
import { setupWebSocket } from './src/lib/server/signaling.js';

const app = express();
const server = createServer(app);
const port = process.env.PORT || 3000;

// ★ 1. WebSocketサーバーをHTTPサーバーにアタッチ
setupWebSocket(server);

// ★ 2. SvelteKitのハンドラをExpressのミドルウェアとして使用
//    (WebSocket以外のすべてのリクエストをSvelteKitが処理する)
app.use(handler);

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});