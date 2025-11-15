// src/lib/client/audioLogic.ts
import { writable, get } from 'svelte/store';
import { toneManager } from './toneManager.js';
import { broadcastMessage } from './webRTCHandler.js';
// --- 1. 共有する状態（State） ---
/** アプリのオーディオが初期化されたか */
export const isAudioReady = writable(false);
/** 全楽器を読み込み中か */
export const isLoading = writable(false);
/** 現在選択されている楽器 */
export const selectedInstrument = writable('piano');
// --- 2. 共有するロジック（関数） ---
/**
 * オーディオを初期化し、全楽器をロードする
 * ユーザーの最初の操作（クリック/タップ）で呼び出す
 */
export async function initializeAndLoadAll() {
    if (get(isAudioReady))
        return; // 既に初期化済みなら何もしない
    try {
        isLoading.set(true);
        // オーディオ初期化
        await toneManager.init();
        isAudioReady.set(true);
        // 全楽器のロード
        await toneManager.loadAllInstruments();
    }
    catch (e) {
        console.error("Failed to initialize or load instruments:", e);
        alert("オーディオまたは楽器の初期化に失敗しました。");
    }
    finally {
        isLoading.set(false);
    }
}
/**
 * 鍵盤が押された時の共通処理
 * @param note 押された音名
 * @param isMultiplayer マルチプレイヤーモードか
 */
export function handleNoteDown(note, isMultiplayer) {
    const instrumentName = get(selectedInstrument);
    toneManager.noteOn(instrumentName, note);
    if (isMultiplayer) {
        broadcastMessage({ type: 'noteOn', note, instrument: instrumentName });
    }
}
/**
 * 鍵盤が離された時の共通処理
 * @param note 離された音名
 * @param isMultiplayer マルチプレイヤーモードか
 */
export function handleNoteUp(note, isMultiplayer) {
    const instrumentName = get(selectedInstrument);
    toneManager.noteOff(instrumentName, note);
    if (isMultiplayer) {
        broadcastMessage({ type: 'noteOff', note, instrument: instrumentName });
    }
}
/**
 * 楽器が変更された時の共通処理
 * @param instrumentName 新しい楽器名
 * @param isMultiplayer マルチプレイヤーモードか
 */
export function handleInstrumentChange(instrumentName, isMultiplayer) {
    selectedInstrument.set(instrumentName);
    if (isMultiplayer) {
        broadcastMessage({ type: 'instrumentChange', instrument: instrumentName });
    }
}
