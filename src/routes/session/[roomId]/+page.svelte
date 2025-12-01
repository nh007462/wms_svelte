<script lang="ts">
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		isAudioReady,
		isLoading,
		selectedInstrument,
		initializeAndLoadAll,
		handleNoteDown as audioHandleNoteDown,
		handleNoteUp as audioHandleNoteUp,
		handleInstrumentChange
	} from '$lib/client/audioLogic.js';
	import { availableInstruments } from '$lib/client/toneManager.js';

	import {
		participants,
		localId,
		localNickname,
		isConnected,
		remoteStreams,
		connectAndJoin,
		disconnect,
		updateLocalStream,
		summonAI,
		dismissAI,
		chatMessages,
		sendChatMessage,
		lastRemoteNoteEvent,
		aiCountdown
	} from '$lib/client/webRTCHandler.js';
	import type { Participant } from '$lib/client/webRTCHandler.js';

	// UIコンポーネント
	import InstrumentSelector from '../../../components/InstrumentSelector.svelte';
	import Keyboard from '../../../components/Keyboard.svelte';
	import Loading from '../../../components/Loading.svelte';
	import NicknameModal from '../../../components/NicknameModal.svelte';
	import MicControl from '../../../components/MicControl.svelte';
	import RecordingControl from '../../../components/RecordingControl.svelte';
	// import Participants from '$components/Participants.svelte';

	const roomId = $page.params.roomId;
	let nickname: string | null = null;
	let isModalOpen = true;
	let isChatOpen = false;
	let isAIThinking = false;
	let keyboard: Keyboard;

	$: isAIHere = $participants.some((p) => p.nickname === 'Gemini-AI');

	// AIからの返信があったらThinkingを消す
	$: if ($chatMessages.length > 0) {
		const lastMsg = $chatMessages[$chatMessages.length - 1];
		if (lastMsg.nickname === 'Gemini-AI') {
			isAIThinking = false;
		}
	}

	function handleToggleAI() {
		if (!roomId) return;
		if (isAIHere) {
			dismissAI(roomId);
		} else {
			summonAI(roomId);
			alert('AIを呼び出しました！まもなく参加します。');
		}
	}

	onMount(() => {
		// Subscribe to remote note events
		const unsubscribeNotes = lastRemoteNoteEvent.subscribe((event) => {
			if (event && keyboard) {
				keyboard.handleRemoteNote(event.note, event.type, event.userId);
			}
		});

		// ★★★ デバッグ用にwindowオブジェクトに関数を登録 ★★★
		(window as any).debugNoteOn = (note: string) => {
			// ストアから現在の楽器を取得
			let instrument = 'piano'; // デフォルト
			selectedInstrument.subscribe((val) => (instrument = val))(); // ストアから最新の値を取得

			console.log(`Debug: ${instrument} - ${note} ON`);
			audioHandleNoteDown(note, false); // isMultiplayer: false で呼び出し
		};

		(window as any).debugNoteOff = (note: string) => {
			let instrument = 'piano';
			selectedInstrument.subscribe((val) => (instrument = val))();

			console.log(`Debug: ${instrument} - ${note} OFF`);
			audioHandleNoteUp(note, false);
		};

		nickname = localStorage.getItem('nickname');

		return () => {
			unsubscribeNotes();
			disconnect();
		};
	});

	async function handleConfirmNickname(event: CustomEvent<string>) {
		nickname = event.detail;
		if (typeof window !== 'undefined') localStorage.setItem('nickname', nickname);
		isModalOpen = false;
		await initializeAndLoadAll();
	}

	function handleCallAI() {
		if (roomId) {
			summonAI(roomId);
			alert('AIを呼び出しました！まもなく参加します。');
		}
	}

	// ★★★ オーディオの準備ができたら、WebRTC接続を開始 ★★★
	$: if ($isAudioReady && nickname && roomId) {
		// connectAndJoinは isAudioReady が true になった後に自動で実行される
		connectAndJoin(roomId, nickname, $selectedInstrument);
	}

	const testNote = 'C2'; // 送信する音符

	function handleTestNoteDown() {
		if (!$isAudioReady || !$isConnected) {
			console.warn('Audio not ready or not connected via WebRTC.');
			return;
		}
		console.log(`Sending noteOn: ${testNote} with ${$selectedInstrument}`);
		// ★★★ audioLogicの関数を呼び出す ★★★
		audioHandleNoteDown(testNote, true); // true = マルチプレイヤーモード
	}

	function handleTestNoteUp() {
		if (!$isAudioReady || !$isConnected) {
			console.warn('Audio not ready or not connected via WebRTC.');
			return;
		}
		console.log(`Sending noteOff: ${testNote} with ${$selectedInstrument}`);
		// ★★★ audioLogicの関数を呼び出す ★★★
		audioHandleNoteUp(testNote, true); // true = マルチプレイヤーモード
	}

	// Audio要素にストリームをセットするアクション
	function srcObject(node: HTMLMediaElement, stream: MediaStream) {
		node.srcObject = stream;
		node.play().catch((e) => console.error('Error playing audio stream:', e));
		return {
			update(newStream: MediaStream) {
				if (node.srcObject !== newStream) {
					node.srcObject = newStream;
					node.play().catch((e) => console.error('Error playing updated audio stream:', e));
				}
			}
		};
	}

	// 楽器が変更されたら他の参加者に通知
	let previousInstrument = $selectedInstrument;
	$: if ($isAudioReady && $isConnected && $selectedInstrument !== previousInstrument) {
		previousInstrument = $selectedInstrument;
		handleInstrumentChange($selectedInstrument, true);
	}
