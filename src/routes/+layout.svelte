<script>
	let { children } = $props();
	import '../app.css';
	import { page } from '$app/stores';
	let isSettingsPage = $derived(
		$page.url.pathname.startsWith('/session/') || $page.url.pathname.startsWith('/practice')
	);
</script>

<nav class="bg-blue-600 border-b border-blue-500 dark:bg-blue-900">
	<div class="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-1 h-16">
		<span class="self-center text-2xl font-bold text-white tracking-wide">
			<a href="/" class="text-white hover:text-blue-200"> WebRTC Music Session </a>
		</span>
		{#if isSettingsPage}
			<div class="space-x-6 ">
				<a href="/rooms" class="bg-red-600 text-white font-bold py-2 px-4 rounded hover:bg-red-600">
					退出する
				</a>
			</div>
		{/if}
	</div>
</nav>

{@render children()}
