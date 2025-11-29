# AI Musician MCP Server

このMCPサーバーは、LLMがWebRTC音楽セッションアプリを操作できるようにするためのものです。

## 前提条件

- Node.js がインストールされていること
- SvelteKitアプリが `ws://localhost:3000/ws` で起動していること

## セットアップ

1. `npm install`
2. `npm run build`

## 使い方

サーバーを起動します:

```bash
npm start
```

## MCP設定

MCPクライアントの設定ファイル（例: `claude_desktop_config.json`）に以下を追加してください:

```json
{
	"mcpServers": {
		"ai-musician": {
			"command": "node",
			"args": ["C:\\Users\\81905\\Desktop\\wms_svelte\\mcp-server\\dist\\index.js"]
		}
	}
}
```

## ツール (Tools)

- `join_room`: 指定したルームに入室します（セッション/練習に必須）。
- `play_note`: 単音または和音を演奏します。
- `play_sequence`: リズムに合わせて一連の音符を演奏します。

## 利用ガイド

### セッションモード (Session Mode)

1. WebRTCアプリを開き、ルームを作成または入室します（例: `room-1`）。
2. MCPクライアント（AIチャット画面など）から `join_room` ツールを使い、AIを同じルーム（`room-1`）に入室させます。
3. `play_note` や `play_sequence` を使ってAIに演奏させます。

### 練習モード (Practice Mode)

アプリの `/practice` ページ（一人練習モード）はローカル専用のため、AIは操作できません。
AIと一緒に練習する場合は、以下の手順で行ってください:

1. 練習モードではなく、**セッション (Session)** ページへ移動します。
2. プライベートなルーム名（例: `my-practice`）を入力して入室します。
3. MCPクライアントから `join_room` を使い、AIを `my-practice` に入室させます。
4. これで、プライベートな空間でAIと一緒に練習ができます。

## 制限事項

- 無料プラン: 1分間に50リクエストまで