</script>

<NicknameModal
	isOpen={isModalOpen}
	on:close={() => goto('/rooms')}
	on:confirm={handleConfirmNickname}
/>

{#if !isModalOpen}
	<div class="flex flex-col h-full">
		<!-- 参加者リスト（仮） -->
		<div class="mb-4 p-2 flex flex-col items-center gap-2">
			<div class="flex justify-center items-center gap-4 flex-wrap">
				{#if $localNickname}
					<div class="bg-gray-800 p-3 rounded-lg border border-cyan-500">
						<p class="font-bold text-white">{$localNickname} (You)</p>
						<p class="text-xs text-gray-400">{$selectedInstrument}</p>
					</div>
				{/if}
				{#each $participants as p (p.id)}
					<div class="bg-gray-800 p-3 rounded-lg border border-gray-700">
						<p class="font-bold text-gray-300">{p.nickname}</p>
						<p class="text-xs text-gray-400">{p.instrument}</p>
					</div>
				{/each}
			</div>
		</div>

		<!-- メイン操作エリア -->
		<div class="flex-grow flex flex-col justify-end p-4 bg-gray-800 rounded-t-lg">
			<!-- ★★★ ストアの $isLoading を使用 ★★★ -->
			{#if $isLoading}
				<Loading />
			{:else if !$isAudioReady}
				<div class="text-center text-white animate-pulse">ニックネームを入力してください...</div>
			{:else}
				<div>
					{#if !$isConnected && $participants.length > 0}
						<div class="text-center text-yellow-400 animate-pulse mb-2">他の参加者に接続中...</div>
					{/if}

					<div class="flex items-center justify-center md:justify-between mb-4 flex-wrap gap-4">
						<div class="text-gray-500">
							<InstrumentSelector
								bind:value={$selectedInstrument}
								instrumentList={availableInstruments}
							/>
						</div>
						<div class="flex items-center gap-4">
							<MicControl />
							<RecordingControl />
						</div>
					</div>

					<Keyboard
						bind:this={keyboard}
						on:noteDown={(e) => audioHandleNoteDown(e.detail.note, true, e.detail.velocity)}
						on:noteUp={(e) => audioHandleNoteUp(e.detail, true)}
					/>
				</div>
			{/if}

			<!-- Bottom Controls: Call AI & Chat Toggle -->
			<div class="fixed bottom-4 right-4 flex flex-col gap-2 items-end z-50">
				{#if isChatOpen}
					<div class="w-80 bg-gray-900 rounded-lg p-4 border border-gray-700 shadow-2xl mb-2">
						<div class="flex justify-between items-center mb-2">
							<h3 class="text-white font-bold">Chat with AI</h3>
							<button on:click={() => (isChatOpen = false)} class="text-gray-400 hover:text-white"
								>✕</button
							>
						</div>
						<div class="h-40 overflow-y-auto mb-2 bg-gray-800 p-2 rounded">
							{#each $chatMessages as msg}
								<div class="mb-1">
									<span class="font-bold text-cyan-400">{msg.nickname}:</span>
									<span class="text-white">{msg.message}</span>
								</div>
							{/each}
						</div>
						{#if isAIThinking}
							<div class="text-xs text-cyan-300 animate-pulse mb-2 ml-2">AI is thinking...</div>
						{/if}
						<div class="flex gap-2">
							<input
								type="text"
								placeholder="Type command..."
								class="flex-1 bg-gray-700 text-white px-2 py-1 rounded border border-gray-600 focus:border-cyan-500 outline-none"
								on:keydown={(e) => {
									if (e.key === 'Enter') {
										const input = e.currentTarget;
										if (input.value.trim() && roomId) {
											sendChatMessage(roomId, input.value.trim());
											if (isAIHere) isAIThinking = true;
											input.value = '';
										}
									}
								}}
							/>
						</div>
					</div>
				{/if}

				<div class="flex gap-2">
					<button
						on:click={handleToggleAI}
						class="{isAIHere
							? 'bg-red-600 hover:bg-red-700'
							: 'bg-purple-600 hover:bg-purple-700'} text-white font-bold py-2 px-4 rounded-full shadow-lg transition-all transform hover:scale-105"
					>
						{isAIHere ? '👋 Dismiss AI' : '🤖 Call AI'}
					</button>
					<button
						on:click={() => (isChatOpen = !isChatOpen)}
						class="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-full shadow-lg transition-all transform hover:scale-105"
					>
						💬 Chat
					</button>
				</div>
			</div>
		</div>

		<!-- リモート音声ストリームの再生 -->
		<div class="absolute opacity-0 pointer-events-none">
			{#each $remoteStreams as stream (stream.id)}
				<!-- svelte-ignore a11y-media-has-caption -->
				<audio autoplay playsinline controls use:srcObject={stream}></audio>
			{/each}
		</div>

		<!-- AI Countdown Overlay -->
		{#if $aiCountdown !== null}
			<div class="fixed inset-0 flex items-center justify-center z-[100] pointer-events-none">
				<div
					class="text-[15rem] font-bold text-white drop-shadow-[0_0_15px_rgba(0,0,0,0.8)] animate-bounce"
				>
					{$aiCountdown}
				</div>
			</div>
		{/if}
	</div>
{/if}
