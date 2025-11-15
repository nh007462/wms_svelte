/** アプリのオーディオが初期化されたか */
export declare const isAudioReady: import("svelte/store").Writable<boolean>;
/** 全楽器を読み込み中か */
export declare const isLoading: import("svelte/store").Writable<boolean>;
/** 現在選択されている楽器 */
export declare const selectedInstrument: import("svelte/store").Writable<string>;
/**
 * オーディオを初期化し、全楽器をロードする
 * ユーザーの最初の操作（クリック/タップ）で呼び出す
 */
export declare function initializeAndLoadAll(): Promise<void>;
/**
 * 鍵盤が押された時の共通処理
 * @param note 押された音名
 * @param isMultiplayer マルチプレイヤーモードか
 */
export declare function handleNoteDown(note: string, isMultiplayer: boolean): void;
/**
 * 鍵盤が離された時の共通処理
 * @param note 離された音名
 * @param isMultiplayer マルチプレイヤーモードか
 */
export declare function handleNoteUp(note: string, isMultiplayer: boolean): void;
/**
 * 楽器が変更された時の共通処理
 * @param instrumentName 新しい楽器名
 * @param isMultiplayer マルチプレイヤーモードか
 */
export declare function handleInstrumentChange(instrumentName: string, isMultiplayer: boolean): void;
