/**
 * **Feature: material-you-3-expressive-redesign, Property 1: Color Scheme Generation Completeness**
 * **Validates: Requirements 1.1, 1.2, 1.3**
 * 
 * Property: For any valid seed color (hex string), the color scheme generator SHALL produce
 * a complete M3ColorScheme object containing all required color tokens (primary, secondary,
 * tertiary, error, and all surface variants) with valid hex color values.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  generateColorScheme,
  M3_COLOR_KEYS,
  isValidHexColor,
  M3ColorScheme,
} from './color';

// Configure fast-check to run minimum 100 iterations
fc.configureGlobal({ numRuns: 100 });

/**
 * Arbitrary for generating valid hex colors
 */
const validHexColorArb = fc.tuple(
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 })
).map(([r, g, b]) => {
  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
});

describe('Property 1: Color Scheme Generation Completeness', () => {
  it('should generate a complete M3ColorScheme with all required color tokens for any valid seed color', () => {
    fc.assert(
      fc.property(validHexColorArb, (seedColor) => {
        const scheme = generateColorScheme(seedColor);

        // Verify all required keys are present
        for (const key of M3_COLOR_KEYS) {
          expect(scheme).toHaveProperty(key);
        }

        // Verify the scheme has exactly the expected number of keys
        expect(Object.keys(scheme).length).toBe(M3_COLOR_KEYS.length);
      })
    );
  });

  it('should generate valid hex color values for all color tokens', () => {
    fc.assert(
      fc.property(validHexColorArb, (seedColor) => {
        const scheme = generateColorScheme(seedColor);

        // Verify all values are valid hex colors
        for (const key of M3_COLOR_KEYS) {
          const colorValue = scheme[key];
          expect(isValidHexColor(colorValue)).toBe(true);
        }
      })
    );
  });

  it('should include all primary color variants', () => {
    fc.assert(
      fc.property(validHexColorArb, (seedColor) => {
        const scheme = generateColorScheme(seedColor);

        // Primary colors
        expect(isValidHexColor(scheme.primary)).toBe(true);
        expect(isValidHexColor(scheme.onPrimary)).toBe(true);
        expect(isValidHexColor(scheme.primaryContainer)).toBe(true);
        expect(isValidHexColor(scheme.onPrimaryContainer)).toBe(true);
      })
    );
  });

  it('should include all secondary color variants', () => {
    fc.assert(
      fc.property(validHexColorArb, (seedColor) => {
        const scheme = generateColorScheme(seedColor);

        // Secondary colors
        expect(isValidHexColor(scheme.secondary)).toBe(true);
        expect(isValidHexColor(scheme.onSecondary)).toBe(true);
        expect(isValidHexColor(scheme.secondaryContainer)).toBe(true);
        expect(isValidHexColor(scheme.onSecondaryContainer)).toBe(true);
      })
    );
  });

  it('should include all tertiary color variants', () => {
    fc.assert(
      fc.property(validHexColorArb, (seedColor) => {
        const scheme = generateColorScheme(seedColor);

        // Tertiary colors
        expect(isValidHexColor(scheme.tertiary)).toBe(true);
        expect(isValidHexColor(scheme.onTertiary)).toBe(true);
        expect(isValidHexColor(scheme.tertiaryContainer)).toBe(true);
        expect(isValidHexColor(scheme.onTertiaryContainer)).toBe(true);
      })
    );
  });

  it('should include all error color variants', () => {
    fc.assert(
      fc.property(validHexColorArb, (seedColor) => {
        const scheme = generateColorScheme(seedColor);

        // Error colors
        expect(isValidHexColor(scheme.error)).toBe(true);
        expect(isValidHexColor(scheme.onError)).toBe(true);
        expect(isValidHexColor(scheme.errorContainer)).toBe(true);
        expect(isValidHexColor(scheme.onErrorContainer)).toBe(true);
      })
    );
  });

  it('should include all surface color variants', () => {
    fc.assert(
      fc.property(validHexColorArb, (seedColor) => {
        const scheme = generateColorScheme(seedColor);

        // Surface colors
        expect(isValidHexColor(scheme.surface)).toBe(true);
        expect(isValidHexColor(scheme.onSurface)).toBe(true);
        expect(isValidHexColor(scheme.surfaceVariant)).toBe(true);
        expect(isValidHexColor(scheme.onSurfaceVariant)).toBe(true);
        expect(isValidHexColor(scheme.surfaceDim)).toBe(true);
        expect(isValidHexColor(scheme.surfaceBright)).toBe(true);
        expect(isValidHexColor(scheme.surfaceContainerLowest)).toBe(true);
        expect(isValidHexColor(scheme.surfaceContainerLow)).toBe(true);
        expect(isValidHexColor(scheme.surfaceContainer)).toBe(true);
        expect(isValidHexColor(scheme.surfaceContainerHigh)).toBe(true);
        expect(isValidHexColor(scheme.surfaceContainerHighest)).toBe(true);
      })
    );
  });

  it('should throw an error for invalid seed colors', () => {
    const invalidColors = ['invalid', '#GGG', 'rgb(0,0,0)', '#12345', ''];
    
    for (const invalidColor of invalidColors) {
      expect(() => generateColorScheme(invalidColor)).toThrow();
    }
  });
});
