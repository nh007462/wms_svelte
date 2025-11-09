<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	interface RoomCounts {
		[key: string]: { count: number };
	}

	let roomCounts: RoomCounts = {};
	const roomCount = 50;
	const rooms = Array.from({ length: roomCount }, (_, i) => i + 1);
	const MAX_USERS_PER_ROOM = 5;

	async function fetchRoomCounts() {
		try {
			const res = await fetch('/api/rooms');
			if (res.ok) {
				roomCounts = await res.json();
			}
		} catch (err) {
			console.error('Failed to fetch room counts:', err);
		}
	}

	onMount(() => {
		fetchRoomCounts();
		const interval = setInterval(fetchRoomCounts, 5000);
		return () => clearInterval(interval);
	});

	function handleRoomClick(roomId: number) {
		const count = roomCounts[roomId]?.count || 0;
		if (count >= MAX_USERS_PER_ROOM) {
			alert('このルームは満員です。');
			return;
		}
		goto(`/session/${roomId}`);
	}
</script>

<div class="flex flex-col items-center w-full py-8 bg-gray-900 text-white min-h-screen">
	<div class="w-full flex flex-col sm:flex-row justify-between items-center mb-8 gap-4 px-4">
		<h1 class="text-3xl font-bold">ルーム選択</h1>
		<a
			href="/practice"
			class="w-full sm:w-auto text-center px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors duration-200"
		>
			一人練習モードに入る
		</a>
	</div>

	<p class="mb-6 text-gray-400">参加したいルームを選択してください。（満員のルームには入れません）</p>

	<div class="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 px-4">
		{#each rooms as roomId}
			{@const count = roomCounts[roomId]?.count || 0}
			{@const isFull = count >= MAX_USERS_PER_ROOM}
			<button
				class={`aspect-square flex flex-col items-center justify-center transition-all duration-200 transform rounded-lg border-2 
					${isFull
						? 'bg-gray-800 border-gray-700 cursor-not-allowed'
						: 'bg-gray-800 hover:bg-cyan-800 border-gray-700 hover:border-cyan-500 hover:scale-105'}`}
				on:click={() => handleRoomClick(roomId)}
				disabled={isFull}
			>
				<span class={`text-xl font-bold ${isFull ? 'text-gray-600' : 'text-white'}`}>Room {roomId}</span>
				<span
					class={`text-lg font-semibold mt-2 ${
						isFull ? 'text-red-500' : count > 0 ? 'text-cyan-400' : 'text-gray-500'
					}`}
				>
					{count} / {MAX_USERS_PER_ROOM} 人
				</span>
			</button>
		{/each}
	</div>
</div>

