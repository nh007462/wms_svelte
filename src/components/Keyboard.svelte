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
	// タッチID (number) または 'mouse' -> ルート音名
	let activeTouches = new Map<number | string, string>();
	// 現在鳴っている全ての音（表示用および重複管理用）
	let playingNotes = new Set<string>();

	// 他ユーザーの押下状態
	// Key: 音名 (例: "C4"), Value: Map<User ID, Count> (同じユーザーが重ねて鳴らした場合の対策)
	let remoteActiveKeys = new Map<string, Map<string, number>>();

	export function handleRemoteNote(note: string, type: 'on' | 'off', userId: string) {
		if (!remoteActiveKeys.has(note)) {
			remoteActiveKeys.set(note, new Map());
		}
		const userCounts = remoteActiveKeys.get(note)!;
		const currentCount = userCounts.get(userId) || 0;

		if (type === 'on') {
			userCounts.set(userId, currentCount + 1);
		} else {
			if (currentCount > 0) {
				userCounts.set(userId, currentCount - 1);
				if (userCounts.get(userId) === 0) {
					userCounts.delete(userId);
				}
			}
		}
		remoteActiveKeys = new Map(remoteActiveKeys); // Trigger reactivity
	}

	function getUserColor(userId: string): string {
		if (userId === 'AI') return '#9333ea'; // Purple-600
		let hash = 0;
		for (let i = 0; i < userId.length; i++) {
			hash = userId.charCodeAt(i) + ((hash << 5) - hash);
		}
		const c = (hash & 0x00ffffff).toString(16).toUpperCase();
		// Return solid color (no opacity)
		return '#' + '00000'.substring(0, 6 - c.length) + c;
	}

	function getKeyStyle(
		note: string,
		isBlack: boolean,
		_localNotes: Set<string>,
		_remoteNotes: Map<string, Map<string, number>>
	): string {
		const localActive = _localNotes.has(note);
		const remoteUsersMap = _remoteNotes.get(note);
		const remoteUsers = remoteUsersMap ? Array.from(remoteUsersMap.keys()) : [];
		const remoteCount = remoteUsers.length;

		let background = '';
		let border = '';

		if (localActive && remoteCount > 0) {
			// Local + Remote
			background = isBlack ? '#06b6d4' : '#a5f3fc'; // Cyan-500 / Cyan-200
			const firstRemoteUser = remoteUsers[0];
			const borderColor = getUserColor(firstRemoteUser);
			border = `border: 4px solid ${borderColor}; box-sizing: border-box;`;
		} else if (localActive) {
			// Local only
			background = isBlack ? '#06b6d4' : '#a5f3fc';
		} else if (remoteCount > 0) {
			// Remote only
			if (remoteCount === 1) {
				const userId = remoteUsers[0];
				background = getUserColor(userId);
			} else {
				// Multiple remote users: Stripe
				const colors = remoteUsers.map((u) => getUserColor(u));
				const step = 100 / colors.length;
				const gradientParts = colors.map((c, i) => `${c} ${i * step}%, ${c} ${(i + 1) * step}%`);
				background = `linear-gradient(90deg, ${gradientParts.join(', ')})`;
			}
		} else {
			// Inactive
			background = isBlack ? 'black' : 'white';
		}

		return `background: ${background}; ${border}`;
	}

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

	// 現在の activeTouches と設定に基づいて、鳴らすべき音を計算し、差分を処理する
	function updateAudioState() {
		const desiredNotes = new Set<string>();
		const noteVelocities = new Map<string, number>();

		// 1. activeTouches から鳴らすべき全ての音を収集
		for (const rootNote of activeTouches.values()) {
			let notes: string[] = [];
			let velocity = 1;

			if (chordMode === 'single') {
				notes = [rootNote];
				velocity = 1;
			} else {
				notes = getChordNotes(rootNote);
				velocity = 1;
			}

			notes.forEach((n) => {
				desiredNotes.add(n);
				// 同じ音が複数のソースから鳴る場合、大きい方のベロシティを採用（今回は簡易的に上書き）
				noteVelocities.set(n, velocity);
			});
		}

		// 2. 止めるべき音 (playingNotes にあるが desiredNotes にない)
		for (const note of playingNotes) {
			if (!desiredNotes.has(note)) {
				dispatch('noteUp', note);
				playingNotes.delete(note);
			}
		}

		// 3. 鳴らすべき音 (desiredNotes にあるが playingNotes にない)
		for (const note of desiredNotes) {
			if (!playingNotes.has(note)) {
				const velocity = noteVelocities.get(note) || 1;
				dispatch('noteDown', { note, velocity });
				playingNotes.add(note);
			}
		}

		// Svelteのリアクティビティのために再代入 (新しい参照を作成)
		playingNotes = new Set(playingNotes);
	}

	function handleMouseDown(e: MouseEvent, note: string) {
		if (e.cancelable) e.preventDefault();
		isPointerDown = true;
		activeTouches.set('mouse', note);
		updateAudioState();
	}

	function handleMouseEnter(note: string) {
		if (isPointerDown) {
			activeTouches.set('mouse', note);
			updateAudioState();
		}
	}

	function handleMouseUp() {
		isPointerDown = false;
		activeTouches.delete('mouse');
		updateAudioState();
	}

	function handleTouchStart(e: TouchEvent) {
		if (e.cancelable) e.preventDefault();
		const touches = e.changedTouches;
		for (let i = 0; i < touches.length; i++) {
			const touch = touches[i];
			const element = document.elementFromPoint(touch.clientX, touch.clientY);
			const note = element?.getAttribute('data-note');
			if (note) {
				activeTouches.set(touch.identifier, note);
			}
		}
		updateAudioState();
	}

	function handleTouchMove(e: TouchEvent) {
		if (e.cancelable) e.preventDefault();
		const touches = e.changedTouches;
		for (let i = 0; i < touches.length; i++) {
			const touch = touches[i];
			const element = document.elementFromPoint(touch.clientX, touch.clientY);
			const note = element?.getAttribute('data-note');

			const currentNote = activeTouches.get(touch.identifier);

			if (note) {
				if (currentNote !== note) {
					activeTouches.set(touch.identifier, note);
				}
			} else {
				// 鍵盤外に出た場合
				if (currentNote) {
					activeTouches.delete(touch.identifier);
				}
			}
		}
		updateAudioState();
	}

	function handleTouchEnd(e: TouchEvent) {
		if (e.cancelable) e.preventDefault();
		const touches = e.changedTouches;
		for (let i = 0; i < touches.length; i++) {
			const touch = touches[i];
			activeTouches.delete(touch.identifier);
		}
		updateAudioState();
	}

	onMount(() => {
		window.addEventListener('mouseup', handleMouseUp);
		// touchendは個別に処理するのでwindow全体のリセットは慎重に
		// ただし、画面外で離された場合などを考慮して、touchcancel等はwindowにつけるか、
		// あるいはコンテナにつけるか。ここではコンテナのイベントで十分カバーできるはずだが、
		// 安全のため window で mouseup は監視。
		// touchに関しては、multi-touchの整合性を保つため、個別のイベントハンドラで管理する。

		return () => {
			window.removeEventListener('mouseup', handleMouseUp);
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
		on:touchstart={handleTouchStart}
		on:touchmove={handleTouchMove}
		on:touchend={handleTouchEnd}
		on:touchcancel={handleTouchEnd}
		role="presentation"
	>
		<!-- 白鍵 -->
		<div class="absolute inset-0 flex z-0">
			{#each keys as { note, isBlack }}
				{#if !isBlack}
					<button
						type="button"
						data-note={note}
						on:mousedown={(e) => handleMouseDown(e, note)}
						on:mouseenter={() => handleMouseEnter(note)}
						class="relative h-full border-l border-r border-b border-gray-700 transition-colors duration-75 pointer-events-auto outline-none focus:outline-none"
						style="flex: 1 0 calc(100% / {whiteKeyCount}); {getKeyStyle(
							note,
							false,
							playingNotes,
							remoteActiveKeys
						)}"
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
						aria-label={note}
						data-note={note}
						on:mousedown={(e) => {
							e.stopPropagation();
							handleMouseDown(e, note);
						}}
						on:mouseenter={() => handleMouseEnter(note)}
						class="absolute top-0 h-2/3 w-[60%] border border-gray-700 rounded-b transition-colors duration-75 pointer-events-auto outline-none focus:outline-none"
						style="
							left: calc(({whiteKeyIndex} + {leftOffset}) * (100% / {whiteKeyCount}));
							transform: translateX(-50%);
							max-width: 24px;
							{getKeyStyle(note, true, playingNotes, remoteActiveKeys)}
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
