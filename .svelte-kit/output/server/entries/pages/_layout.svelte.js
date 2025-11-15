import { U as store_get, V as unsubscribe_stores } from "../../chunks/index2.js";
import { p as page } from "../../chunks/stores.js";
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { children } = $$props;
    let isSettingsPage = store_get($$store_subs ??= {}, "$page", page).url.pathname.startsWith("/session/") || store_get($$store_subs ??= {}, "$page", page).url.pathname.startsWith("/practice");
    $$renderer2.push(`<nav class="sticky top-0 z-50 bg-blue-600 border-b border-blue-500 dark:bg-blue-900"><div class="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-1 h-16"><span class="self-center text-2xl font-bold text-white tracking-wide"><a href="/" class="text-white hover:text-blue-200">WebRTC Music Session</a></span> `);
    if (isSettingsPage) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="space-x-6"><a href="/rooms" class="bg-red-600 text-white font-bold py-2 px-4 rounded hover:bg-red-600">退出する</a></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div></nav> `);
    children($$renderer2);
    $$renderer2.push(`<!---->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _layout as default
};
