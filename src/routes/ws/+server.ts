import { WebSocketServer } from 'ws';
import type { RequestHandler } from './$types';
import type { SignalMessage, Participant } from '$lib/types/rooms.ts';

let wss: WebSocketServer | null = null;
const rooms = new Map<string, Set<{ id: string; ws: WebSocket; name: string }>>();

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

export const GET: RequestHandler = async ({ request }) => {
  if (!wss) {
    // lazy init
    wss = new WebSocketServer({ noServer: true });

    wss.on('connection', (socket: WebSocket) => {
      const clientId = genId();
      let roomId: string | null = null;
      let name = 'anonymous';

      const send = (obj: unknown) => {
        try {
          socket.send(JSON.stringify(obj));
        } catch (e) {
          // ignore send errors
        }
      };

      socket.onmessage = (ev: MessageEvent) => {
        let msg: SignalMessage;
        try {
          msg = JSON.parse(ev.data as string);
        } catch (e) {
          return;
        }

        if (msg.type === 'join') {
          roomId = msg.room;
          name = msg.name ?? name;
          if (!rooms.has(roomId)) rooms.set(roomId, new Set());
          rooms.get(roomId)!.add({ id: clientId, ws: socket, name });

          // notify the joining client of its id
          send({ type: 'joined', id: clientId } as const);

          // broadcast participants
          broadcastParticipants(roomId);
          return;
        }

        if (msg.type === 'leave') {
          if (roomId) removeClientFromRoom(roomId, clientId);
          roomId = null;
          return;
        }

        if (msg.type === 'offer' || msg.type === 'answer' || msg.type === 'candidate') {
          if (!roomId) return;
          const to = (msg as any).to as string;
          const set = rooms.get(roomId);
          if (!set) return;
          for (const client of set) {
            if (client.id === to && client.ws && (client.ws as WebSocket).readyState === 1) {
              client.ws.send(JSON.stringify(msg));
              break;
            }
          }
        }
      };

      socket.onclose = () => {
        if (roomId) removeClientFromRoom(roomId, clientId);
      };

      function removeClientFromRoom(rId: string, cId: string) {
        const set = rooms.get(rId);
        if (!set) return;
        for (const client of set) {
          if (client.id === cId) {
            set.delete(client);
            break;
          }
        }
        if (set.size === 0) rooms.delete(rId);
        else broadcastParticipants(rId);
      }

      function broadcastParticipants(rId: string) {
        const set = rooms.get(rId);
        if (!set) return;
        const list: Participant[] = Array.from(set).map((c) => ({ id: c.id, name: c.name }));
        for (const client of set) {
          if (client.ws && (client.ws as WebSocket).readyState === 1) {
            client.ws.send(JSON.stringify({ type: 'participants', list } as const));
          }
        }
      }
    });
  }

  // SvelteKit expects an upgrade response for webSocket
  return new Response(null, {
    status: 101,
    webSocket: { accept() {} }
  });
};