// src/lib/client/webRTCHandler.ts
import { writable, type Writable, get } from 'svelte/store';
import { toneManager } from './toneManager.js';
import * as Tone from 'tone';

// --- ストア定義 ---
export const participants: Writable<Participant[]> = writable([]);
export const localId: Writable<string | null> = writable(null);
export const localNickname: Writable<string | null> = writable(null);
export const isConnected: Writable<boolean> = writable(false);
export const remoteStreams: Writable<MediaStream[]> = writable([]);

// --- 内部状態 ---
let ws: WebSocket | null = null;
const peers = new Map<string, Peer>();
let currentLocalStream: MediaStream | null = null;
let currentMixedStream: MediaStream | null = null;
const ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// --- 型定義 (ファイル内部) ---
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

// --- WebSocket接続 ---
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

// --- ユーザー退出処理 ---
function handleUserLeft(id: string): void {
	const peer = peers.get(id);
	if (peer) {
		peer.pc.close();
		if (peer.remoteStream) {
			remoteStreams.update((streams) => streams.filter((s) => s.id !== peer.remoteStream!.id));
		}
		peers.delete(id);
	}
	participants.update((pList) => pList.filter((p) => p.id !== id));
	if (peers.size === 0) isConnected.set(true);
}

// --- ピア接続の作成 ---
function createPeerConnection(
	peerId: string,
	peerNickname: string,
	instrument: string,
	initiator: boolean
): RTCPeerConnection {
	if (peers.has(peerId)) return peers.get(peerId)!.pc;

	const pc = new RTCPeerConnection(ICE_SERVERS);
	peers.set(peerId, { id: peerId, nickname: peerNickname, pc, instrument, candidateBuffer: [] });

	pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
		if (event.candidate && ws)
			sendMessage('signal', {
				to: peerId,
				signal: { type: 'candidate', candidate: event.candidate }
			});
	};
	pc.ontrack = (event: RTCTrackEvent) => {
		const peer = peers.get(peerId);
		if (peer) {
			const stream = event.streams[0] || new MediaStream([event.track]);
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

	// Always add an audio transceiver to allow seamless mic toggling
	const audioTransceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });

	// Use the shared mixed stream
	if (!currentMixedStream) {
		currentMixedStream = getMixedStream(currentLocalStream);
	}
	const audioTrack = currentMixedStream.getAudioTracks()[0];
	if (audioTrack) {
		audioTransceiver.sender.replaceTrack(audioTrack);
	}

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
		dc.onmessage = (event: MessageEvent) => {
			try {
				const data = JSON.parse(event.data) as DataChannelMessage;
				switch (data.type) {
					case 'noteOn':
						// If we are receiving an audio stream from this peer, do NOT play the note locally
						// to avoid double audio (one from stream, one from local synth).
						// However, we might want to update UI? Currently UI is not updated for remote notes.
						// So we just check if we have a remote stream.
						{
							const peer = peers.get(peerId);
							const hasAudioStream = peer?.remoteStream?.getAudioTracks().length ?? 0 > 0;
							if (!hasAudioStream) {
								toneManager.noteOn(data.instrument, data.note);
							}
						}
						break;
					case 'noteOff':
						toneManager.noteOff(data.instrument, data.note);
						break;
					case 'instrumentChange':
						participants.update((pList) =>
							pList.map((p) => (p.id === peerId ? { ...p, instrument: data.instrument } : p))
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
		pc.ondatachannel = (event: RTCDataChannelEvent) => setupDataChannel(event.channel);
	}
	return pc;
}

// --- 再接続処理 ---
// --- 再接続処理 ---
async function restartConnection(peerId: string) {
	const peer = peers.get(peerId);
	if (!peer) return;

	const myId = get(localId);
	// 競合（Glare）を防ぐため、IDが小さい方のピアのみが再接続（Offer）を開始する
	if (myId && myId > peerId) {
		console.log(`Waiting for ${peerId} to restart connection (I am passive), sending request...`);
		sendMessage('signal', { to: peerId, signal: { type: 'restart-request' } });
		return;
	}

	console.log(`Restarting connection with ${peerId} (ICE Restart)...`);

	try {
		// 既存のPCを使ってICE Restartを行う（PCを作り直さない）
		const offer = await peer.pc.createOffer({ iceRestart: true });
		await peer.pc.setLocalDescription(offer);
		sendMessage('signal', { to: peerId, signal: peer.pc.localDescription });
	} catch (e) {
		console.error(`Failed to restart connection with ${peerId}:`, e);
	}
}

// --- WebSocketメッセージ受信処理 ---
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
					// P2P接続が確立しない場合のタイムアウト処理
					setTimeout(() => {
						if (!get(isConnected) && get(participants).length > 0) {
							console.warn('Connection timeout: forcing isConnected to true');
							isConnected.set(true);
						}
					}, 10000);
				}

				users.forEach((user: Participant) => {
					const pc = createPeerConnection(user.id, user.nickname, user.instrument, true);
					pc.createOffer()
						.then((offer) => pc.setLocalDescription(offer))
						.then(() => sendMessage('signal', { to: user.id, signal: pc.localDescription }));
				});
				break;
			}
			case 'user-joined': {
				const userJoinedPayload = payload as Participant;
				participants.update((pList) => [...pList, userJoinedPayload]);
				break;
			}
			case 'signal': {
				const { from, fromNickname, signal } = payload as {
					from: string;
					fromNickname: string;
					signal: RTCSessionDescriptionInit | { type: 'candidate'; candidate: RTCIceCandidateInit };
				};
				let pc = peers.get(from)?.pc;
				const peer = peers.get(from);

				// Handle restart request
				if ('type' in signal && signal.type === 'restart-request') {
					console.log(`Received restart request from ${from}`);
					restartConnection(from);
					return;
				}

				if (signal.type === 'offer') {
					if (!pc) {
						pc = createPeerConnection(from, fromNickname, 'piano', false);
						// Re-fetch peer after creation
					}
					await pc.setRemoteDescription(
						new RTCSessionDescription(signal as RTCSessionDescriptionInit)
					);
					const answer = await pc.createAnswer();
					await pc.setLocalDescription(answer);
					sendMessage('signal', { to: from, signal: pc.localDescription });

					// Process buffered candidates
					if (peers.get(from)?.candidateBuffer) {
						const buffer = peers.get(from)!.candidateBuffer;
						for (const candidate of buffer) {
							await pc.addIceCandidate(new RTCIceCandidate(candidate));
						}
						peers.get(from)!.candidateBuffer = [];
					}
				} else if (signal.type === 'answer') {
					if (pc) {
						await pc.setRemoteDescription(
							new RTCSessionDescription(signal as RTCSessionDescriptionInit)
						);
						// Process buffered candidates
						if (peers.get(from)?.candidateBuffer) {
							const buffer = peers.get(from)!.candidateBuffer;
							for (const candidate of buffer) {
								await pc.addIceCandidate(new RTCIceCandidate(candidate));
							}
							peers.get(from)!.candidateBuffer = [];
						}
					}
				} else if (signal.type === 'candidate') {
					const candidateSignal = signal as { type: 'candidate'; candidate: RTCIceCandidateInit };
					if (pc && pc.remoteDescription) {
						await pc.addIceCandidate(new RTCIceCandidate(candidateSignal.candidate));
					} else if (peer) {
						console.log(`Buffering candidate for ${from}`);
						peer.candidateBuffer.push(candidateSignal.candidate);
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

// --- 公開する関数 ---
export function connectAndJoin(
	roomId: string,
	nickname: string,
	instrument: string = 'piano'
): void {
	if (ws && ws.readyState === WebSocket.OPEN) return;
	localNickname.set(nickname);
	ws = new WebSocket(getWebSocketURL());
	ws.onopen = () => sendMessage('join-room', { roomId, nickname, instrument });
	ws.onmessage = handleWebSocketMessage;
	ws.onerror = (error) => console.error('WebSocket Error:', error);
	ws.onclose = () => {
		ws = null;
		peers.forEach((peer) => peer.pc.close());
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
function getMixedStream(micStream: MediaStream | null): MediaStream {
	const ctx = Tone.getContext();
	const dest = ctx.createMediaStreamDestination();

	// 1. Instrument Stream (Local only)
	// Use the dedicated local stream destination that only has local instruments connected
	const instStream = toneManager.localInstrumentStream;
	if (instStream && instStream.getAudioTracks().length > 0) {
		ctx.createMediaStreamSource(instStream).connect(dest);
	}

	// 2. Mic Stream
	if (micStream && micStream.getAudioTracks().length > 0) {
		ctx.createMediaStreamSource(micStream).connect(dest);
	}

	return dest.stream;
}

export function updateLocalStream(stream: MediaStream | null): void {
	currentLocalStream = stream;

	// Update the shared mixed stream
	currentMixedStream = getMixedStream(stream);

	peers.forEach((peer) => {
		const transceiver = peer.pc.getTransceivers().find((t) => t.receiver.track.kind === 'audio');
		if (transceiver && transceiver.sender) {
			const track = currentMixedStream!.getAudioTracks()[0];
			transceiver.sender
				.replaceTrack(track)
				.catch((err) => console.error('replaceTrack failed', err));
		}
	});
}
export function disconnect(): void {
	if (ws) ws.close();
}
