'use client';

/**
 * Material You 3 Theme Provider
 * 
 * Provides M3 Expressive theming with support for:
 * - Light/dark/system theme modes
 * - Dynamic color scheme generation from seed color
 * - Smooth theme transitions (300ms as per M3 spec)
 * 
 * Requirements: 1.2, 11.3
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import {
  M3ThemeContext,
  DEFAULT_SEED_COLOR,
  type ThemeMode,
  type ResolvedTheme,
  type M3ThemeContextValue,
} from './context';
import {
  generateColorScheme,
  generateDarkColorScheme,
  isValidHexColor,
  type M3ColorScheme,
} from '../tokens/color';

/**
 * Props for M3ThemeProvider
 */
export interface M3ThemeProviderProps {
  /** Child components */
  children: React.ReactNode;
  /** Initial theme mode (default: 'system') */
  defaultMode?: ThemeMode;
  /** Initial seed color for dynamic color generation */
  defaultSeedColor?: string;
  /** Storage key for persisting theme preference */
  storageKey?: string;
  /** Disable theme transition animations */
  disableTransitionOnChange?: boolean;
}

/**
 * Internal provider that handles M3 theme logic
 */
function M3ThemeProviderInternal({
  children,
  defaultSeedColor = DEFAULT_SEED_COLOR,
}: {
  children: React.ReactNode;
  defaultSeedColor?: string;
}) {
  const { theme, setTheme, resolvedTheme, systemTheme } = useTheme();
  const [seedColor, setSeedColorState] = useState(defaultSeedColor);

  // Generate color schemes from seed color
  const lightColorScheme = useMemo(
    () => generateColorScheme(isValidHexColor(seedColor) ? seedColor : DEFAULT_SEED_COLOR),
    [seedColor]
  );

  const darkColorScheme = useMemo(
    () => generateDarkColorScheme(isValidHexColor(seedColor) ? seedColor : DEFAULT_SEED_COLOR),
    [seedColor]
  );

  // Determine resolved theme
  const resolved: ResolvedTheme = useMemo(() => {
    if (resolvedTheme === 'dark') return 'dark';
    if (resolvedTheme === 'light') return 'light';
    // Fallback to system preference
    return systemTheme === 'dark' ? 'dark' : 'light';
  }, [resolvedTheme, systemTheme]);

  // Get active color scheme based on resolved theme
  const colorScheme = useMemo(
    () => (resolved === 'dark' ? darkColorScheme : lightColorScheme),
    [resolved, darkColorScheme, lightColorScheme]
  );

  // Convert next-themes theme to ThemeMode
  const mode: ThemeMode = useMemo(() => {
    if (theme === 'light') return 'light';
    if (theme === 'dark') return 'dark';
    return 'system';
  }, [theme]);

  // Set theme mode
  const setMode = useCallback(
    (newMode: ThemeMode) => {
      setTheme(newMode);
    },
    [setTheme]
  );

  // Set seed color with validation
  const setSeedColor = useCallback((color: string) => {
    if (isValidHexColor(color)) {
      setSeedColorState(color);
    }
  }, []);

  // Toggle between light and dark
  const toggleTheme = useCallback(() => {
    if (resolved === 'dark') {
      setTheme('light');
    } else {
      setTheme('dark');
    }
  }, [resolved, setTheme]);

  // Apply CSS custom properties for the color scheme
  // DISABLED: We are using manual CSS variables in globals.css for the Matcha theme
  // and do not want programmatic overrides from the seed color generator.
  /*
  useEffect(() => {
    const root = document.documentElement;
    const scheme = colorScheme;

    // Apply all color tokens as CSS custom properties
    root.style.setProperty('--md-sys-color-primary', scheme.primary);
    root.style.setProperty('--md-sys-color-on-primary', scheme.onPrimary);
    root.style.setProperty('--md-sys-color-primary-container', scheme.primaryContainer);
    root.style.setProperty('--md-sys-color-on-primary-container', scheme.onPrimaryContainer);

    root.style.setProperty('--md-sys-color-secondary', scheme.secondary);
    root.style.setProperty('--md-sys-color-on-secondary', scheme.onSecondary);
    root.style.setProperty('--md-sys-color-secondary-container', scheme.secondaryContainer);
    root.style.setProperty('--md-sys-color-on-secondary-container', scheme.onSecondaryContainer);

    root.style.setProperty('--md-sys-color-tertiary', scheme.tertiary);
    root.style.setProperty('--md-sys-color-on-tertiary', scheme.onTertiary);
    root.style.setProperty('--md-sys-color-tertiary-container', scheme.tertiaryContainer);
    root.style.setProperty('--md-sys-color-on-tertiary-container', scheme.onTertiaryContainer);

    root.style.setProperty('--md-sys-color-error', scheme.error);
    root.style.setProperty('--md-sys-color-on-error', scheme.onError);
    root.style.setProperty('--md-sys-color-error-container', scheme.errorContainer);
    root.style.setProperty('--md-sys-color-on-error-container', scheme.onErrorContainer);

    root.style.setProperty('--md-sys-color-surface', scheme.surface);
    root.style.setProperty('--md-sys-color-on-surface', scheme.onSurface);
    root.style.setProperty('--md-sys-color-surface-variant', scheme.surfaceVariant);
    root.style.setProperty('--md-sys-color-on-surface-variant', scheme.onSurfaceVariant);
    root.style.setProperty('--md-sys-color-surface-dim', scheme.surfaceDim);
    root.style.setProperty('--md-sys-color-surface-bright', scheme.surfaceBright);
    root.style.setProperty('--md-sys-color-surface-container-lowest', scheme.surfaceContainerLowest);
    root.style.setProperty('--md-sys-color-surface-container-low', scheme.surfaceContainerLow);
    root.style.setProperty('--md-sys-color-surface-container', scheme.surfaceContainer);
    root.style.setProperty('--md-sys-color-surface-container-high', scheme.surfaceContainerHigh);
    root.style.setProperty('--md-sys-color-surface-container-highest', scheme.surfaceContainerHighest);

    root.style.setProperty('--md-sys-color-outline', scheme.outline);
    root.style.setProperty('--md-sys-color-outline-variant', scheme.outlineVariant);
    root.style.setProperty('--md-sys-color-shadow', scheme.shadow);
    root.style.setProperty('--md-sys-color-scrim', scheme.scrim);
    root.style.setProperty('--md-sys-color-inverse-surface', scheme.inverseSurface);
    root.style.setProperty('--md-sys-color-inverse-on-surface', scheme.inverseOnSurface);
    root.style.setProperty('--md-sys-color-inverse-primary', scheme.inversePrimary);
  }, [colorScheme]);
  */

  const contextValue: M3ThemeContextValue = useMemo(
    () => ({
      mode,
      resolvedTheme: resolved,
      seedColor,
      lightColorScheme,
      darkColorScheme,
      colorScheme,
      setMode,
      setSeedColor,
      toggleTheme,
    }),
    [mode, resolved, seedColor, lightColorScheme, darkColorScheme, colorScheme, setMode, setSeedColor, toggleTheme]
  );

  return (
    <M3ThemeContext.Provider value={contextValue}>
      {children}
    </M3ThemeContext.Provider>
  );
}

/**
 * M3 Theme Provider Component
 * 
 * Wraps the application with M3 theming support.
 * Uses next-themes for theme persistence and system preference detection.
 * 
 * @example
 * ```tsx
 * <M3ThemeProvider defaultMode="system" defaultSeedColor="#6750A4">
 *   <App />
 * </M3ThemeProvider>
 * ```
 */
export function M3ThemeProvider({
  children,
  defaultMode = 'system',
  defaultSeedColor = DEFAULT_SEED_COLOR,
  storageKey = 'theme',
  disableTransitionOnChange = false,
}: M3ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultMode}
      enableSystem
      storageKey={storageKey}
      disableTransitionOnChange={disableTransitionOnChange}
    >
      <M3ThemeProviderInternal defaultSeedColor={defaultSeedColor}>
        {children}
      </M3ThemeProviderInternal>
    </NextThemesProvider>
  );
}
