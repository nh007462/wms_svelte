import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { setupWebSocket } from './src/lib/server/signaling.js';

export default defineConfig({
	plugins: [
		tailwindcss(),
    	sveltekit(),
		{
			name: 'webSocketServer-dev',
			apply: 'serve', 
			configureServer(server) {
				if (server.httpServer) {
					setupWebSocket(server.httpServer);
				}
			}
		}
	]
});
