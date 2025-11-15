import { writable } from 'svelte/store';
export const rooms = writable({});
export function ensureRoom(roomId) {
    rooms.update((cur) => {
        if (!cur[roomId])
            cur[roomId] = { participants: [], messages: [] };
        return cur;
    });
}
export function setParticipants(roomId, list) {
    rooms.update((cur) => {
        if (!cur[roomId])
            cur[roomId] = { participants: [], messages: [] };
        cur[roomId].participants = list;
        return cur;
    });
}
export function addMessage(roomId, message) {
    rooms.update((cur) => {
        if (!cur[roomId])
            cur[roomId] = { participants: [], messages: [] };
        cur[roomId].messages = [...cur[roomId].messages, { ...message, ts: message.ts ?? Date.now() }];
        return cur;
    });
}
