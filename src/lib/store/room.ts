import { writable } from 'svelte/store';
import type { RoomsStore, Participant, ChatMessage } from '$lib/types/rooms.ts';


export const rooms = writable<RoomsStore>({});


export function ensureRoom(roomId: string) {
rooms.update((cur) => {
if (!cur[roomId]) cur[roomId] = { participants: [], messages: [] };
return cur;
});
}


export function setParticipants(roomId: string, list: Participant[]) {
rooms.update((cur) => {
if (!cur[roomId]) cur[roomId] = { participants: [], messages: [] };
cur[roomId].participants = list;
return cur;
});
}


export function addMessage(roomId: string, message: ChatMessage) {
rooms.update((cur) => {
if (!cur[roomId]) cur[roomId] = { participants: [], messages: [] };
cur[roomId].messages = [...cur[roomId].messages, { ...message, ts: message.ts ?? Date.now() }];
return cur;
});
}