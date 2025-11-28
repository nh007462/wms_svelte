
<script lang="ts">
  export let value: string; // 選択中の楽器
  export let onChange: (instrument: string) => void; // オプション（使わなくてもOK）
  export let instrumentList: string[]; // 楽器リスト

  // 表示用の整形関数
  const formatInstrument = (inst: string): string =>
    inst.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
</script>

<div class="flex items-center gap-2">
  <label for="instrument-select" class="font-bold text-white">楽器:</label>
  <select
    id="instrument-select"
    bind:value={value}
    on:change={() => onChange ? onChange(value) : null}
    class="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
  >
    {#each instrumentList as inst}
      <option value={inst}>{formatInstrument(inst)}</option>
    {/each}
  </select>
</div>
