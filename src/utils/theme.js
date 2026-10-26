import { useSyncExternalStore } from 'react';

// Appearance: 'paper' (Ink & Paper, light), 'night' (night ink, dark) or
// 'system' (follow the device). Local to this device on purpose - which
// palette suits depends on the screen and the room, not the account.
const THEME_KEY = 'hz_theme';
const THEME_COLORS = { paper: '#EDE6D8', night: '#100E0B' };
const darkQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const listeners = new Set();

export function getThemePref() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'paper' || saved === 'night' ? saved : 'system';
  } catch {
    return 'system';
  }
}

function resolve(pref) {
  if (pref !== 'system') return pref;
  return darkQuery?.matches ? 'night' : 'paper';
}

export function getResolvedTheme() {
  return document.documentElement.dataset.theme || resolve(getThemePref());
}

/** Puts the resolved palette on <html data-theme> (see index.css). */
export function applyTheme(pref = getThemePref()) {
  const theme = resolve(pref);
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  listeners.forEach((l) => l());
}

export function setThemePref(pref) {
  try {
    if (pref === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {
    // localStorage unavailable - still applies for this visit
  }
  applyTheme(pref);
}

/** Re-applies when the device switches light/dark while on 'system'. */
export function watchSystemTheme() {
  darkQuery?.addEventListener('change', () => {
    if (getThemePref() === 'system') applyTheme('system');
  });
}

/** The resolved theme ('paper' | 'night'), re-rendering on change - for
 * things that read colours once rather than through CSS (HanziWriter). */
export function useResolvedTheme() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getResolvedTheme
  );
}

/** A theme token's current value, e.g. cssVar('--hanzi-stroke'). */
export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
