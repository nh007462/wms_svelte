// svelte.config.js
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(),

		// $lib エイリアスを公式推奨の方法で設定
		alias: {
			$lib: path.resolve('./src/lib')
		}
	}
};

export default config;
