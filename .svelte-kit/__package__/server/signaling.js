// src/lib/server/signaling.ts
import { WebSocketServer, WebSocket } from 'ws';
const rooms = {};
const MAX_USERS_PER_ROOM = 5;
export function setupWebSocket(server) {
    const wss = new WebSocketServer({ noServer: true });
    server.on('upgrade', (request, socket, head) => {
        if (request.url === '/ws') {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        }
    });
    wss.on('connection', (ws) => {
        ws.id = `user-${Math.random().toString(36).substr(2, 9)}`;
        console.log(`Client connected: ${ws.id}`);
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                const { type, payload } = data;
                const roomId = ws.roomId;
                switch (type) {
                    case 'join-room': {
                        const { roomId, nickname } = payload;
                        if (!rooms[roomId])
                            rooms[roomId] = {};
                        if (Object.keys(rooms[roomId]).length >= MAX_USERS_PER_ROOM) {
                            ws.send(JSON.stringify({ type: 'room-full' }));
                            return;
                        }
                        ws.roomId = roomId;
                        rooms[roomId][ws.id] = { ws, nickname, instrument: 'piano' };
                        console.log(`[Room ${roomId}] User joined: ${nickname} (${ws.id})`);
                        const existingUsers = Object.entries(rooms[roomId])
                            .filter(([id]) => id !== ws.id)
                            .map(([id, clientData]) => ({ id, nickname: clientData.nickname, instrument: clientData.instrument }));
                        ws.send(JSON.stringify({ type: 'join-success', payload: { id: ws.id, users: existingUsers } }));
                        Object.entries(rooms[roomId]).forEach(([id, clientData]) => {
                            if (id !== ws.id) {
                                clientData.ws.send(JSON.stringify({ type: 'user-joined', payload: { id: ws.id, nickname, instrument: 'piano' } }));
                            }
                        });
                        break;
                    }
                    case 'signal': {
                        const { to, signal } = payload;
                        const targetClient = rooms[roomId]?.[to];
                        if (targetClient) {
                            targetClient.ws.send(JSON.stringify({ type: 'signal', payload: { from: ws.id, fromNickname: rooms[roomId][ws.id].nickname, signal } }));
                        }
                        break;
                    }
                    case 'data-channel-message': {
                        const { message } = payload;
                        if (!rooms[roomId])
                            return;
                        if (message.type === 'instrumentChange') {
                            if (rooms[roomId][ws.id]) {
                                rooms[roomId][ws.id].instrument = message.instrument;
                            }
                        }
                        Object.entries(rooms[roomId]).forEach(([id, clientData]) => {
                            if (id !== ws.id) {
                                clientData.ws.send(JSON.stringify({ type: 'data-channel-message', payload: { from: ws.id, message } }));
                            }
                        });
                        break;
                    }
                }
            }
            catch (e) {
                console.error('Failed to process message:', e);
            }
        });
        const cleanup = () => {
            const roomId = ws.roomId;
            if (roomId && rooms[roomId] && rooms[roomId][ws.id]) {
                const nickname = rooms[roomId][ws.id].nickname;
                console.log(`[Room ${roomId}] Client disconnected: ${nickname} (${ws.id})`);
                delete rooms[roomId][ws.id];
                Object.values(rooms[roomId]).forEach(clientData => {
                    clientData.ws.send(JSON.stringify({ type: 'user-left', payload: { id: ws.id } }));
                });
                if (Object.keys(rooms[roomId]).length === 0) {
                    delete rooms[roomId];
                    console.log(`Room ${roomId} deleted.`);
                }
            }
            else {
                console.log(`Client disconnected: ${ws.id} (not in a room)`);
            }
        };
        ws.on('close', cleanup);
        ws.on('error', (err) => {
            console.error(`WebSocket error for ${ws.id}:`, err);
            cleanup();
        });
    });
    console.log("WebSocket server is set up.");
}
