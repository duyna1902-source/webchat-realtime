import { useSyncExternalStore } from 'react';
import {
  getThemeSnapshot,
  setThemePreference,
  subscribeTheme,
  toggleTheme,
  type ResolvedTheme,
  type ThemePreference,
} from '../utils/theme';

export interface UseThemeResult {
  /** What the user chose: 'light', 'dark' or 'system'. */
  preference: ThemePreference;
  /** What is on screen now. */
  theme: ResolvedTheme;
  isDark: boolean;
  setPreference: (next: ThemePreference) => void;
  toggle: () => void;
}

export function useTheme(): UseThemeResult {
  const { preference, theme } = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeSnapshot);
  return {
    preference,
    theme,
    isDark: theme === 'dark',
    setPreference: setThemePreference,
    toggle: toggleTheme,
  };
}
