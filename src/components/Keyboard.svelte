<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';

	const dispatch = createEventDispatcher();

	const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

	// 鍵盤設定
	const keyConfigs = [
		{ label: '49鍵', startIndex: 0, endIndex: 49, startOctave: 3 },
		{ label: '61鍵', startIndex: 0, endIndex: 61, startOctave: 2 },
		{ label: '76鍵', startIndex: 4, endIndex: 80, startOctave: 1 },
		{ label: '88鍵', startIndex: 9, endIndex: 97, startOctave: 0 }
	];

	let currentConfigIndex = 1; // デフォルト61鍵
	$: currentConfig = keyConfigs[currentConfigIndex];

	let keys: { note: string; isBlack: boolean; whiteKeyIndex: number; leftOffset?: number }[] = [];
	let whiteKeyCount = 0;

	// 鍵盤生成ロジック
	$: {
		const tempKeys: { note: string; isBlack: boolean; whiteKeyIndex: number }[] = [];
		let whiteIndex = 0;

		// 全音域生成（余裕を持って）
		const allNotes: { note: string; isBlack: boolean }[] = [];
		for (let octave = 0; octave <= 8; octave++) {
			for (let i = 0; i < 12; i++) {
				const note = noteNames[i] + octave;
				const isBlack = note.includes('#');
				allNotes.push({ note, isBlack });
			}
		}

		// 設定に基づいてスライス
		const slicedNotes = allNotes.slice(
			currentConfig.startIndex + currentConfig.startOctave * 12,
			currentConfig.startIndex + currentConfig.startOctave * 12 + currentConfig.endIndex
		);

		// 白鍵インデックスを割り当て
		slicedNotes.forEach((n) => {
			if (n.isBlack) {
				// 黒鍵は直前の白鍵に関連付ける
				tempKeys.push({ ...n, whiteKeyIndex: whiteIndex - 1 });
			} else {
				// 白鍵は現在のインデックスを使用し、カウンタを進める
				tempKeys.push({ ...n, whiteKeyIndex: whiteIndex++ });
			}
		});

		whiteKeyCount = whiteIndex; // 最後のwhiteIndexが総数

		// 黒鍵の位置計算
		// index + 1.0 が白鍵の右端（次の白鍵との境界）
		keys = tempKeys.map((k) => {
			let leftOffset = 0;
			if (k.isBlack) {
				const noteName = k.note.slice(0, -1);

				// 基本的に白鍵と白鍵の間（境界線上）に配置するので 1.0 を基準にする
				// 微調整を行う場合はここを変更
				if (noteName.startsWith('C')) leftOffset = 1.0;
				else if (noteName.startsWith('D')) leftOffset = 1.0;
				else if (noteName.startsWith('F')) leftOffset = 1.0;
				else if (noteName.startsWith('G')) leftOffset = 1.0;
				else if (noteName.startsWith('A')) leftOffset = 1.0;

				return { ...k, leftOffset };
			}
			return k;
		});
	}

	let isPointerDown = false;
	let activeKey: string | null = null;

	function triggerNoteDown(note: string) {
		if (activeKey !== note) {
			if (activeKey) dispatch('noteUp', activeKey);
			activeKey = note;
			dispatch('noteDown', note);
		}
	}

	function triggerNoteUp(note: string) {
		if (activeKey === note) {
			dispatch('noteUp', note);
			activeKey = null;
		}
	}

	function releaseAll() {
		if (activeKey) {
			dispatch('noteUp', activeKey);
			activeKey = null;
		}
		isPointerDown = false;
	}

	function handlePointerDown(e: Event, note: string) {
		if (e.cancelable) e.preventDefault();
		isPointerDown = true;
		triggerNoteDown(note);
	}

	function handleMouseEnter(note: string) {
		if (isPointerDown) triggerNoteDown(note);
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isPointerDown) return;
		if (e.cancelable) e.preventDefault();
		const touch = e.touches[0];
		const element = document.elementFromPoint(touch.clientX, touch.clientY);
		const note = element?.getAttribute('data-note');
		if (note) triggerNoteDown(note);
		else if (activeKey) {
			dispatch('noteUp', activeKey);
			activeKey = null;
		}
	}

	onMount(() => {
		window.addEventListener('mouseup', releaseAll);
		window.addEventListener('touchend', releaseAll);
		return () => {
			window.removeEventListener('mouseup', releaseAll);
			window.removeEventListener('touchend', releaseAll);
		};
	});
</script>

<div class="flex flex-col space-y-2 select-none">
	<!-- 鍵盤数切り替えボタン -->
	<div class="flex justify-center space-x-2">
		{#each keyConfigs as config, i}
			<button
				class="px-3 py-1 text-sm rounded border transition-colors"
				class:bg-cyan-600={currentConfigIndex === i}
				class:text-white={currentConfigIndex === i}
				class:bg-gray-700={currentConfigIndex !== i}
				class:text-gray-300={currentConfigIndex !== i}
				on:click={() => (currentConfigIndex = i)}
			>
				{config.label}
			</button>
		{/each}
	</div>

	<!-- 鍵盤エリア -->
	<div
		class="relative w-full h-40 bg-gray-900 rounded-b-lg overflow-hidden touch-none"
		on:touchmove={handleTouchMove}
		role="presentation"
	>
		<!-- 白鍵 -->
		<div class="absolute inset-0 flex z-0">
			{#each keys as { note, isBlack }}
				{#if !isBlack}
					<button
						type="button"
						data-note={note}
						on:mousedown={(e) => handlePointerDown(e, note)}
						on:mouseenter={() => handleMouseEnter(note)}
						on:touchstart={(e) => handlePointerDown(e, note)}
						class="relative h-full border-l border-r border-b border-gray-700 transition-colors duration-75 pointer-events-auto outline-none focus:outline-none"
						class:bg-cyan-200={activeKey === note}
						class:bg-white={activeKey !== note}
						style="flex: 1 0 calc(100% / {whiteKeyCount});"
					>
						<span
							class="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-gray-500 pointer-events-none"
						>
							{note}
						</span>
					</button>
				{/if}
			{/each}
		</div>

		<!-- 黒鍵 -->
		<div class="absolute inset-0 pointer-events-none z-10">
			{#each keys as { note, isBlack, whiteKeyIndex, leftOffset }}
				{#if isBlack}
					<button
						type="button"
						data-note={note}
						on:mousedown={(e) => {
							e.stopPropagation();
							handlePointerDown(e, note);
						}}
						on:mouseenter={() => handleMouseEnter(note)}
						on:touchstart={(e) => {
							e.stopPropagation();
							handlePointerDown(e, note);
						}}
						class="absolute top-0 h-2/3 w-[60%] border border-gray-700 rounded-b transition-colors duration-75 pointer-events-auto outline-none focus:outline-none"
						class:bg-cyan-500={activeKey === note}
						class:bg-black={activeKey !== note}
						style="
							left: calc(({whiteKeyIndex} + {leftOffset}) * (100% / {whiteKeyCount}));
							transform: translateX(-50%);
							max-width: 24px;
						"
					></button>
				{/if}
			{/each}
		</div>
	</div>
</div>
