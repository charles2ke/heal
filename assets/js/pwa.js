// Installing Heal as an app, and keeping a copy of it in the browser so that it
// works offline (see sw.js).

// Registers the service worker once the page has loaded, so that saving Heal for
// offline use doesn't slow down the first visit.
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const register = () => navigator.serviceWorker.register(new URL('../../sw.js', import.meta.url)).catch(() => null);
  if (document.readyState === 'complete') register();
  else globalThis.addEventListener('load', register, { once: true });
}

// Resolves once Heal is saved for offline use. Never resolves in a browser that
// can't do that.
export function offlineReady() {
  return 'serviceWorker' in navigator ? navigator.serviceWorker.ready : new Promise(() => {});
}

// Whether Heal is open as an installed app rather than in a browser tab.
export function isStandalone() {
  return Boolean(globalThis.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone);
}
