<script lang="ts">
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  
  const octaveCount = 3; // デフォルトで3オクターブ分の鍵盤を生成
  let keys: { note: string; isBlack: boolean; whiteKeyIndex: number }[] = [];
  let whiteKeyCount = 0;

  function generateKeys(octaves: number) {
    const keyData: { note: string; isBlack: boolean; whiteKeyIndex: number }[] = [];
    let whiteIndex = 0;

    for (let octave = 1; octave <= octaves; octave++) {
      for (let i = 0; i < 12; i++) {
        const note = noteNames[i] + octave;
        const isBlack = note.includes('#');
        keyData.push({ note, isBlack, whiteKeyIndex: whiteIndex });
        if (!isBlack) whiteIndex++;
      }
    }

    keys = keyData;
    whiteKeyCount = keyData.filter(k => !k.isBlack).length;
  }

  generateKeys(octaveCount);
</script>

<!-- UI -->
<div class="p-4">
  <div class="mt-4 relative w-full h-40 bg-gray-900 rounded-b-lg overflow-hidden select-none touch-manipulation">
    <!-- 白鍵 -->
    <div class="absolute inset-0 flex overflow-x-auto">
      {#each keys as { note, isBlack }}
        {#if !isBlack}
          <div
            class="relative h-full w-8 border-l border-r border-b border-gray-700 bg-white flex items-end justify-center text-xs text-gray-500"
            style="flex: 1 0 calc(100% / {whiteKeyCount})"
          >
            {note}
          </div>
        {/if}
      {/each}
    </div>

    <!-- 黒鍵 -->
    <div class="absolute inset-0 flex pointer-events-none overflow-x-auto">
      {#each keys as { note, isBlack, whiteKeyIndex }}
        {#if isBlack}
          <div
            class="absolute top-0 h-2/3 w-[55%] bg-black border border-gray-700 rounded-b z-10"
            style="left: calc(({whiteKeyIndex} / {whiteKeyCount}) * 100% - (100% / {whiteKeyCount} / 4)); max-width: 20px;"
          ></div>
        {/if}
      {/each}
    </div>
  </div>
</div>
<script lang="ts">
  // ピアノの音名（1オクターブ分）
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  // 表示するオクターブ数（固定値）
  const octaveCount = 3;

  // 鍵盤データを格納する配列
  let keys: { note: string; isBlack: boolean; whiteKeyIndex: number }[] = [];

  // 白鍵の総数（黒鍵の位置計算に必要）
  let whiteKeyCount = 0;

  /**
   * 鍵盤データを生成する関数
   * - 指定されたオクターブ数分の音名を作成
   * - 白鍵・黒鍵の判定と位置情報を付与
   */
  function generateKeys(octaves: number) {
    const keyData: { note: string; isBlack: boolean; whiteKeyIndex: number }[] = [];
    let whiteIndex = 0;

    // オクターブ数分ループ
    for (let octave = 1; octave <= octaves; octave++) {
      // 1オクターブ内の12音を生成
      for (let i = 0; i < 12; i++) {
        const note = noteNames[i] + octave; // 例: C1, D#2
        const isBlack = note.includes('#'); // 黒鍵かどうか判定
        keyData.push({ note, isBlack, whiteKeyIndex: whiteIndex });
        if (!isBlack) whiteIndex++; // 白鍵ならインデックスを増加
      }
    }

    keys = keyData;
    whiteKeyCount = keyData.filter(k => !k.isBlack).length; // 白鍵の総数を計算
  }

  // 初期化（3オクターブ分の鍵盤を生成）
  generateKeys(octaveCount);

  /**
   * イベントハンドラ（中身は空）
   * - 鍵盤を押したときの処理
   * - 鍵盤を離したときの処理
   * ※後で音を鳴らす処理を追加する
   */
  function handleNoteDown(note: string) {
    // ここに処理を追加
  }

  function handleNoteUp(note: string) {
    // ここに処理を追加
  }
</script>

<!-- UI部分 -->
<div class="p-4">
  <!-- 鍵盤全体のコンテナ -->
  <div class="mt-4 relative w-full h-40 bg-gray-900 rounded-b-lg overflow-hidden select-none touch-manipulation">
    
    <!-- 白鍵の描画 -->
    <div class="absolute inset-0 flex overflow-x-auto">
      {#each keys as { note, isBlack }}
        {#if !isBlack}
          <button
            data-note={note}
            on:mousedown={() => {}} <!-- クリック時の処理（空） -->
            on:mouseup={() => {}}   <!-- 離した時の処理（空） -->
            class="relative h-full w-8 border-l border-r border-b border-gray-700 bg-white transition-colors duration-75"
            style="flex: 1 0 calc(100% / {whiteKeyCount})"
          >
            <!-- 音名を表示 -->
            <span class="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-gray-500 pointer-events-none">{note}</span>
          </button>
        {/if}
      {/each}
    </div>

    <!-- 黒鍵の描画 -->
    <div class="absolute inset-0 flex pointer-events-none overflow-x-auto">
      {#each keys as { note, isBlack, whiteKeyIndex }}
        {#if isBlack}
          <button
            data-note={note}
            on:mousedown={() => {}} <!-- クリック時の処理（空） -->
            on:mouseup={() => {}}   <!-- 離した時の処理（空） -->
            class="absolute top-0 h-2/3 w-[55%] bg-black border border-gray-700 rounded-b z-10 pointer-events-auto transition-colors duration-75"
            style="left: calc(({whiteKeyIndex} / {whiteKeyCount}) * 100% - (100% / {whiteKeyCount} / 4)); max-width: 20px;"
          ></button>
        {/if}
      {/each}
    </div>
  </div>
</div>
