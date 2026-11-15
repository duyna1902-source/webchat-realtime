import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface ThemeToggleProps {
  className?: string;
}

/** Sun/moon button that switches between light and dark mode. */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { isDark, toggle } = useTheme();
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      data-testid="theme-toggle-btn"
      onClick={toggle}
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      className={`p-1.5 rounded-lg text-google-grey700 hover:bg-google-grey100 hover:text-google-grey900 transition cursor-pointer flex items-center justify-center ${className}`}
    >
      {isDark ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
    </button>
  );
};
