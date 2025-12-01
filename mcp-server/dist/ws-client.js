"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketClient = void 0;
const ws_1 = __importDefault(require("ws"));
const generative_ai_1 = require("@google/generative-ai");
class WebSocketClient {
    ws = null;
    url;
    isConnected = false;
    reconnectInterval = 3000;
    genAI = null;
    model = null;
    scheduledTimeouts = [];
    currentInstrument = 'piano';
    currentRoomId = null;
    // Rate limiting properties
    minuteRequests = 0;
    dayRequests = 0;
    lastMinuteReset = Date.now();
    lastDayReset = Date.now();
    constructor(url = process.env.WS_URL || 'ws://localhost:5173/ws') {
        this.url = url;
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
            this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
        }
        else {
            console.warn('GEMINI_API_KEY not found. AI features will be limited.');
        }
        this.connect();
    }
    checkRateLimit() {
        const now = Date.now();
        // Reset minute counter if 1 minute has passed
        if (now - this.lastMinuteReset > 60000) {
            this.minuteRequests = 0;
            this.lastMinuteReset = now;
        }
        // Reset day counter if 24 hours have passed
        if (now - this.lastDayReset > 86400000) {
            this.dayRequests = 0;
            this.lastDayReset = now;
        }
        if (this.minuteRequests >= 15) {
            console.warn('Rate limit exceeded: 15 requests per minute.');
            return false;
        }
        if (this.dayRequests >= 1000) {
            console.warn('Rate limit exceeded: 1000 requests per day.');
            return false;
        }
        this.minuteRequests++;
        this.dayRequests++;
        return true;
    }
    connect() {
        this.ws = new ws_1.default(this.url);
        this.ws.on('open', () => {
            console.log('Connected to SvelteKit WebSocket');
            this.isConnected = true;
            // Handshake as Gemini-AI
            this.joinRoom('lobby');
        });
        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                if (message.type === 'summon-ai') {
                    const roomId = message.payload.roomId;
                    console.log(`Received summon request for room: ${roomId}`);
                    this.clearScheduledNotes();
                    this.currentInstrument = 'piano'; // Reset instrument on new summon
                    this.currentRoomId = roomId;
                    this.joinRoom(roomId);
                }
                else if (message.type === 'dismiss-ai') {
                    const roomId = message.payload.roomId;
                    console.log(`Received dismiss request for room: ${roomId}`);
                    if (this.currentRoomId === roomId) {
                        this.clearScheduledNotes();
                        this.currentInstrument = 'piano';
                        this.currentRoomId = null;
                        this.joinRoom('lobby');
                    }
                }
                else if (message.type === 'chat-message') {
                    const { message: chatText, from, nickname, roomId } = message.payload;
                    console.log(`Received chat from ${nickname} (${from}): ${chatText}`);
                    // Ignore messages if not in the same room (though socket join should handle this, safety check)
                    if (this.currentRoomId && roomId && this.currentRoomId !== roomId)
                        return;
                    if (nickname === 'Gemini-AI')
                        return;
                    // 1. Simple command parsing
                    if (chatText.toLowerCase().startsWith('play ')) {
                        const note = chatText.split(' ')[1];
                        if (note) {
                            this.playNote(note, '4n', this.currentInstrument);
                            console.log(`Playing ${note} based on chat command`);
                        }
                    }
                    // 2. Gemini API
                    else if (this.model) {
                        this.handleGeminiChat(chatText);
                    }
                    else {
                        console.log('Gemini API not configured, ignoring chat.');
                    }
                }
            }
            catch (e) {
                console.error('Failed to parse message:', e);
            }
        });
        this.ws.on('close', () => {
            console.log('Disconnected from WebSocket');
            this.isConnected = false;
            this.clearScheduledNotes();
            setTimeout(() => this.connect(), this.reconnectInterval);
        });
        this.ws.on('error', (err) => {
            console.error('WebSocket error:', err);
        });
    }
    clearScheduledNotes() {
        this.scheduledTimeouts.forEach((t) => clearTimeout(t));
        this.scheduledTimeouts = [];
    }
    send(data) {
        if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
        else {
            console.warn('WebSocket not connected, cannot send message');
        }
    }
    joinRoom(roomId) {
        this.send({
            type: 'join-room',
            payload: {
                roomId,
                nickname: 'Gemini-AI',
                instrument: 'piano'
            }
        });
        console.log(`Joined room: ${roomId}`);
    }
    playNote(note, duration = '4n', instrument = 'piano') {
        this.send({
            type: 'ai-play-note',
            payload: {
                instrument: instrument,
                note: note,
                duration: duration
            }
        });
    }
    sendInstrumentChange(instrument) {
        this.send({
            type: 'instrument-change',
            payload: {
                userId: 'Gemini-AI',
                instrument: instrument
            }
        });
    }
    async handleGeminiChat(prompt) {
        if (!this.checkRateLimit()) {
            this.send({
                type: 'chat-message',
                payload: {
                    message: '申し訳ありません。リクエスト制限を超えました。少し待ってから再度お試しください。',
                    from: 'Gemini-AI'
                }
            });
            return;
        }
        try {
            const systemPrompt = `
以下のJSON形式のみを出力してください。Markdownのコードブロックは不要です。

重要ルール（絶対遵守）:
1. **楽器の変更**:
   - ユーザーから「この後もずっとこの楽器で」といった指示がある場合、\`keepInstrument: true\` にしてください。
   - 指示がない場合、今回だけ変更して次回はデフォルト(piano)に戻るため、\`keepInstrument: false\` (または省略) にしてください。
   - 楽器名は英語で指定 (例: piano, guitar-acoustic, violin, synth-lead 等)。
2. **コードの展開**:
   - コード名は必ず構成音に展開してください。
   - **M7, m7, 7, dim7** などの指定がある場合は、必ず **4和音（4つの音）** にしてください。省略してはいけません。
   - 異名同音に注意してください (例: Cb = B)。
3. **時間とタイミング (Humanize)**:
   - \`time\` は「前のイベントからの待機時間(ms)」です。
   - **人間らしい演奏**にするため、和音の構成音であっても、完全に同時(\`time: 0\`)ではなく、**10ms〜30ms程度のわずかなズレ**（ストローク感）を入れてください。
   - 楽譜通りの機械的なタイミングではなく、フレーズの区切りで少し「ため」を作るなど、グルーヴ感を出してください。
4. **音の長さと視認性**:
   - 画面上の鍵盤が光るのを確認できるよう、**最短でも "0.2s" (200ms) 以上** の長さを確保してください。あまりに短い音は視認できません。
   - スタッカートの場合でも "0.2s" 程度は確保してください。
5. **音名表記**:
   - 必ず「科学的ピッチ表記法」 (例: C4, D#5) で指定してください。

出力フォーマット:
{
  "text": "短い返答（日本語で20文字以内）",
  "instrument": "使用する楽器名",
  "keepInstrument": true/false,
  "notes": [
    {
      "note": "音名 (例: C4, D#5)",
      "duration": "音価 (例: '0.5s', '4n')",
      "time": "前のイベントからの待機時間(ms)。和音でも少しズラす(10-30ms)と人間らしくなります。",
      "velocity": "ベロシティ(音の強さ)。0.0〜1.0。アクセントをつける場合は0.8〜1.0、弱拍は0.5〜0.7など。"
    }
  ]
}

例: Cメジャーコードを人間らしく ("ジャラーン"と弾く)
{
  "text": "Cメジャーを弾きます。",
  "notes": [
    {"note": "C4", "duration": "2.0s", "time": 0, "velocity": 0.9},
    {"note": "E4", "duration": "2.0s", "time": 20, "velocity": 0.8}, // 20ms遅らせる
    {"note": "G4", "duration": "2.0s", "time": 20, "velocity": 0.85} // さらに20ms遅らせる
  ]
}

リクエスト: ${JSON.stringify(prompt)}
`;
            const result = await this.model.generateContent(systemPrompt);
            const response = await result.response;
            let text = response.text();
            // Clean up markdown code blocks if present
            text = text.replace(/```json\n?/g, '').replace(/```/g, '');
            // Extract JSON
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonStr = jsonMatch[0];
                try {
                    const data = JSON.parse(jsonStr);
                    // Handle instrument logic
                    let playInstrument = this.currentInstrument;
                    let shouldRevert = false;
                    const previousInstrument = this.currentInstrument;
                    if (data.instrument && data.instrument !== this.currentInstrument) {
                        playInstrument = data.instrument;
                        if (data.keepInstrument) {
                            this.currentInstrument = data.instrument;
                            this.sendInstrumentChange(this.currentInstrument);
                        }
                        else {
                            shouldRevert = true;
                            this.sendInstrumentChange(playInstrument);
                        }
                    }
                    // Send chat response
                    if (data.text) {
                        this.send({
                            type: 'chat-message',
                            payload: {
                                message: data.text,
                                from: 'Gemini-AI'
                            }
                        });
                    }
                    // Play notes
                    if (data.notes && Array.isArray(data.notes)) {
                        console.log('Gemini generated notes:', data.notes);
                        // Send countdown signal
                        this.send({
                            type: 'ai-countdown',
                            payload: { roomId: this.currentRoomId }
                        });
                        let currentTime = 4000; // Delay for countdown (3, 2, 1, GO)
                        let maxEndTime = 4000;
                        for (const n of data.notes) {
                            const t = setTimeout(() => {
                                this.playNote(n.note, n.duration, playInstrument);
                            }, currentTime + (n.time || 0));
                            this.scheduledTimeouts.push(t);
                            currentTime += n.time || 0;
                            // Estimate duration in ms (rough approximation for '4n' etc if needed, but assuming s/ms for now or standard Tone.js)
                            // For simplicity in server-side timeout, we might need a helper or just assume a safe buffer.
                            // Since we don't have Tone.js here, we rely on the fact that 'time' is in ms.
                            // Duration is tricky. Let's assume a minimum or try to parse 's'.
                            let durationMs = 500; // default
                            if (n.duration.endsWith('s')) {
                                durationMs = parseFloat(n.duration) * 1000;
                            }
                            else if (n.duration === '4n')
                                durationMs = 500;
                            else if (n.duration === '2n')
                                durationMs = 1000;
                            else if (n.duration === '1n')
                                durationMs = 2000;
                            else if (n.duration === '8n')
                                durationMs = 250;
                            maxEndTime = Math.max(maxEndTime, currentTime + durationMs);
                        }
                        // Revert instrument if needed
                        if (shouldRevert) {
                            const t = setTimeout(() => {
                                this.sendInstrumentChange(previousInstrument);
                                console.log(`Reverting instrument to ${previousInstrument}`);
                            }, maxEndTime + 500); // Add buffer
                            this.scheduledTimeouts.push(t);
                        }
                    }
                }
                catch (e) {
                    console.error('Failed to parse extracted JSON:', jsonStr, e);
                }
            }
            else {
                console.log('Could not parse JSON from Gemini response:', text);
            }
        }
        catch (e) {
            console.error('Error calling Gemini API:', e);
        }
    }
}
exports.WebSocketClient = WebSocketClient;
