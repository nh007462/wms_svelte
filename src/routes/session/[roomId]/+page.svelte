<script lang="ts">
  import { page } from '$app/stores';

  const roomId = $page.params.roomId;

  // ここに後からWebRTCの接続ロジックや、
  // 参加者リスト、鍵盤などのコンポーネントを配置していきます。
</script>

<div class="flex flex-col items-center justify-center h-full text-center p-4">
  <div class="mb-8">
    <h1 class="text-3xl font-bold">
      <span class="text-gray-400">Room:</span>
      <span class="text-cyan-400">{roomId}</span>
    </h1>
    <p class="text-gray-500">音楽セッション画面</p>
  </div>

  <div class="w-full max-w-4xl p-4 border-2 border-dashed border-gray-700 rounded-lg">
    <p class="text-gray-600">（ここに後で参加者リストや鍵盤などのUIが表示されます）</p>
  </div>
</div>