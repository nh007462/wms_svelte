<script lang="ts">
	import { toneManager } from '$lib/client/toneManager.js';
	import { remoteStreams } from '$lib/client/webRTCHandler.js';
	import { onDestroy } from 'svelte';

	let isRecording = false;

	function toggleRecording() {
		if (isRecording) {
			toneManager.stopRecording();
			isRecording = false;
		} else {
			toneManager.startRecording($remoteStreams);
			isRecording = true;
		}
	}

	onDestroy(() => {
		if (isRecording) {
			toneManager.stopRecording();
		}
	});
</script>

<div class="flex flex-col items-center">
	<button
		class="flex items-center justify-center w-12 h-12 rounded-full transition-all shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-red-500"
		class:bg-red-600={isRecording}
		class:hover:bg-red-700={isRecording}
		class:animate-pulse={isRecording}
		class:bg-gray-700={!isRecording}
		class:hover:bg-gray-600={!isRecording}
		on:click={toggleRecording}
		title={isRecording ? '録音を停止' : '録音を開始'}
	>
		{#if isRecording}
			<!-- 停止アイコン (四角) -->
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-6 w-6 text-white"
				fill="currentColor"
				viewBox="0 0 24 24"
			>
				<rect x="6" y="6" width="12" height="12" rx="1" />
			</svg>
		{:else}
			<!-- 録音アイコン (丸) -->
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-6 w-6 text-red-500"
				fill="currentColor"
				viewBox="0 0 24 24"
			>
				<circle cx="12" cy="12" r="6" />
			</svg>
		{/if}
	</button>
</div>
