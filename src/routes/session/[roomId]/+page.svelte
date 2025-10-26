<script lang="ts">
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { toneManager, availableInstruments } from '$lib/client/toneManager.js';
  import {
    participants,
    localId,
    localNickname,
    isConnected,
    remoteStreams,
    connectAndJoin,
    broadcastMessage,
    updateLocalStream,
    disconnect
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
  let isLoading = false;
  let isAudioReady = false;
  let selectedInstrument = 'piano';

  onMount(() => {
    nickname = localStorage.getItem('nickname');
    if (nickname) {
      isModalOpen = false;
      handleInitAudio();
    } else {
      isModalOpen = true;
    }
    return () => {
      disconnect();
    };
  });

  async function handleConfirmNickname(event: CustomEvent<string>) {
    nickname = event.detail;
    if (typeof window !== 'undefined') localStorage.setItem('nickname', nickname);
    isModalOpen = false;
    await handleInitAudio();
  }

  async function handleInitAudio() {
    if (isAudioReady) return;
    isLoading = true;
    try {
      await toneManager.init();
      isAudioReady = true;
      await toneManager.loadAllInstruments();
      if (roomId && nickname) {
        connectAndJoin(roomId, nickname);
      }
    } catch (e) {
      console.error("Initialization or loading failed:", e);
      alert("初期化または楽器の読み込みに失敗しました。");
    } finally {
      isLoading = false;
    }
  }

  function handleInstrumentChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    selectedInstrument = target.value;
    broadcastMessage({ type: 'instrumentChange', instrument: selectedInstrument });
  }

  function handleNoteDown(note: string) {
    if (!isAudioReady || !$isConnected) return;
    toneManager.noteOn(selectedInstrument, note);
    broadcastMessage({ type: 'noteOn', note, instrument: selectedInstrument });
  }

  function handleNoteUp(note: string) {
    if (!isAudioReady || !$isConnected) return;
    toneManager.noteOff(selectedInstrument, note);
    broadcastMessage({ type: 'noteOff', note, instrument: selectedInstrument });
  }

  async function handleMicToggle(enabled: boolean): Promise<boolean> {
    const stream = await toneManager.toggleMic(enabled);
    updateLocalStream(stream);
    return !!stream;
  }

  const testNote = 'C2'; // 送信する音符

  function handleTestNoteDown() {
    if (!isAudioReady || !$isConnected) {
      console.warn("Audio not ready or not connected via WebRTC.");
      return;
    }
    console.log(`Sending noteOn: ${testNote} with ${selectedInstrument}`);
    toneManager.noteOn(selectedInstrument, testNote);
    broadcastMessage({ type: 'noteOn', note: testNote, instrument: selectedInstrument });
  }

  function handleTestNoteUp() {
    if (!isAudioReady || !$isConnected) {
      console.warn("Audio not ready or not connected via WebRTC.");
      return;
    }
    console.log(`Sending noteOff: ${testNote} with ${selectedInstrument}`);
    toneManager.noteOff(selectedInstrument, testNote);
    broadcastMessage({ type: 'noteOff', note: testNote, instrument: selectedInstrument });
  }

</script>

<NicknameModal
  isOpen={isModalOpen}
  on:close={() => goto('/rooms')}
  on:confirm={handleConfirmNickname}
/>

{#if !isModalOpen}
  <div class="flex flex-col h-full" on:click={handleInitAudio} on:touchstart={handleInitAudio}>
    
    <div class="mb-4 p-2">
      <div class="flex justify-center items-center gap-4 flex-wrap">
        {#if $localNickname}
          <div class="bg-gray-800 p-3 rounded-lg border border-cyan-500">
            <p class="font-bold text-white">{$localNickname} (You)</p>
            <p class="text-xs text-gray-400">{selectedInstrument}</p>
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

    <div class="flex-grow flex flex-col justify-end p-4 bg-gray-800 rounded-t-lg">
      {#if isLoading}
        <div class="text-center text-white">全楽器をロード中...</div>
      {:else if !isAudioReady}
        <div class="text-center text-white animate-pulse">画面をクリックしてセッションを開始</div>
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
          
          <div class="w-full h-40 rounded flex items-center justify-center">
            <button 
              class="px-6 py-3 bg-green-600 hover:bg-green-700 rounded text-white font-bold disabled:opacity-50"
              disabled={!$isConnected || !isAudioReady}
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