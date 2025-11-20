<script lang="ts">
	import { onDestroy } from 'svelte';
	import { toneManager } from '$lib/client/toneManager.js';
	import { updateLocalStream } from '$lib/client/webRTCHandler.js';

	let isMicOn = false;
	let errorMsg = '';

	async function toggleMic() {
		try {
			if (isMicOn) {
				// Turn off
				await toneManager.toggleMic(false);
				updateLocalStream(null);
				isMicOn = false;
			} else {
				// Turn on
				const stream = await toneManager.toggleMic(true);
				if (stream) {
					updateLocalStream(stream);
					isMicOn = true;
					errorMsg = '';
				} else {
					errorMsg = 'マイクの起動に失敗しました';
				}
			}
		} catch (err) {
			console.error('マイクの切り替えエラー:', err);
			errorMsg = 'エラーが発生しました';
		}
	}

	onDestroy(() => {
		if (isMicOn) {
			toneManager.toggleMic(false);
		}
	});
</script>

<div class="flex flex-col items-center">
	<button
		class="flex items-center justify-center w-12 h-12 rounded-full transition-all shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-500"
		class:bg-red-500={isMicOn}
		class:hover:bg-red-600={isMicOn}
		class:bg-gray-700={!isMicOn}
		class:hover:bg-gray-600={!isMicOn}
		on:click={toggleMic}
		title={isMicOn ? 'マイクをオフにする' : 'マイクをオンにする'}
	>
		{#if isMicOn}
			<!-- マイクONアイコン -->
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-6 w-6 text-white"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
				/>
			</svg>
		{:else}
			<!-- マイクOFFアイコン -->
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-6 w-6 text-gray-400"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
				/>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18" />
			</svg>
		{/if}
	</button>
	{#if errorMsg}
		<span class="text-xs text-red-400 mt-1">{errorMsg}</span>
	{/if}
</div>
