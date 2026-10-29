/**
 * Appearance: 'system' follows the OS (daisyUI's prefersdark theme),
 * 'light' and 'dark' pin one of the two daisyUI themes.
 */
export const THEMES = { light: 'queue', dark: 'queue-night' };
const KEY = 'ytpm:theme';

export function savedTheme() {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', THEMES[theme]);
  try {
    if (theme === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    /* storage blocked: the choice lasts for this visit */
  }
}
