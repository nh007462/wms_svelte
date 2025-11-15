import { type Writable } from 'svelte/store';
export declare const participants: Writable<Participant[]>;
export declare const localId: Writable<string | null>;
export declare const localNickname: Writable<string | null>;
export declare const isConnected: Writable<boolean>;
export declare const remoteStreams: Writable<MediaStream[]>;
export interface Participant {
    id: string;
    nickname: string;
    instrument: string;
}
type DataChannelMessage = {
    type: 'noteOn';
    note: string | string[];
    instrument: string;
} | {
    type: 'noteOff';
    note: string | string[];
    instrument: string;
} | {
    type: 'instrumentChange';
    instrument: string;
};
export declare function connectAndJoin(roomId: string, nickname: string): void;
export declare function broadcastMessage(message: DataChannelMessage): void;
export declare function updateLocalStream(stream: MediaStream | null): void;
export declare function disconnect(): void;
export {};
