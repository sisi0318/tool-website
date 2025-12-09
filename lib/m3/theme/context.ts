'use client';

/**
 * Material You 3 Theme Context
 * 
 * Provides theme context for M3 Expressive design system.
 * Supports light/dark/system theme modes with dynamic color scheme generation.
 * 
 * Requirements: 1.2, 11.3
 */

import { createContext, useContext } from 'react';
import type { M3ColorScheme } from '../tokens/color';

/**
 * Theme mode options
 * - light: Always use light theme
 * - dark: Always use dark theme
 * - system: Follow system preference
 */
export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Resolved theme (actual theme being displayed)
 */
export type ResolvedTheme = 'light' | 'dark';

/**
 * M3 Theme context value interface
 */
export interface M3ThemeContextValue {
  /** Current theme mode setting (light/dark/system) */
  mode: ThemeMode;
  /** Resolved theme being displayed (light/dark) */
  resolvedTheme: ResolvedTheme;
  /** Current seed color for dynamic color generation */
  seedColor: string;
  /** Light mode color scheme */
  lightColorScheme: M3ColorScheme;
  /** Dark mode color scheme */
  darkColorScheme: M3ColorScheme;
  /** Active color scheme based on resolved theme */
  colorScheme: M3ColorScheme;
  /** Set the theme mode */
  setMode: (mode: ThemeMode) => void;
  /** Set the seed color for dynamic color generation */
  setSeedColor: (color: string) => void;
  /** Toggle between light and dark mode */
  toggleTheme: () => void;
}

/**
 * Default seed color (M3 default purple)
 */
export const DEFAULT_SEED_COLOR = '#6750A4';

/**
 * M3 Theme Context
 */
export const M3ThemeContext = createContext<M3ThemeContextValue | null>(null);

/**
 * Hook to access M3 theme context
 * 
 * @returns M3ThemeContextValue
 * @throws Error if used outside of M3ThemeProvider
 */
export function useM3Theme(): M3ThemeContextValue {
  const context = useContext(M3ThemeContext);
  if (!context) {
    throw new Error('useM3Theme must be used within an M3ThemeProvider');
  }
  return context;
}

/**
 * Hook to get the current color scheme
 * Convenience hook for accessing just the active color scheme
 * 
 * @returns The active M3ColorScheme
 */
export function useM3ColorScheme(): M3ColorScheme {
  const { colorScheme } = useM3Theme();
  return colorScheme;
}

/**
 * Hook to get theme mode utilities
 * 
 * @returns Object with mode, setMode, and toggleTheme
 */
export function useM3ThemeMode() {
  const { mode, resolvedTheme, setMode, toggleTheme } = useM3Theme();
  return { mode, resolvedTheme, setMode, toggleTheme };
}
