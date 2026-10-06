// Light and dark themes. With no saved choice, Heal follows the system setting.
// theme-init.js applies a saved choice before the page paints.

export const THEME_KEY = 'heal:theme';

const listeners = new Set();
const darkQuery = () => globalThis.matchMedia?.('(prefers-color-scheme: dark)') ?? null;

export function savedTheme() {
  try {
    const theme = localStorage.getItem(THEME_KEY);
    return theme === 'dark' || theme === 'light' ? theme : null;
  } catch {
    return null;
  }
}

export function currentTheme() {
  const theme = document.documentElement.dataset.theme;
  if (theme === 'dark' || theme === 'light') return theme;
  return darkQuery()?.matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  for (const listener of listeners) listener();
}

export function setTheme(theme) {
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage is unavailable: the choice lasts until the page is closed.
  }
}

// Goes back to following the system setting.
export function forgetTheme() {
  applyTheme(null);
  try {
    localStorage.removeItem(THEME_KEY);
  } catch {
    // Nothing was saved.
  }
}

export function setupThemeToggle(button) {
  if (!button) return;
  const sync = () => button.setAttribute('aria-pressed', String(currentTheme() === 'dark'));
  listeners.add(sync);
  button.addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'));
  darkQuery()?.addEventListener?.('change', sync);
  globalThis.addEventListener('storage', (event) => {
    if (event.key === THEME_KEY || event.key === null) applyTheme(savedTheme());
  });
  sync();
}
