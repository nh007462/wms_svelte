// src/lib/client/webRTCHandler.ts
import { writable } from 'svelte/store';
import { toneManager } from './toneManager.js';
// --- ストア定義 ---
export const participants = writable([]);
export const localId = writable(null);
export const localNickname = writable(null);
export const isConnected = writable(false);
export const remoteStreams = writable([]);
// --- 内部状態 ---
let ws = null;
const peers = new Map();
let currentLocalStream = null;
const ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
// --- WebSocket接続 ---
function getWebSocketURL() {
    if (typeof window === 'undefined')
        return '';
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${window.location.host}/ws`;
}
function sendMessage(type, payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, payload }));
    }
}
// --- ユーザー退出処理 ---
function handleUserLeft(id) {
    const peer = peers.get(id);
    if (peer) {
        peer.pc.close();
        if (peer.remoteStream) {
            remoteStreams.update(streams => streams.filter(s => s.id !== peer.remoteStream.id));
        }
        peers.delete(id);
    }
    participants.update(pList => pList.filter(p => p.id !== id));
    if (peers.size === 0)
        isConnected.set(false);
}
// --- ピア接続の作成 ---
function createPeerConnection(peerId, peerNickname, instrument, initiator) {
    if (peers.has(peerId))
        return peers.get(peerId).pc;
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peers.set(peerId, { id: peerId, nickname: peerNickname, pc, instrument });
    pc.onicecandidate = (event) => {
        if (event.candidate && ws)
            sendMessage('signal', { to: peerId, signal: { type: 'candidate', candidate: event.candidate } });
    };
    pc.ontrack = (event) => {
        const peer = peers.get(peerId);
        if (peer) {
            peer.remoteStream = event.streams[0];
            remoteStreams.update(streams => [...streams.filter(s => s.id !== event.streams[0].id), event.streams[0]]);
        }
    };
    pc.oniceconnectionstatechange = () => {
        if (['failed', 'disconnected', 'closed'].includes(pc.iceConnectionState))
            handleUserLeft(peerId);
    };
    if (currentLocalStream)
        currentLocalStream.getTracks().forEach(track => pc.addTrack(track, currentLocalStream));
    const setupDataChannel = (dc) => {
        dc.onopen = () => isConnected.set(true);
        dc.onclose = () => {
            if (Array.from(peers.values()).every(p => !p.dataChannel || p.dataChannel.readyState !== 'open'))
                isConnected.set(false);
        };
        dc.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                switch (data.type) {
                    case 'noteOn':
                        toneManager.noteOn(data.instrument, data.note);
                        break;
                    case 'noteOff':
                        toneManager.noteOff(data.instrument, data.note);
                        break;
                    case 'instrumentChange':
                        participants.update(pList => pList.map(p => p.id === peerId ? { ...p, instrument: data.instrument } : p));
                        break;
                }
            }
            catch (e) {
                console.error("Error handling data channel message", e);
            }
        };
        const peer = peers.get(peerId);
        if (peer)
            peer.dataChannel = dc;
    };
    if (initiator) {
        const dc = pc.createDataChannel('data');
        setupDataChannel(dc);
    }
    else {
        pc.ondatachannel = (event) => setupDataChannel(event.channel);
    }
    return pc;
}
// --- WebSocketメッセージ受信処理 ---
async function handleWebSocketMessage(event) {
    try {
        const data = JSON.parse(event.data);
        const { type, payload } = data;
        switch (type) {
            case 'room-full': {
                alert('このルームは満員です。');
                window.location.href = '/rooms';
                break;
            }
            case 'join-success': {
                const { id, users } = payload;
                localId.set(id);
                participants.set(users);
                if (users.length === 0)
                    isConnected.set(true);
                users.forEach((user) => {
                    const pc = createPeerConnection(user.id, user.nickname, user.instrument, true);
                    pc.createOffer()
                        .then(offer => pc.setLocalDescription(offer))
                        .then(() => sendMessage('signal', { to: user.id, signal: pc.localDescription }));
                });
                break;
            }
            case 'user-joined': {
                const userJoinedPayload = payload;
                participants.update(pList => [...pList, userJoinedPayload]);
                break;
            }
            case 'signal': {
                const { from, fromNickname, signal } = payload;
                let pc = peers.get(from)?.pc;
                if (signal.type === 'offer') {
                    if (!pc)
                        pc = createPeerConnection(from, fromNickname, 'piano', false);
                    await pc.setRemoteDescription(new RTCSessionDescription(signal));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    sendMessage('signal', { to: from, signal: pc.localDescription });
                }
                else if (signal.type === 'answer') {
                    if (pc)
                        await pc.setRemoteDescription(new RTCSessionDescription(signal));
                }
                else if (signal.type === 'candidate') {
                    if (pc && pc.remoteDescription) {
                        const candidateSignal = signal;
                        await pc.addIceCandidate(new RTCIceCandidate(candidateSignal.candidate));
                    }
                }
                break;
            }
            case 'user-left': {
                handleUserLeft(payload.id);
                break;
            }
        }
    }
    catch (e) {
        console.error("Failed to handle WebSocket message:", e);
    }
}
// --- 公開する関数 ---
export function connectAndJoin(roomId, nickname) {
    if (ws && ws.readyState === WebSocket.OPEN)
        return;
    localNickname.set(nickname);
    ws = new WebSocket(getWebSocketURL());
    ws.onopen = () => sendMessage('join-room', { roomId, nickname });
    ws.onmessage = handleWebSocketMessage;
    ws.onerror = (error) => console.error('WebSocket Error:', error);
    ws.onclose = () => {
        ws = null;
        peers.forEach(peer => peer.pc.close());
        peers.clear();
        participants.set([]);
        localId.set(null);
        isConnected.set(false);
        remoteStreams.set([]);
    };
}
export function broadcastMessage(message) {
    peers.forEach(peer => {
        if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
            try {
                peer.dataChannel.send(JSON.stringify(message));
            }
            catch (e) {
                console.error(`Failed to send message to ${peer.id}:`, e);
            }
        }
    });
}
export function updateLocalStream(stream) {
    currentLocalStream = stream;
    peers.forEach(peer => {
        const senders = peer.pc.getSenders().filter(s => s.track?.kind === 'audio');
        senders.forEach(sender => peer.pc.removeTrack(sender));
        if (stream)
            stream.getAudioTracks().forEach(track => peer.pc.addTrack(track, stream));
    });
}
export function disconnect() {
    if (ws)
        ws.close();
}
