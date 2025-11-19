// src/lib/server/signaling.ts
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';

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

interface Room {
	[socketId: string]: {
		ws: CustomWebSocket;
		nickname: string;
		instrument: string;
	};
}
const rooms: { [roomId: string]: Room } = {};
const MAX_USERS_PER_ROOM = 5;

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
