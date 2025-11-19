<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { availableInstruments } from '$lib/client/toneManager.js';
	import {
		isAudioReady,
		isLoading,
		selectedInstrument,
		initializeAndLoadAll,
		handleNoteDown,
		handleNoteUp
	} from '$lib/client/audioLogic.js';

	import Keyboard from '../../components/Keyboard.svelte';
	import InstrumentSelector from '../../components/InstrumentSelector.svelte';
	import Loading from '../../components/Loading.svelte';

	// 最初のクリック/タップでオーディオ初期化
	async function handleInitAudio() {
		await initializeAndLoadAll();
	}

	function onNoteDown(event: CustomEvent<string>) {
		if (!$isAudioReady) return;
		// 練習モード: isMultiplayer = false
		handleNoteDown(event.detail, false);
	}

	function onNoteUp(event: CustomEvent<string>) {
		if (!$isAudioReady) return;
		handleNoteUp(event.detail, false);
	}
</script>

<div
	class="flex flex-col h-full"
	on:click={handleInitAudio}
	on:touchstart={handleInitAudio}
	role="presentation"
>
	<div class="text-center p-4 bg-gray-800 rounded-lg mb-4">
		<h2 class="text-xl font-bold text-cyan-400">一人練習モード</h2>
	</div>
	<div class="flex-grow flex flex-col justify-end p-4 bg-gray-800 rounded-t-lg">
		{#if !$isAudioReady}
			<div
				class="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
			>
				<button
					class="px-6 py-3 text-xl font-semibold text-white bg-cyan-600 rounded-lg shadow hover:bg-cyan-500 transition-all"
					on:click|stopPropagation={handleInitAudio}
					on:touchstart|stopPropagation={handleInitAudio}
				>
					🎹 タップして開始
				</button>
			</div>
		{:else if $isLoading}
			<Loading />
		{:else}
			<div class="mb-4 flex justify-center">
				<InstrumentSelector
					bind:value={$selectedInstrument}
					instrumentList={availableInstruments}
				/>
			</div>

			<Keyboard on:noteDown={onNoteDown} on:noteUp={onNoteUp} />
		{/if}
	</div>
</div>
