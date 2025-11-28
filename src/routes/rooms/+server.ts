// src/routes/rooms/+server.ts
import type { RequestHandler } from '@sveltejs/kit';
import { rooms } from '$lib/server/signaling';

export const GET: RequestHandler = async () => {
	const roomCounts: Record<string, { count: number }> = {};

	// rooms が {} の場合も安全に処理できるようにする
	if (!rooms || typeof rooms !== 'object') {
		return new Response(JSON.stringify({}), {
			headers: { 'Content-Type': 'application/json' }
		});
	}

	for (const [roomId, roomData] of Object.entries(rooms)) {
		roomCounts[roomId] = { count: Object.keys(roomData).length };
	}

	return new Response(JSON.stringify(roomCounts), {
		headers: { 'Content-Type': 'application/json' }
	});
};
