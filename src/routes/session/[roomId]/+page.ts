import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types.js';

export const load: PageLoad = ({ params }) => {
	const roomId = parseInt(params.roomId, 10);

	if (isNaN(roomId) || roomId < 1 || roomId > 50) {
		throw redirect(303, '/rooms');
	}

	return {
		roomId
	};
};
