// src/lib/client/webRTCHandler.ts
import { writable, type Writable, get } from 'svelte/store';
import { toneManager } from './toneManager.js';

// --- Store definitions ---
export const participants: Writable<Participant[]> = writable([]);
export const localId: Writable<string | null> = writable(null);
export const localNickname: Writable<string | null> = writable(null);
export const isConnected: Writable<boolean> = writable(false);
export const remoteStreams: Writable<MediaStream[]> = writable([]);

export interface ChatMessage {
	from: string;
	nickname: string;
	message: string;
	timestamp: number;
}
export const chatMessages = writable<ChatMessage[]>([]);

// --- Internal state ---
let ws: WebSocket | null = null;
const peers = new Map<string, Peer>();
const ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// --- Type definitions (file‑internal) ---
interface Peer {
	id: string;
	nickname: string;
	pc: RTCPeerConnection;
	dataChannel?: RTCDataChannel;
	instrument: string;
	remoteStream?: MediaStream;
	candidateBuffer: RTCIceCandidateInit[];
}
export interface Participant {
	id: string;
	nickname: string;
	instrument: string;
}
interface WebSocketMessage {
	type: string;
	payload: any;
}
type DataChannelMessage =
	| { type: 'noteOn'; note: string | string[]; instrument: string }
	| { type: 'noteOff'; note: string | string[]; instrument: string }
	| { type: 'instrumentChange'; instrument: string };

// --- WebSocket utilities ---
function getWebSocketURL(): string {
	if (typeof window === 'undefined') return '';
	const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
	return `${protocol}://${window.location.host}/ws`;
}

function sendMessage(type: string, payload: unknown): void {
	if (ws && ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify({ type, payload }));
	}
}

// --- User left handling ---
function handleUserLeft(id: string): void {
	const peer = peers.get(id);
	if (peer) {
		peer.pc.close();
		if (peer.remoteStream) {
			remoteStreams.update((streams) => streams.filter((s) => s.id !== peer.remoteStream!.id));
		}
		peers.delete(id);
	}
	participants.update((list) => list.filter((p) => p.id !== id));
	if (peers.size === 0) isConnected.set(true);
}

// --- Peer connection creation ---
function createPeerConnection(
	peerId: string,
	peerNickname: string,
	instrument: string,
	initiator: boolean
): RTCPeerConnection {
	if (peers.has(peerId)) return peers.get(peerId)!.pc;

	const pc = new RTCPeerConnection(ICE_SERVERS);
	peers.set(peerId, { id: peerId, nickname: peerNickname, pc, instrument, candidateBuffer: [] });

	// Add audio transceiver (mic if available, otherwise recvonly)
	const micStream = toneManager.micStream;
	const audioTrack = micStream?.getAudioTracks()[0];

	pc.addTransceiver('audio', {
		direction: 'sendrecv',
		streams: micStream ? [micStream] : [],
		sendEncodings: audioTrack ? [{ active: true }] : undefined
	});

	pc.onicecandidate = (event) => {
		if (event.candidate && ws) {
			sendMessage('signal', {
				to: peerId,
				signal: { type: 'candidate', candidate: event.candidate }
			});
		}
	};

	pc.ontrack = (event) => {
		const peer = peers.get(peerId);
		if (peer) {
			const stream = event.streams[0] || new MediaStream([event.track]);
			const localMixed = toneManager.localInstrumentStream;
			if (localMixed && stream.id === localMixed.id) {
				console.debug('Ignored loopback audio stream');
				return;
			}
			peer.remoteStream = stream;
			remoteStreams.update((streams) => [...streams.filter((s) => s.id !== stream.id), stream]);
		}
	};

	pc.oniceconnectionstatechange = () => {
		const state = pc.iceConnectionState;
		console.log(`ICE Connection State for ${peerId}: ${state}`);
		if (state === 'failed') {
			console.warn(`Connection failed for ${peerId}, restarting...`);
			restartConnection(peerId);
		} else if (state === 'disconnected') {
			console.warn(`Connection disconnected for ${peerId}, waiting...`);
			setTimeout(() => {
				const p = peers.get(peerId);
				if (p && p.pc.iceConnectionState === 'disconnected') {
					console.warn(`Connection still disconnected for ${peerId}, restarting...`);
					restartConnection(peerId);
				}
			}, 5000);
		}
	};

	const setupDataChannel = (dc: RTCDataChannel) => {
		dc.onopen = () => isConnected.set(true);
		dc.onclose = () => {
			if (peers.size === 0) {
				isConnected.set(true);
			} else if (
				Array.from(peers.values()).every(
					(p) => !p.dataChannel || p.dataChannel.readyState !== 'open'
				)
			) {
				isConnected.set(false);
			}
		};
		dc.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data) as DataChannelMessage;
				switch (data.type) {
					case 'noteOn': {
						// Always play note from DataChannel as instruments are no longer mixed in audio stream
						toneManager.noteOn(data.instrument, data.note);
						break;
					}
					case 'noteOff':
						toneManager.noteOff(data.instrument, data.note);
						break;
					case 'instrumentChange':
						participants.update((list) =>
							list.map((p) => (p.id === peerId ? { ...p, instrument: data.instrument } : p))
						);
						break;
				}
			} catch (e) {
				console.error('Error handling data channel message', e);
			}
		};
		const peer = peers.get(peerId);
		if (peer) peer.dataChannel = dc;
	};

	if (initiator) {
		const dc = pc.createDataChannel('data');
		setupDataChannel(dc);
	} else {
		pc.ondatachannel = (event) => setupDataChannel(event.channel);
	}

	return pc;
}

