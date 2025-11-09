<script lang="ts">
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import {
    isAudioReady,
    isLoading,
    selectedInstrument,
    initializeAndLoadAll,
    handleNoteDown as audioHandleNoteDown,
    handleNoteUp as audioHandleNoteUp,
    handleInstrumentChange
  } from '$lib/client/audioLogic.js';

  import {
    participants,
    localId,
    localNickname,
    isConnected,
    remoteStreams,
    connectAndJoin,
    disconnect,
    updateLocalStream
  } from '$lib/client/webRTCHandler.js';
  import type { Participant } from '$lib/client/webRTCHandler.js';

  // UIコンポーネント
  // import InstrumentSelector from '$components/InstrumentSelector.svelte';
  // import Keyboard from '$components/Keyboard.svelte';
  // import Loading from '$components/Loading.svelte';
  import NicknameModal from '../../../components/NicknameModal.svelte';
  // import MicControl from '$components/MicControl.svelte';
  // import RecordingControl from '$components/RecordingControl.svelte';
  // import Participants from '$components/Participants.svelte';

  const roomId = $page.params.roomId;
  let nickname: string | null = null;
  let isModalOpen = true;

  onMount(() => {
    // ★★★ デバッグ用にwindowオブジェクトに関数を登録 ★★★
    (window as any).debugNoteOn = (note: string) => {
      // ストアから現在の楽器を取得
      let instrument = 'piano'; // デフォルト
      selectedInstrument.subscribe(val => instrument = val)(); // ストアから最新の値を取得
      
      console.log(`Debug: ${instrument} - ${note} ON`);
      audioHandleNoteDown(note, false); // isMultiplayer: false で呼び出し
    };
    
    (window as any).debugNoteOff = (note: string) => {
      let instrument = 'piano';
      selectedInstrument.subscribe(val => instrument = val)();
      
      console.log(`Debug: ${instrument} - ${note} OFF`);
      audioHandleNoteUp(note, false);
    };

    nickname = localStorage.getItem('nickname');

    return () => {
      disconnect();
    };
  });

  async function handleConfirmNickname(event: CustomEvent<string>) {
    nickname = event.detail;
    if (typeof window !== 'undefined') localStorage.setItem('nickname', nickname);
    isModalOpen = false;
    await initializeAndLoadAll();
  }

  // ★★★ オーディオの準備ができたら、WebRTC接続を開始 ★★★
  $: if ($isAudioReady && nickname && roomId) {
    // connectAndJoinは isAudioReady が true になった後に自動で実行される
    connectAndJoin(roomId, nickname);
  }

  const testNote = 'C2'; // 送信する音符

  function handleTestNoteDown() {
    if (!$isAudioReady || !$isConnected) {
      console.warn("Audio not ready or not connected via WebRTC.");
      return;
    }
    console.log(`Sending noteOn: ${testNote} with ${$selectedInstrument}`);
    // ★★★ audioLogicの関数を呼び出す ★★★
    audioHandleNoteDown(testNote, true); // true = マルチプレイヤーモード
  }

  function handleTestNoteUp() {
    if (!$isAudioReady || !$isConnected) {
      console.warn("Audio not ready or not connected via WebRTC.");
      return;
    }
    console.log(`Sending noteOff: ${testNote} with ${$selectedInstrument}`);
    // ★★★ audioLogicの関数を呼び出す ★★★
    audioHandleNoteUp(testNote, true); // true = マルチプレイヤーモード
  }

</script>

<NicknameModal
  isOpen={isModalOpen}
  on:close={() => goto('/rooms')}
  on:confirm={handleConfirmNickname}
/>

{#if !isModalOpen}

  <div class="flex flex-col h-full">
    
    <!-- 参加者リスト（仮） -->
    <div class="mb-4 p-2">
      <div class="flex justify-center items-center gap-4 flex-wrap">
        {#if $localNickname}
          <div class="bg-gray-800 p-3 rounded-lg border border-cyan-500">
            <p class="font-bold text-white">{$localNickname} (You)</p>
            <p class="text-xs text-gray-400">{$selectedInstrument}</p>
          </div>
        {/if}
        {#each $participants as p (p.id)}
          <div class="bg-gray-800 p-3 rounded-lg border border-gray-700">
            <p class="font-bold text-gray-300">{p.nickname}</p>
            <p class="text-xs text-gray-400">{p.instrument}</p>
          </div>
        {/each}
      </div>
    </div>

    <!-- メイン操作エリア -->
    <div class="flex-grow flex flex-col justify-end p-4 bg-gray-800 rounded-t-lg">
      <!-- ★★★ ストアの $isLoading を使用 ★★★ -->
      {#if $isLoading}
        <div class="text-center text-white">全楽器をロード中...</div>
      {:else if !$isAudioReady}
        <div class="text-center text-white animate-pulse">ニックネームを入力してください...</div>
      {:else}
        <div>
          {#if !$isConnected && $participants.length > 0}
            <div class="text-center text-yellow-400 animate-pulse mb-2">
              他の参加者に接続中...
            </div>
          {/if}
          
          <div class="flex items-center justify-center md:justify-between mb-4 flex-wrap gap-4">
            <div class="text-gray-500">
              (楽器セレクター)
            </div>
            <div class="flex items-center gap-4">
               <div class="text-gray-500">(マイク)</div>
               <div class="text-gray-500">(録音)</div>
            </div>
          </div>
          
          <!-- テスト用ボタン -->
          <div class="w-full h-40 rounded flex items-center justify-center">
            <button 
              class="px-6 py-3 bg-green-600 hover:bg-green-700 rounded text-white font-bold disabled:opacity-50"
              disabled={!$isConnected || !$isAudioReady}
              on:mousedown={handleTestNoteDown}
              on:mouseup={handleTestNoteUp}
              on:touchstart={handleTestNoteDown}
              on:touchend={handleTestNoteUp}
            >
              Piano C2 (押している間送信)
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}