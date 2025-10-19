<script lang="ts">
  import { onMount } from 'svelte';
  // 以前作成した toneManager をインポートします
  import { toneManager } from '$lib/client/toneManager.js'; 

  let isAudioReady = false;

  // ユーザーがクリックした時にオーディオを開始する関数
  async function initializeAudio() {
    if (isAudioReady) return;
    
    try {
      // toneManagerの初期化メソッドを呼び出します
      await toneManager.init();
      isAudioReady = true;
      console.log("AudioContext and toneManager initialized!");
    } catch (e) {
      console.error("Audio initialization failed:", e);
    }
  }

  onMount(() => {
    // デベロッパーツールから toneManager を操作できるように、
    // windowオブジェクトに設定します
    (window as any).tm = toneManager;
    
    console.log("toneManager is ready. You can now use 'tm' in the console.");
    console.log("Example: await tm.loadInstrument('piano')");
    console.log("Then: tm.noteOn('piano', 'C4')");
  });
</script>

<main class="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
  <div 
    class="text-center p-8 border border-dashed border-gray-600 rounded-lg cursor-pointer"
    on:click={initializeAudio}
  >
    <h1 class="text-3xl font-bold">WebRTC Music Session (Svelte)</h1>
    
    {#if !isAudioReady}
      <p class="mt-4 text-lg animate-pulse">ここをクリックしてオーディオを有効にしてください</p>
    {:else}
      <p class="mt-4 text-lg text-green-400">オーディオは有効です ✅</p>
    {/if}
    
    <p class="mt-8 text-sm text-gray-400">
      デベロッパーツール（F12）を開き、コンソールで<br>
      <code class="bg-gray-700 p-1 rounded">await tm.loadInstrument('piano')</code>
      <br>と入力してピアノを読み込み、<br>
      <code class="bg-gray-700 p-1 rounded">tm.noteOn('piano', 'C4')</code>
      <br>で音を鳴らしてみてください。
    </p>
  </div>
</main>