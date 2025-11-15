import type { RoomsStore, Participant, ChatMessage } from '../types/rooms.ts';
export declare const rooms: import("svelte/store").Writable<RoomsStore>;
export declare function ensureRoom(roomId: string): void;
export declare function setParticipants(roomId: string, list: Participant[]): void;
export declare function addMessage(roomId: string, message: ChatMessage): void;
