import { WebSocketServer } from "ws";
let wss = null;
const rooms = /* @__PURE__ */ new Map();
function genId() {
  return Math.random().toString(36).slice(2, 9);
}
const GET = async ({ request }) => {
  if (!wss) {
    wss = new WebSocketServer({ noServer: true });
    wss.on("connection", (socket) => {
      const clientId = genId();
      let roomId = null;
      let name = "anonymous";
      const send = (obj) => {
        try {
          socket.send(JSON.stringify(obj));
        } catch (e) {
        }
      };
      socket.onmessage = (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch (e) {
          return;
        }
        if (msg.type === "join") {
          roomId = msg.room;
          name = msg.name ?? name;
          if (!rooms.has(roomId)) rooms.set(roomId, /* @__PURE__ */ new Set());
          rooms.get(roomId).add({ id: clientId, ws: socket, name });
          send({ type: "joined", id: clientId });
          broadcastParticipants(roomId);
          return;
        }
        if (msg.type === "leave") {
          if (roomId) removeClientFromRoom(roomId, clientId);
          roomId = null;
          return;
        }
        if (msg.type === "offer" || msg.type === "answer" || msg.type === "candidate") {
          if (!roomId) return;
          const to = msg.to;
          const set = rooms.get(roomId);
          if (!set) return;
          for (const client of set) {
            if (client.id === to && client.ws && client.ws.readyState === 1) {
              client.ws.send(JSON.stringify(msg));
              break;
            }
          }
        }
      };
      socket.onclose = () => {
        if (roomId) removeClientFromRoom(roomId, clientId);
      };
      function removeClientFromRoom(rId, cId) {
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
      function broadcastParticipants(rId) {
        const set = rooms.get(rId);
        if (!set) return;
        const list = Array.from(set).map((c) => ({ id: c.id, name: c.name }));
        for (const client of set) {
          if (client.ws && client.ws.readyState === 1) {
            client.ws.send(JSON.stringify({ type: "participants", list }));
          }
        }
      }
    });
  }
  return new Response(null, {
    status: 101,
    webSocket: { accept() {
    } }
  });
};
export {
  GET
};
