import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeToggle } from './ThemeToggle';
import { setThemePreference, THEME_STORAGE_KEY, resolveTheme } from '../../utils/theme';

describe('Dark / light mode toggle', () => {
  beforeEach(() => {
    act(() => setThemePreference('light'));
  });

  it('starts in light mode and offers dark mode', () => {
    render(<ThemeToggle />);
    const button = screen.getByTestId('theme-toggle-btn');
    expect(button).toHaveAttribute('aria-label', 'Switch to dark mode');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('switches to dark mode, sets the html class and remembers the choice', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByTestId('theme-toggle-btn'));

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(screen.getByTestId('theme-toggle-btn')).toHaveAttribute('aria-label', 'Switch to light mode');
  });

  it('switches back to light mode on a second click', () => {
    render(<ThemeToggle />);
    const button = screen.getByTestId('theme-toggle-btn');
    fireEvent.click(button);
    fireEvent.click(button);

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('falls back to light when following the system and matchMedia is unavailable', () => {
    expect(resolveTheme('system')).toBe('light');
  });
});
