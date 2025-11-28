
<script lang="ts">
  // 楽器選択ロジックを本番コードと同じにする
  import InstrumentSelector from '../../components/InstrumentSelector.svelte';
  import Keyboard from '../../components/Keyboard.svelte';

  // 本番と同じストア・関数を利用
  import {
    isAudioReady,
    selectedInstrument,
    handleInstrumentChange,
    handleNoteDown as audioHandleNoteDown,
    handleNoteUp as audioHandleNoteUp
  } from '$lib/client/audioLogic.js';
  import { availableInstruments } from '$lib/client/toneManager.js';

  // 鍵盤のテスト用
  const testNote = 'C4';

  function handleTestNoteDown() {
    if (!$isAudioReady) {
      console.warn('Audio not ready.');
      return;
    }
    audioHandleNoteDown(testNote, false);
  }

  function handleTestNoteUp() {
    if (!$isAudioReady) {
      console.warn('Audio not ready.');
      return;
    }
    audioHandleNoteUp(testNote, false);
  }

  // 楽器変更を監視して通知（本番コードと同じ仕組み）
  let previousInstrument = $selectedInstrument;
  $: if ($isAudioReady && $selectedInstrument !== previousInstrument) {
    previousInstrument = $selectedInstrument;
    handleInstrumentChange($selectedInstrument, false);
  }
</script>

<div class="p-4 space-y-4">
  <!-- 楽器選択UI -->
  <InstrumentSelector
    bind:value={$selectedInstrument}
    instrumentList={availableInstruments}
  />

  <!-- テスト用ボタン -->
  <div class="flex gap-4">
    <button
      class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-500"
      on:click={handleTestNoteDown}
    >
      Note Down ({testNote})
    </button>
    <button
      class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500"
      on:click={handleTestNoteUp}
    >
      Note Up ({testNote})
    </button>
  </div>

  <!-- 鍵盤コンポーネント -->
  <Keyboard
    on:noteDown={(e) => audioHandleNoteDown(e.detail.note, false, e.detail.velocity)}
    on:noteUp={(e) => audioHandleNoteUp(e.detail.note, false)}
  />
</div>
