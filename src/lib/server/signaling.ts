// src/lib/server/signaling.ts
// import { WebSocketServer, WebSocket } from 'ws';
// import type { IncomingMessage } from 'http';
// import type { Duplex } from 'stream';

// interface UpgradeableServer {
// 	on(
// 		event: 'upgrade',
// 		listener: (request: IncomingMessage, socket: Duplex, head: Buffer) => void
// 	): this;
// }

// interface CustomWebSocket extends WebSocket {
// 	id: string;
// 	roomId?: string;
// 	nickname?: string;
// }
// interface Room {
// 	[socketId: string]: {
// 		ws: CustomWebSocket;
// 		nickname: string;
// 		instrument: string;
// 	};
// }
// const rooms: { [roomId: string]: Room } = {};
// const MAX_USERS_PER_ROOM = 5;

// src/lib/server/signaling.ts
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';

/* 🔧 ここから追加：グローバルスコープに rooms を保持（HMR対応） */
export interface RoomUser {
	ws: WebSocket;
	nickname: string;
	instrument: string;
}

const globalForRooms = globalThis as unknown as {
	rooms?: Record<string, Record<string, RoomUser>>;
};

if (!globalForRooms.rooms) {
	globalForRooms.rooms = {};
}

export const rooms = globalForRooms.rooms;
/* 🔧 ここまで追加 */

/* ✅ 以下は既存のコードを残してOK */
const MAX_USERS_PER_ROOM = 5;

interface UpgradeableServer {
	on(
		event: 'upgrade',
		listener: (request: IncomingMessage, socket: Duplex, head: Buffer) => void
	): this;
}

interface CustomWebSocket extends WebSocket {
	id: string;
	roomId?: string;
	nickname?: string;
}

