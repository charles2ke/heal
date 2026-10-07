// Shared page plumbing: safe DOM building, the store, and keeping every open
// tab and every day boundary in sync.

import { toDateKey } from './dates.js';
import { STORAGE_KEY, Store } from './store.js';
import { setupThemeToggle } from './theme.js';

// Builds elements from text only. Nothing user-supplied is ever parsed as HTML.
export function el(tag, options = {}, ...children) {
  const node = document.createElement(tag);
  const { className, text, attrs = {}, on = {} } = options;
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  for (const [name, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    node.setAttribute(name, value === true ? '' : String(value));
  }
  for (const [type, handler] of Object.entries(on)) node.addEventListener(type, handler);
  node.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

// Browsers differ on whether they put a space before hidden text in an accessible
// name, so start it with a space when it continues a visible word.
export function hiddenText(text) {
  return el('span', { className: 'visually-hidden', text });
}

// Updates a live region. Repeating the same message still gets announced.
export function announce(region, message) {
  if (!region) return;
  region.textContent = region.textContent === message ? `${message}\u00a0` : message;
}

// Opens a link in a new tab safely, and says so to screen reader users.
export function externalLink(href, text, className) {
  return el('a', { className, attrs: { href, target: '_blank', rel: 'noopener noreferrer' } }, text, hiddenText(' (opens in a new tab)'));
}

// Sets up the page and calls render(store, today) now, whenever another tab
// changes Heal's data, and when the page is shown again on a new day.
export function startPage(render) {
  const store = new Store();
  const warning = document.getElementById('storage-warning');
  let today = toDateKey();

  const refresh = () => {
    today = toDateKey();
    render(store, today);
    if (warning) warning.hidden = store.persistent;
  };

  globalThis.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    store.reload();
    refresh();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && toDateKey() !== today) refresh();
  });
  setupThemeToggle(document.getElementById('theme-toggle'));
  refresh();

  return {
    store,
    refresh,
    // The date right now, which may be later than the last render.
    today: () => toDateKey(),
    // Applies a change, re-renders and returns whether it was saved.
    async update(change) {
      const saved = await store.update(change);
      refresh();
      return saved;
    },
  };
}
