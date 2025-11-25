<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { setVolume } from '$lib/client/audioLogic.js';

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

	// 詳細設定
	let isSettingsOpen = false;
	let volume = 0; // dB
	let chordMode: 'single' | 'triad' | 'seventh' = 'single';
	let selectedChordType = 'Major';

	const triadTypes = ['Major', 'Minor', 'Augmented', 'Diminished'];
	const seventhTypes = [
		'Major 7th',
		'Minor 7th',
		'Dominant 7th',
		'Minor 7th flat 5',
		'Diminished 7th',
		'Minor Major 7th'
	];

	$: currentChordTypes =
		chordMode === 'triad' ? triadTypes : chordMode === 'seventh' ? seventhTypes : [];

	// 和音タイプが切り替わった時にデフォルトを選択
	$: if (chordMode === 'triad' && !triadTypes.includes(selectedChordType))
		selectedChordType = 'Major';
	$: if (chordMode === 'seventh' && !seventhTypes.includes(selectedChordType))
		selectedChordType = 'Major 7th';

	// 音量変更
	function handleVolumeChange(e: Event) {
		const val = parseFloat((e.target as HTMLInputElement).value);
		volume = val;
		setVolume(volume);
	}

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
	let activeChordNotes: string[] = [];

	function getNoteIndex(note: string): number {
		const name = note.slice(0, -1);
		const octave = parseInt(note.slice(-1));
		return octave * 12 + noteNames.indexOf(name);
	}

	function getNoteFromIndex(index: number): string {
		const octave = Math.floor(index / 12);
		const name = noteNames[index % 12];
		return name + octave;
	}

	function getChordNotes(rootNote: string): string[] {
		const rootIndex = getNoteIndex(rootNote);
		let intervals: number[] = [];

		if (chordMode === 'triad') {
			switch (selectedChordType) {
				case 'Major':
					intervals = [0, 4, 7];
					break;
				case 'Minor':
					intervals = [0, 3, 7];
					break;
				case 'Augmented':
					intervals = [0, 4, 8];
					break;
				case 'Diminished':
					intervals = [0, 3, 6];
					break;
			}
		} else if (chordMode === 'seventh') {
			switch (selectedChordType) {
				case 'Major 7th':
					intervals = [0, 4, 7, 11];
					break;
				case 'Minor 7th':
					intervals = [0, 3, 7, 10];
					break;
				case 'Dominant 7th':
					intervals = [0, 4, 7, 10];
					break;
				case 'Minor 7th flat 5':
					intervals = [0, 3, 6, 10];
					break;
				case 'Diminished 7th':
					intervals = [0, 3, 6, 9];
					break;
				case 'Minor Major 7th':
					intervals = [0, 3, 7, 11];
					break;
			}
		} else {
			return [rootNote];
		}

		return intervals.map((interval) => getNoteFromIndex(rootIndex + interval));
	}

	function triggerNoteDown(note: string) {
		if (activeKey !== note) {
			if (activeKey) releaseCurrentNote(); // 前の音/和音を消す (ポインター状態は維持)

			activeKey = note;

			if (chordMode === 'single') {
				activeChordNotes = [note];
				dispatch('noteDown', { note, velocity: 1 });
			} else {
				activeChordNotes = getChordNotes(note);
				// 和音の場合はベロシティを下げる (例: 0.6)
				const velocity = 0.6;
				activeChordNotes.forEach((n) => {
					dispatch('noteDown', { note: n, velocity });
				});
			}
		}
	}

	function triggerNoteUp(note: string) {
		if (activeKey === note) {
			activeChordNotes.forEach((n) => {
				dispatch('noteUp', n);
			});
			activeKey = null;
			activeChordNotes = [];
		}
	}

	// ポインター状態をリセットせずに音だけ止める
	function releaseCurrentNote() {
		if (activeKey) {
			activeChordNotes.forEach((n) => {
				dispatch('noteUp', n);
			});
			activeKey = null;
			activeChordNotes = [];
		}
	}

	// 全てリセット（ポインター離脱時）
	function releaseAll() {
		releaseCurrentNote();
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
			releaseCurrentNote();
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
	<!-- 詳細設定ボタン -->
	<div class="flex justify-end">
		<button
			class="px-3 py-1 text-sm rounded border border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
			on:click={() => (isSettingsOpen = !isSettingsOpen)}
		>
			詳細設定
		</button>
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
						class:bg-cyan-200={activeChordNotes.includes(note)}
						class:bg-white={!activeChordNotes.includes(note)}
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
						class:bg-cyan-500={activeChordNotes.includes(note)}
						class:bg-black={!activeChordNotes.includes(note)}
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

	<!-- 詳細設定ボックス -->
	{#if isSettingsOpen}
		<div class="relative bg-gray-800 border border-gray-700 rounded p-4 mt-2 text-gray-300">
			<button
				class="absolute top-2 right-2 text-gray-400 hover:text-white"
				on:click={() => (isSettingsOpen = false)}
			>
				✕
			</button>

			<div class="flex flex-col space-y-4">
				<!-- 音量調整 -->
				<div class="flex flex-col">
					<label for="volume" class="text-xs font-bold mb-1">音量 ({volume} dB)</label>
					<input
						id="volume"
						type="range"
						min="-30"
						max="10"
						step="1"
						value={volume}
						on:input={handleVolumeChange}
						class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
					/>
				</div>

				<!-- 鍵盤数 -->
				<div class="flex flex-col">
					<span class="text-xs font-bold mb-1">鍵盤数</span>
					<div class="flex space-x-2">
						{#each keyConfigs as config, i}
							<button
								class="px-3 py-1 text-xs rounded border transition-colors"
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
				</div>

				<!-- 和音モード -->
				<div class="flex flex-col">
					<span class="text-xs font-bold mb-1">和音モード</span>
					<div class="flex space-x-2 mb-2">
						<button
							class="px-3 py-1 text-xs rounded border transition-colors"
							class:bg-cyan-600={chordMode === 'single'}
							class:text-white={chordMode === 'single'}
							class:bg-gray-700={chordMode !== 'single'}
							on:click={() => (chordMode = 'single')}
						>
							単音
						</button>
						<button
							class="px-3 py-1 text-xs rounded border transition-colors"
							class:bg-cyan-600={chordMode === 'triad'}
							class:text-white={chordMode === 'triad'}
							class:bg-gray-700={chordMode !== 'triad'}
							on:click={() => (chordMode = 'triad')}
						>
							3和音
						</button>
						<button
							class="px-3 py-1 text-xs rounded border transition-colors"
							class:bg-cyan-600={chordMode === 'seventh'}
							class:text-white={chordMode === 'seventh'}
							class:bg-gray-700={chordMode !== 'seventh'}
							on:click={() => (chordMode = 'seventh')}
						>
							4和音
						</button>
					</div>

					<!-- 和音タイプ選択 -->
					{#if chordMode !== 'single'}
						<div class="flex flex-wrap gap-2">
							{#each currentChordTypes as type}
								<button
									class="px-2 py-1 text-xs rounded border transition-colors"
									class:bg-cyan-600={selectedChordType === type}
									class:text-white={selectedChordType === type}
									class:bg-gray-700={selectedChordType !== type}
									on:click={() => (selectedChordType = type)}
								>
									{type}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
