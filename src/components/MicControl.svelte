<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { updateLocalStream } from '$lib/client/webRTCHandler.js';

	let isMicOn = false;
	let localStream: MediaStream | null = null;
	let errorMsg = '';

	async function toggleMic() {
		if (isMicOn) {
			// マイクをオフにする
			if (localStream) {
				localStream.getTracks().forEach((track) => track.stop());
				localStream = null;
			}
			updateLocalStream(null);
			isMicOn = false;
		} else {
			// マイクをオンにする
			try {
				localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
				updateLocalStream(localStream);
				isMicOn = true;
				errorMsg = '';
			} catch (err) {
				console.error('マイクへのアクセスに失敗しました:', err);
				errorMsg = 'マイクへのアクセスが拒否されました';
			}
		}
	}

	onDestroy(() => {
		if (localStream) {
			localStream.getTracks().forEach((track) => track.stop());
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
