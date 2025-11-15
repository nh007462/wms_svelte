import { W as attr, X as bind_props, U as store_get, V as unsubscribe_stores } from "../../../../chunks/index2.js";
import { p as page } from "../../../../chunks/stores.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "clsx";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/state.svelte.js";
import { w as writable } from "../../../../chunks/index.js";
import "../../../../chunks/toneManager.js";
const isAudioReady = writable(false);
function NicknameModal($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let isOpen = $$props["isOpen"];
    let nickname = "";
    let inputElement;
    if (isOpen && inputElement) {
      setTimeout(
        () => {
          inputElement.focus();
        },
        100
      );
    }
    if (isOpen) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"><div class="bg-gray-800 rounded-lg p-8 max-w-sm w-full shadow-xl border border-gray-700"><h2 class="text-2xl font-bold mb-4 text-white">ニックネームを入力</h2> <form><input type="text"${attr("value", nickname)} placeholder="ニックネーム (必須)" class="w-full px-4 py-2 mb-4 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"${attr("maxlength", 15)} required/> <div class="flex justify-end"><button type="submit" class="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-md transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"${attr("disabled", !nickname.trim(), true)}>決定</button></div></form></div></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { isOpen });
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    store_get($$store_subs ??= {}, "$page", page).params.roomId;
    let nickname = null;
    let isModalOpen = true;
    if (store_get($$store_subs ??= {}, "$isAudioReady", isAudioReady) && nickname) ;
    NicknameModal($$renderer2, {
      isOpen: (
        // 送信する音符
        // ★★★ audioLogicの関数を呼び出す ★★★
        // true = マルチプレイヤーモード
        // ★★★ audioLogicの関数を呼び出す ★★★
        // true = マルチプレイヤーモード
        isModalOpen
      )
    });
    $$renderer2.push(`<!----> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
