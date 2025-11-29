# Deployment Guide (Raspberry Pi / Linux)

ラズベリーパイやLinuxサーバーでのデプロイ手順です。

## 1. 前提条件

- **Node.js**: v18以上推奨
- **Git**: リポジトリのクローン用

## 2. セットアップ

プロジェクトのディレクトリで以下のコマンドを実行し、依存関係をインストールします。

```bash
# ルートディレクトリの依存関係インストール
npm install

# MCPサーバーの依存関係インストール
cd mcp-server
npm install
cd ..
```

## 3. ビルド

本番用にアプリケーションをビルドします。
※ Windows用の `cmd /c` は不要です。

```bash
# SvelteKitアプリとMCPサーバーの両方をビルド
npm run build:all
```

または個別にビルドする場合:

```bash
npm run build
npm run mcp:build
```

## 4. 起動

### アプリケーションサーバー (SvelteKit + WebSocket)

```bash
npm run start
```

※ ポート3000で起動します (`http://localhost:3000`)。
※ `tsx` を使用して `server.ts` を実行します。

### MCPサーバー

MCPサーバーは通常、Claude Desktopなどのクライアントからサブプロセスとして呼び出されますが、単体で起動確認する場合は以下を実行します。

```bash
npm run mcp:start
```

## 5. 永続化 (オプション)

バックグラウンドで実行し続けるには `pm2` などのプロセス管理ツールの使用をお勧めします。

```bash
# pm2のインストール
sudo npm install -g pm2

# アプリの起動
pm2 start npm --name "ai-musician-app" -- run start
```

## トラブルシューティング

### "cmd not found" エラー

Windows用のコマンド (`cmd /c ...`) をLinuxで実行しようとしています。`cmd /c` を削除して実行してください。

### メモリ不足

ラズベリーパイでビルド中にメモリ不足になる場合は、`NODE_OPTIONS` でメモリ制限を緩和するか、スワップ領域を増やしてください。

```bash
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build:all
```