// --- Reconnection handling ---
async function restartConnection(peerId: string) {
	const peer = peers.get(peerId);
	if (!peer) return;
	const myId = get(localId);
	// Polite peer: smaller ID initiates restart
	if (myId && myId > peerId) {
		console.log(`Waiting for ${peerId} to restart connection (I am passive), sending request...`);
		sendMessage('signal', { to: peerId, signal: { type: 'restart-request' } });
		return;
	}
	console.log(`Restarting connection with ${peerId} (ICE Restart)...`);
	try {
		const offer = await peer.pc.createOffer({ iceRestart: true });
		await peer.pc.setLocalDescription(offer);
		sendMessage('signal', { to: peerId, signal: peer.pc.localDescription });
	} catch (e) {
		console.error(`Failed to restart connection with ${peerId}:`, e);
	}
}

// --- WebSocket message handling ---
async function handleWebSocketMessage(event: MessageEvent): Promise<void> {
	try {
		const data = JSON.parse(event.data) as WebSocketMessage;
		const { type, payload } = data;
		switch (type) {
			case 'room-full': {
				alert('このルームは満員です。');
				window.location.href = '/rooms';
				break;
			}
			case 'join-success': {
				const { id, users } = payload as { id: string; users: Participant[] };
				localId.set(id);
				participants.set(users);
				if (users.length === 0) {
					isConnected.set(true);
				} else {
					setTimeout(() => {
						if (!get(isConnected) && get(participants).length > 0) {
							console.warn('Connection timeout: forcing isConnected to true');
							isConnected.set(true);
						}
					}, 10000);
				}
				users.forEach((user) => {
					const pc = createPeerConnection(user.id, user.nickname, user.instrument, true);
					pc.createOffer()
						.then((offer) => pc.setLocalDescription(offer))
						.then(() => sendMessage('signal', { to: user.id, signal: pc.localDescription }));
				});
				break;
			}
			case 'user-joined': {
				const newUser = payload as Participant;
				participants.update((list) => [...list, newUser]);
				break;
			}

			case 'chat-message': {
				const { from, nickname, message } = payload as {
					from: string;
					nickname: string;
					message: string;
				};
				chatMessages.update((msgs) => [
					...msgs,
					{ from, nickname, message, timestamp: Date.now() }
				]);
				break;
			}
			case 'ai-play-note': {
				const { note, duration, instrument } = payload as {
					note: string;
					duration: string;
					instrument: string;
				};
				toneManager.triggerAttackRelease(note, duration, instrument);
				break;
			}
			case 'signal': {
				const { from, fromNickname, signal } = payload as {
					from: string;
					fromNickname: string;
					signal:
						| RTCSessionDescriptionInit
						| { type: 'candidate'; candidate: RTCIceCandidateInit }
						| { type: 'restart-request' };
				};
				let pc = peers.get(from)?.pc;
				const peer = peers.get(from);
				// Restart request handling
				if (
					typeof signal === 'object' &&
					'type' in signal &&
					(signal as any).type === 'restart-request'
				) {
					console.log(`Received restart request from ${from}`);
					restartConnection(from);
					break;
				}
				if (signal.type === 'offer') {
					if (!pc) {
						pc = createPeerConnection(from, fromNickname, 'piano', false);
					}
					await pc.setRemoteDescription(
						new RTCSessionDescription(signal as RTCSessionDescriptionInit)
					);
					const answer = await pc.createAnswer();
					await pc.setLocalDescription(answer);
					sendMessage('signal', { to: from, signal: pc.localDescription });
					// Process buffered candidates
					if (peer?.candidateBuffer?.length) {
						for (const cand of peer.candidateBuffer) {
							await pc.addIceCandidate(new RTCIceCandidate(cand));
						}
						peer.candidateBuffer = [];
					}
				} else if (signal.type === 'answer') {
					if (pc) {
						await pc.setRemoteDescription(
							new RTCSessionDescription(signal as RTCSessionDescriptionInit)
						);
						if (peer?.candidateBuffer?.length) {
							for (const cand of peer.candidateBuffer) {
								await pc.addIceCandidate(new RTCIceCandidate(cand));
							}
							peer.candidateBuffer = [];
						}
					}
				} else if (signal.type === 'candidate') {
					const cand = (signal as { type: 'candidate'; candidate: RTCIceCandidateInit }).candidate;
					if (pc && pc.remoteDescription) {
						await pc.addIceCandidate(new RTCIceCandidate(cand));
					} else if (peer) {
						peer.candidateBuffer.push(cand);
					}
				}
				break;
			}
			case 'user-left': {
				handleUserLeft((payload as { id: string }).id);
				break;
			}
		}
	} catch (e) {
		console.error('Failed to handle WebSocket message:', e);
	}
}

