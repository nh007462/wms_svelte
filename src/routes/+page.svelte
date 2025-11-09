<!-- <h1 class="text-3xl font-bold underline">
  Hello svelte!
</h1>

<style lang="postcss">
  @reference "tailwindcss";

  :global(html) {
    background-color: theme(--color-gray-100);
  }
</style> -->


<script>
	import { goto } from '$app/navigation';

	function goToRooms() {
		goto('/rooms');
	}
</script>

<div class="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
	<h1 class="text-4xl font-bold mb-6">WEB RTC 音楽セッションアプリへようこそ</h1>
	<p class="mb-8 text-gray-400">リアルタイムで音楽セッションを楽しめるアプリです。</p>

	<button
		class="px-8 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors duration-200"
		on:click={goToRooms}
	>
		ルーム選択ページへ進む
	</button>
</div>
