<script lang="ts">
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  const keyConfigs = [
    { label: "49鍵", startIndex: 0, endIndex: 49, startOctave: 3, endOctave: 7 },
    { label: "61鍵", startIndex: 0, endIndex: 61, startOctave: 2, endOctave: 7 },
    { label: "76鍵", startIndex: 4, endIndex: 80, startOctave: 1, endOctave: 7 },
    { label: "88鍵", startIndex: 9, endIndex: 97, startOctave: 0, endOctave: 8 }
  ];

  let currentIndex = 0;
  let currentConfig = keyConfigs[currentIndex];

  let keys: { note: string; isBlack: boolean; whiteKeyIndex: number; left?: number }[] = [];
  let whiteKeyCount = 0;
  let activeKey: string | null = null;

  function generateKeys(config: typeof currentConfig) {
    const keyData: { note: string; isBlack: boolean; whiteKeyIndex: number }[] = [];
    let whiteIndex = 0;

    for (let octave = config.startOctave; octave <= config.endOctave; octave++) {
      for (let i = 0; i < 12; i++) {
        const note = noteNames[i] + octave;
        const isBlack = note.includes("#");
        keyData.push({ note, isBlack, whiteKeyIndex: whiteIndex });
        if (!isBlack) whiteIndex++;
      }
    }

    let slicedKeys = keyData.slice(config.startIndex, config.endIndex);
    whiteKeyCount = slicedKeys.filter(k => !k.isBlack).length;

    // 白鍵インデックス再割り当て
    let newWhiteIndex = 0;
    for (const k of slicedKeys) {
      if (!k.isBlack) {
        k.whiteKeyIndex = newWhiteIndex++;
      }
    }

    // 黒鍵位置計算（前後の白鍵の中間）
    keys = slicedKeys.map((k, i) => {
      if (!k.isBlack) return k;

      const prevWhite = [...slicedKeys].slice(0, i).reverse().find(x => !x.isBlack);
      const nextWhite = [...slicedKeys].slice(i + 1).find(x => !x.isBlack);

      if (prevWhite && nextWhite) {
        k.left = (prevWhite.whiteKeyIndex + nextWhite.whiteKeyIndex + 1) / 2;
      } else if (prevWhite) {
        k.left = prevWhite.whiteKeyIndex + 0.5;
      } else if (nextWhite) {
        k.left = nextWhite.whiteKeyIndex - 0.5;
      }

      return k;
    });
  }

  generateKeys(currentConfig);

  function toggleKeyConfig() {
    currentIndex = (currentIndex + 1) % keyConfigs.length;
    currentConfig = keyConfigs[currentIndex];
    generateKeys(currentConfig);
  }

  // 共通イベントハンドラ
  function handleNoteDown(note: string) {
    activeKey = note;
    // TODO: 音を鳴らす処理を追加
  }

  function handleNoteUp(note: string) {
    if (activeKey === note) activeKey = null;
    // TODO: 音を止める処理を追加
  }
</script>

<div class="p-4 space-y-4">
  <button
    class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
    on:click={toggleKeyConfig}
  >
    鍵盤切り替え（現在: {currentConfig.label}）
  </button>

  <div class="relative w-full h-[200px] bg-gray-900 rounded-b-lg overflow-hidden select-none touch-manipulation">
    <!-- 白鍵 -->
    <div class="absolute inset-0 flex z-0">
      {#each keys as { note, isBlack }}
        {#if !isBlack}
          <button
            data-note={note}
            on:mousedown={() => handleNoteDown(note)}
            on:mouseup={() => handleNoteUp(note)}
            on:mouseleave={() => handleNoteUp(note)}
            class="relative h-full border-l border-r border-b border-gray-700 transition-colors duration-75 bg-white pointer-events-auto"
            class:bg-cyan-200={activeKey === note}
            style="flex: 1 0 calc(100% / {whiteKeyCount});"
          >
            <span class="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-gray-500 pointer-events-none">{note}</span>
          </button>
        {/if}
      {/each}
    </div>

    <!-- 黒鍵 -->
    <div class="absolute inset-0 pointer-events-none z-10">
      {#each keys as { note, isBlack, left }}
        {#if isBlack && left !== undefined}
          <button
            data-note={note}
            on:mousedown={() => handleNoteDown(note)}
            on:mouseup={() => handleNoteUp(note)}
            on:mouseleave={() => handleNoteUp(note)}
            class="absolute top-0 h-2/3 w-[55%] border border-gray-700 rounded-b transition-colors duration-75 bg-black pointer-events-auto"
            class:bg-cyan-500={activeKey === note}
            style="left: calc(({left} / {whiteKeyCount}) * 100%); transform: translateX(-50%); max-width: 22px;"
          ></button>
        {/if}
      {/each}
    </div>
  </div>
</div>