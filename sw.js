/* Korea Travel Bible — service worker (koreatravelbible.com)
 *
 * Deliberately passive: install/activate only, and NO fetch handler.
 * Nothing is cached and no request is intercepted, so a new deploy can never be
 * held back by a stale cache; Chrome shows its own offline page when there is
 * no network. Registered from the site's landing pages so the installed app
 * (manifest.json) has a worker, and so this file can grow a cache strategy
 * later without changing the pages.
 *
 * The KTB web app on seoultravelinsider.blogspot.com is a different origin and
 * cannot use this worker — it relies on Chrome's one-tap install instead.
 */
const KTB_SW_VERSION = 'ktb-sw-2026-11-28a';

self.addEventListener('install', (event) => {
  // Take over as soon as possible; there is no precache to fill.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'KTB_SW_VERSION') {
    event.source && event.source.postMessage({ type: 'KTB_SW_VERSION', version: KTB_SW_VERSION });
  }
});
