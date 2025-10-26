<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  export let isOpen: boolean;

  let nickname = '';
  let inputElement: HTMLInputElement; // input要素への参照

  const dispatch = createEventDispatcher();

  function handleSubmit() {
    if (nickname.trim()) {
      dispatch('confirm', nickname.trim());
    }
  }

  // モーダルが開かれた時にlocalStorageから復元し、inputにフォーカス
  onMount(() => {
    if (typeof window !== 'undefined') {
      nickname = localStorage.getItem('nickname') || '';
    }
  });

  // isOpenがtrueに変わったらフォーカス
  $: if (isOpen && inputElement) {
    // 少し遅延させないとフォーカスが当たらない場合がある
    setTimeout(() => {
        inputElement.focus();
    }, 100);
  }

</script>

{#if isOpen}
  <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
    <div class="bg-gray-800 rounded-lg p-8 max-w-sm w-full shadow-xl border border-gray-700">
      <h2 class="text-2xl font-bold mb-4 text-white">ニックネームを入力</h2>
      <form on:submit|preventDefault={handleSubmit}>
        <input
          bind:this={inputElement}
          type="text"
          bind:value={nickname}
          placeholder="ニックネーム (必須)"
          class="w-full px-4 py-2 mb-4 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          maxLength={15}
          required
        />
        <div class="flex justify-end">
          <button
            type="submit"
            class="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-md transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
            disabled={!nickname.trim()}
          >
            決定
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}