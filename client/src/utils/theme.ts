/**
 * Dark/light theme store.
 *
 * The preference is 'light', 'dark' or 'system' (follow the OS). It is saved in localStorage and
 * applied as the `dark` class on <html>, which swaps the CSS variables in index.css.
 * Kept as a tiny module-level store (no React provider) so any component can read it, and tests
 * that render a component on its own need no extra wrapper.
 */

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'webchat_theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

type Listener = () => void;
const listeners = new Set<Listener>();

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // Storage can be unavailable (private mode, blocked cookies): fall back to the OS setting.
  }
  return 'system';
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(DARK_QUERY).matches
    : false;
}

let preference: ThemePreference = readStoredPreference();

export function resolveTheme(pref: ThemePreference = preference): ResolvedTheme {
  if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return pref;
}

let snapshot: { preference: ThemePreference; theme: ResolvedTheme } = {
  preference,
  theme: resolveTheme(preference),
};

function applyToDocument(theme: ResolvedTheme, animate: boolean): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (animate) {
    root.classList.add('theme-transition');
    window.setTimeout(() => root.classList.remove('theme-transition'), 250);
  }
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.theme = theme;
}

function update(animate: boolean): void {
  const theme = resolveTheme(preference);
  const changed = theme !== snapshot.theme || preference !== snapshot.preference;
  snapshot = { preference, theme };
  applyToDocument(theme, animate && changed);
  if (changed) listeners.forEach((listener) => listener());
}

export function getThemeSnapshot() {
  return snapshot;
}

export function subscribeTheme(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setThemePreference(next: ThemePreference): void {
  preference = next;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Not persisted, but still applied for this visit.
  }
  update(true);
}

/** Switch to the opposite of what is on screen now (an explicit choice, no longer 'system'). */
export function toggleTheme(): void {
  setThemePreference(snapshot.theme === 'dark' ? 'light' : 'dark');
}

let initialized = false;

/**
 * Apply the saved theme before React renders (the CSP forbids an inline <script> in index.html),
 * and follow OS changes while the preference is 'system'. Safe to call more than once.
 */
export function initTheme(): void {
  if (initialized) return;
  initialized = true;
  preference = readStoredPreference();
  update(false);

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => {
      if (preference === 'system') update(true);
    };
    if (typeof media.addEventListener === 'function') media.addEventListener('change', onChange);
    else if (typeof media.addListener === 'function') media.addListener(onChange);
  }

  // Keep tabs in sync when the theme is changed in another tab.
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      preference = readStoredPreference();
      update(true);
    });
  }
}