// --- Public API ---
export async function connectAndJoin(
	roomId: string,
	nickname: string,
	instrument: string = 'piano'
): Promise<void> {
	if (ws && ws.readyState === WebSocket.OPEN) return;
	// Ensure ToneManager is ready before any peer connections are made
	await toneManager.init();
	localNickname.set(nickname);
	ws = new WebSocket(getWebSocketURL());
	ws.onopen = () => sendMessage('join-room', { roomId, nickname, instrument });
	ws.onmessage = handleWebSocketMessage;
	ws.onerror = (err) => console.error('WebSocket Error:', err);
	ws.onclose = () => {
		ws = null;
		peers.forEach((p) => p.pc.close());
		peers.clear();
		participants.set([]);
		localId.set(null);
		isConnected.set(false);
		remoteStreams.set([]);
	};
}

export function broadcastMessage(message: DataChannelMessage): void {
	peers.forEach((peer) => {
		if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
			try {
				peer.dataChannel.send(JSON.stringify(message));
			} catch (e) {
				console.error(`Failed to send message to ${peer.id}:`, e);
			}
		}
	});
}

export function updateLocalStream(stream: MediaStream | null): void {
	const audioTrack = stream?.getAudioTracks()[0] || null;

	peers.forEach((peer) => {
		const transceivers = peer.pc.getTransceivers();
		const audioTransceiver = transceivers.find((t) => t.receiver.track.kind === 'audio');

		if (audioTransceiver && audioTransceiver.sender) {
			audioTransceiver.sender
				.replaceTrack(audioTrack)
				.then(() => {
					console.log(`Updated audio track for peer ${peer.id}.`);
				})
				.catch((err) => console.error(`Failed to replace track for peer ${peer.id}:`, err));
		}
	});
}

export function disconnect(): void {
	if (ws) ws.close();
}

export function summonAI(roomId: string): void {
	if (ws && ws.readyState === WebSocket.OPEN) {
		ws.send(
			JSON.stringify({
				type: 'summon-ai',
				payload: { roomId }
			})
		);
		console.log(`Sent summon-ai request for room ${roomId}`);
	} else {
		console.warn('WebSocket not connected, cannot summon AI');
	}
}

export function dismissAI(roomId: string): void {
	if (ws && ws.readyState === WebSocket.OPEN) {
		ws.send(
			JSON.stringify({
				type: 'dismiss-ai',
				payload: { roomId }
			})
		);
		console.log(`Sent dismiss-ai request for room ${roomId}`);
	} else {
		console.warn('WebSocket not connected, cannot dismiss AI');
	}
}

export function sendChatMessage(roomId: string, message: string): void {
	if (ws && ws.readyState === WebSocket.OPEN) {
		ws.send(
			JSON.stringify({
				type: 'chat-message',
				payload: { roomId, message }
			})
		);
	} else {
		console.warn('WebSocket not connected, cannot send chat message');
	}
}
