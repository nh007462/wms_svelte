import "clsx";
import "../../../chunks/toneManager.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    $$renderer2.push(`<main class="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4"><div class="text-center p-8 border border-dashed border-gray-600 rounded-lg cursor-pointer"><h1 class="text-3xl font-bold">WebRTC Music Session (Svelte)</h1> `);
    {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<p class="mt-4 text-lg animate-pulse">ここをクリックしてオーディオを有効にしてください</p>`);
    }
    $$renderer2.push(`<!--]--> <p class="mt-8 text-sm text-gray-400">デベロッパーツール（F12）を開き、コンソールで<br/> <code class="bg-gray-700 p-1 rounded">await tm.loadInstrument('piano')</code> <br/>と入力してピアノを読み込み、<br/> <code class="bg-gray-700 p-1 rounded">tm.noteOn('piano', 'C4')</code> <br/>で音を鳴らしてみてください。</p></div></main>`);
  });
}
export {
  _page as default
};
