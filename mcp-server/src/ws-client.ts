import WebSocket from 'ws';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class WebSocketClient {
	private ws: WebSocket | null = null;
	private readonly url: string;
	private isConnected: boolean = false;
	private reconnectInterval: number = 3000;
	private genAI: GoogleGenerativeAI | null = null;
	private model: any = null;
	private scheduledTimeouts: NodeJS.Timeout[] = [];
	private currentInstrument: string = 'piano';
	private currentRoomId: string | null = null;

	constructor(url: string = process.env.WS_URL || 'ws://localhost:3000/ws') {
		this.url = url;
		const apiKey = process.env.GEMINI_API_KEY;
		if (apiKey) {
			this.genAI = new GoogleGenerativeAI(apiKey);
			this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
		} else {
			console.warn('GEMINI_API_KEY not found. AI features will be limited.');
		}
		this.connect();
	}

	private connect() {
		this.ws = new WebSocket(this.url);

		this.ws.on('open', () => {
			console.log('Connected to SvelteKit WebSocket');
			this.isConnected = true;
			// Handshake as Gemini-AI
			this.joinRoom('lobby');
		});

		this.ws.on('message', (data: any) => {
			try {
				const message = JSON.parse(data.toString());
				if (message.type === 'summon-ai') {
					const roomId = message.payload.roomId;
					console.log(`Received summon request for room: ${roomId}`);
					this.clearScheduledNotes();
					this.currentInstrument = 'piano'; // Reset instrument on new summon
					this.currentRoomId = roomId;
					this.joinRoom(roomId);
				} else if (message.type === 'dismiss-ai') {
					const roomId = message.payload.roomId;
					console.log(`Received dismiss request for room: ${roomId}`);
					if (this.currentRoomId === roomId) {
						this.clearScheduledNotes();
						this.currentInstrument = 'piano';
						this.currentRoomId = null;
						this.joinRoom('lobby');
					}
				} else if (message.type === 'chat-message') {
					const { message: chatText, from, nickname, roomId } = message.payload;
					console.log(`Received chat from ${nickname} (${from}): ${chatText}`);

					// Ignore messages if not in the same room (though socket join should handle this, safety check)
					if (this.currentRoomId && roomId && this.currentRoomId !== roomId) return;

					if (nickname === 'Gemini-AI') return;

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
					} else {
						console.log('Gemini API not configured, ignoring chat.');
					}
				}
			} catch (e) {
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

	private clearScheduledNotes() {
		this.scheduledTimeouts.forEach((t) => clearTimeout(t));
		this.scheduledTimeouts = [];
	}

	send(data: any) {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(data));
		} else {
			console.warn('WebSocket not connected, cannot send message');
		}
	}

	joinRoom(roomId: string) {
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

	private playNote(note: string, duration: string = '4n', instrument: string = 'piano') {
		this.send({
			type: 'ai-play-note',
			payload: {
				instrument: instrument,
				note: note,
				duration: duration
			}
		});
	}

	private sendInstrumentChange(instrument: string) {
		this.send({
			type: 'instrument-change',
			payload: {
				userId: 'Gemini-AI',
				instrument: instrument
			}
		});
	}

	private async handleGeminiChat(prompt: string) {
		try {
			const systemPrompt = `
あなたはAIミュージシャンです。自然言語のリクエストや楽譜データを受けて音楽を演奏します。
現在の楽器: ${this.currentInstrument}

以下のJSON形式のみを出力してください。Markdownのコードブロックは不要です。

重要ルール（絶対遵守）:
1. **楽器の変更**:
   - ユーザーから「この後もずっとこの楽器で」といった指示がある場合、\`keepInstrument: true\` にしてください。
   - 指示がない場合、今回だけ変更して次回はデフォルト(piano)に戻るため、\`keepInstrument: false\` (または省略) にしてください。
   - 楽器名は英語で指定 (例: piano, guitar-acoustic, violin, synth-lead 等)。
2. **コードの展開**:
   - コード名は必ず構成音に展開してください。
   - **M7, m7, 7, dim7** などの指定がある場合は、必ず **4和音（4つの音）** にしてください。省略してはいけません。
   - 異名同音に注意してください (例: Cb = B)。"Cb" と書かれていたら Bメジャー (B, D#, F#) または Cbメジャー (Cb, Eb, Gb) の音を出してください。Bb (A#) ではありません。
3. **時間とタイミング**:
   - 楽譜に「秒数」や「拍数」がある場合、その値を **duration** に反映してください (例: "1.455s")。
   - **time** は「前の和音からの待機時間」です。
     - 1つ目の和音: time = 0
     - 2つ目の和音: time = 1つ目の和音の長さ(ms)
     - 3つ目の和音: time = 2つ目の和音の長さ(ms)
   - 和音の中の構成音（2つ目以降）は、**time = 0** にして同時に鳴らしてください。
4. **音名表記**: 必ず「科学的ピッチ表記法」 (例: C4, D#5) で指定してください。

出力フォーマット:
{
  "text": "短い返答（日本語で20文字以内）",
  "instrument": "使用する楽器名 (省略可, デフォルトは現在の楽器)",
  "keepInstrument": true/false,
  "notes": [
    {
      "note": "音名 (例: C4, D#5)",
      "duration": "音価 (例: '1.455s', '2n')",
      "time": "前のイベントからの待機時間(ms)。和音の構成音は0。"
    }
  ]
}

例: 表データ "C (2.0s) -> G (2.0s) -> Am7 (2.0s)" の場合
{
  "text": "はい、演奏します。",
  "notes": [
    // C (2.0s)
    {"note": "C4", "duration": "2.0s", "time": 0}, {"note": "E4", "duration": "2.0s", "time": 0}, {"note": "G4", "duration": "2.0s", "time": 0},
    // G (2.0s) - 前のCから2000ms後
    {"note": "G3", "duration": "2.0s", "time": 2000}, {"note": "B3", "duration": "2.0s", "time": 0}, {"note": "D4", "duration": "2.0s", "time": 0},
    // Am7 (2.0s) - 前のGから2000ms後. 7thを含む4和音
    {"note": "A3", "duration": "2.0s", "time": 2000}, {"note": "C4", "duration": "2.0s", "time": 0}, {"note": "E4", "duration": "2.0s", "time": 0}, {"note": "G4", "duration": "2.0s", "time": 0}
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
						} else {
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
							const t = setTimeout(
								() => {
									this.playNote(n.note, n.duration, playInstrument);
								},
								currentTime + (n.time || 0)
							);
							this.scheduledTimeouts.push(t);
							currentTime += n.time || 0;

							// Estimate duration in ms (rough approximation for '4n' etc if needed, but assuming s/ms for now or standard Tone.js)
							// For simplicity in server-side timeout, we might need a helper or just assume a safe buffer.
							// Since we don't have Tone.js here, we rely on the fact that 'time' is in ms.
							// Duration is tricky. Let's assume a minimum or try to parse 's'.
							let durationMs = 500; // default
							if (n.duration.endsWith('s')) {
								durationMs = parseFloat(n.duration) * 1000;
							} else if (n.duration === '4n') durationMs = 500;
							else if (n.duration === '2n') durationMs = 1000;
							else if (n.duration === '1n') durationMs = 2000;
							else if (n.duration === '8n') durationMs = 250;

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
				} catch (e) {
					console.error('Failed to parse extracted JSON:', jsonStr, e);
				}
			} else {
				console.log('Could not parse JSON from Gemini response:', text);
			}
		} catch (e) {
			console.error('Error calling Gemini API:', e);
		}
	}
}