export function setupWebSocket(server: UpgradeableServer) {
	const wss = new WebSocketServer({ noServer: true });

	server.on('upgrade', (request: IncomingMessage, socket, head) => {
		if (request.url === '/ws') {
			wss.handleUpgrade(request, socket, head, (ws) => {
				wss.emit('connection', ws, request);
			});
		}
	});

	wss.on('connection', (ws: CustomWebSocket) => {
		ws.id = `user-${Math.random().toString(36).substr(2, 9)}`;
		console.log(`Client connected: ${ws.id}`);

		ws.on('message', (message: string) => {
			try {
				const data = JSON.parse(message);
				const { type, payload } = data;
				const roomId = ws.roomId;

				switch (type) {
					case 'join-room': {
						const { roomId, nickname, instrument = 'piano' } = payload;

						// If already in a room, leave it first
						if (ws.roomId && ws.roomId !== roomId) {
							const oldRoomId = ws.roomId;
							if (rooms[oldRoomId] && rooms[oldRoomId][ws.id]) {
								delete rooms[oldRoomId][ws.id];
								console.log(`[Room ${oldRoomId}] User left (switching rooms): ${ws.id}`);

								// Broadcast user-left to old room
								Object.values(rooms[oldRoomId]).forEach((clientData) => {
									if (clientData.ws.readyState === WebSocket.OPEN) {
										clientData.ws.send(
											JSON.stringify({ type: 'user-left', payload: { id: ws.id } })
										);
									}
								});

								if (Object.keys(rooms[oldRoomId]).length === 0) {
									delete rooms[oldRoomId];
								}
							}
						}

						if (!rooms[roomId]) rooms[roomId] = {};
						if (Object.keys(rooms[roomId]).length >= MAX_USERS_PER_ROOM) {
							ws.send(JSON.stringify({ type: 'room-full' }));
							return;
						}

						ws.roomId = roomId;
						rooms[roomId][ws.id] = { ws, nickname, instrument };
						console.log(
							`[Room ${roomId}] User joined: ${nickname} (${ws.id}) - Instrument: ${instrument}`
						);

						const existingUsers = Object.entries(rooms[roomId])
							.filter(([id]) => id !== ws.id)
							.map(([id, clientData]) => ({
								id,
								nickname: clientData.nickname,
								instrument: clientData.instrument
							}));

						ws.send(
							JSON.stringify({ type: 'join-success', payload: { id: ws.id, users: existingUsers } })
						);

						Object.entries(rooms[roomId]).forEach(([id, clientData]) => {
							if (id !== ws.id) {
								clientData.ws.send(
									JSON.stringify({
										type: 'user-joined',
										payload: { id: ws.id, nickname, instrument }
									})
								);
							}
						});
						break;
					}

					case 'signal': {
						const { to, signal } = payload;
						const targetClient = rooms[roomId!]?.[to];
						if (targetClient) {
							const fromNickname = rooms[roomId!][ws.id]?.nickname || 'Unknown';
							targetClient.ws.send(
								JSON.stringify({ type: 'signal', payload: { from: ws.id, fromNickname, signal } })
							);
						}
						break;
					}

					case 'data-channel-message': {
						const { message } = payload;
						if (!rooms[roomId!]) return;

						if (message.type === 'instrumentChange') {
							if (rooms[roomId!][ws.id]) {
								rooms[roomId!][ws.id].instrument = message.instrument;
							}
						}

						Object.entries(rooms[roomId!]).forEach(([id, clientData]) => {
							if (id !== ws.id) {
								clientData.ws.send(
									JSON.stringify({
										type: 'data-channel-message',
										payload: { from: ws.id, message }
									})
								);
							}
						});
						break;
					}

					case 'summon-ai': {
						const targetRoomId = payload.roomId;
						console.log(`Summoning AI to room ${targetRoomId}`);

						// Broadcast to ALL rooms to allow stealing the AI
						Object.values(rooms).forEach((roomClients) => {
							Object.values(roomClients).forEach((clientData) => {
								if (clientData.ws.readyState === WebSocket.OPEN) {
									clientData.ws.send(
										JSON.stringify({
											type: 'summon-ai',
											payload: { roomId: targetRoomId }
										})
									);
								}
							});
						});
						break;
					}

					case 'dismiss-ai': {
						const targetRoomId = payload.roomId;
						console.log(`Dismissing AI from room ${targetRoomId}`);

						// Broadcast to the room so AI (which is in the room) receives it
						const room = rooms[targetRoomId];
						if (room) {
							Object.values(room).forEach((clientData) => {
								if (clientData.ws.readyState === WebSocket.OPEN) {
									clientData.ws.send(
										JSON.stringify({
											type: 'dismiss-ai',
											payload: { roomId: targetRoomId }
										})
									);
								}
							});
						}
						break;
					}

					case 'chat-message': {
						if (!rooms[roomId!]) return;
						const { message } = payload;
						const fromNickname = rooms[roomId!][ws.id]?.nickname || 'Unknown';

						Object.entries(rooms[roomId!]).forEach(([id, clientData]) => {
							if (clientData.ws.readyState === WebSocket.OPEN) {
								clientData.ws.send(
									JSON.stringify({
										type: 'chat-message',
										payload: { from: ws.id, nickname: fromNickname, message }
									})
								);
							}
						});
						break;
					}

					case 'ai-play-note': {
						if (!rooms[roomId!]) return;
						const { note, duration, instrument } = payload;

						Object.values(rooms[roomId!]).forEach((clientData) => {
							if (clientData.ws.readyState === WebSocket.OPEN) {
								clientData.ws.send(
									JSON.stringify({
										type: 'ai-play-note',
										payload: { note, duration, instrument }
									})
								);
							}
						});
						break;
					}

					case 'instrument-change': {
						if (!rooms[roomId!]) return;
						const { instrument } = payload;

						// Update server state
						if (rooms[roomId!][ws.id]) {
							rooms[roomId!][ws.id].instrument = instrument;
						}

						// Broadcast to others
						Object.entries(rooms[roomId!]).forEach(([id, clientData]) => {
							if (id !== ws.id && clientData.ws.readyState === WebSocket.OPEN) {
								clientData.ws.send(
									JSON.stringify({
										type: 'instrument-change',
										payload: { userId: ws.id, instrument }
									})
								);
							}
						});
						break;
					}

					case 'ai-countdown': {
						if (!rooms[roomId!]) return;
						// Broadcast to all clients in the room
						Object.values(rooms[roomId!]).forEach((clientData) => {
							if (clientData.ws.readyState === WebSocket.OPEN) {
								clientData.ws.send(
									JSON.stringify({
										type: 'ai-countdown',
										payload: {}
									})
								);
							}
						});
						break;
					}
				}
			} catch (e) {
				console.error('Failed to process message:', e);
			}
		});

		const cleanup = () => {
			const roomId = ws.roomId;
			if (roomId && rooms[roomId] && rooms[roomId][ws.id]) {
				const nickname = rooms[roomId][ws.id].nickname;
				console.log(`[Room ${roomId}] Client disconnected: ${nickname} (${ws.id})`);
				delete rooms[roomId][ws.id];

				Object.values(rooms[roomId]).forEach((clientData) => {
					clientData.ws.send(JSON.stringify({ type: 'user-left', payload: { id: ws.id } }));
				});

				if (Object.keys(rooms[roomId]).length === 0) {
					delete rooms[roomId];
					console.log(`Room ${roomId} deleted.`);
				}
			} else {
				console.log(`Client disconnected: ${ws.id} (not in a room)`);
			}
		};

		ws.on('close', cleanup);
		ws.on('error', (err) => {
			console.error(`WebSocket error for ${ws.id}:`, err);
			cleanup();
		});
	});

	console.log('WebSocket server is set up.');
}
