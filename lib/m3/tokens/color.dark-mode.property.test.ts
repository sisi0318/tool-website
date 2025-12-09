/**
 * **Feature: material-you-3-expressive-redesign, Property 9: Dark Mode Color Scheme Validity**
 * **Validates: Requirements 11.1**
 * 
 * Property: For any dark mode color scheme, all surface colors SHALL use tonal elevation
 * (lighter surface colors for higher elevation) instead of shadow elevation.
 * 
 * In M3 dark mode, visual hierarchy is created through tonal elevation:
 * - Higher elevation surfaces have lighter colors
 * - surfaceContainerLowest < surfaceContainerLow < surfaceContainer < surfaceContainerHigh < surfaceContainerHighest
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  generateDarkColorScheme,
  M3_COLOR_KEYS,
  isValidHexColor,
  hexToRgb,
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

/**
 * Calculates the perceived luminance of a color
 * Higher values = lighter colors
 */
function calculateLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  // Use relative luminance formula (simplified)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

describe('Property 9: Dark Mode Color Scheme Validity', () => {
  it('should generate a complete dark mode color scheme with all required tokens', () => {
    fc.assert(
      fc.property(validHexColorArb, (seedColor) => {
        const scheme = generateDarkColorScheme(seedColor);

        // Verify all required keys are present
        for (const key of M3_COLOR_KEYS) {
          expect(scheme).toHaveProperty(key);
        }

        // Verify all values are valid hex colors
        for (const key of M3_COLOR_KEYS) {
          expect(isValidHexColor(scheme[key])).toBe(true);
        }
      })
    );
  });

  it('should use tonal elevation for surface containers (higher elevation = lighter color)', () => {
    fc.assert(
      fc.property(validHexColorArb, (seedColor) => {
        const scheme = generateDarkColorScheme(seedColor);

        // Get luminance values for surface containers
        const lowestLum = calculateLuminance(scheme.surfaceContainerLowest);
        const lowLum = calculateLuminance(scheme.surfaceContainerLow);
        const containerLum = calculateLuminance(scheme.surfaceContainer);
        const highLum = calculateLuminance(scheme.surfaceContainerHigh);
        const highestLum = calculateLuminance(scheme.surfaceContainerHighest);

        // In dark mode with tonal elevation:
        // Higher elevation surfaces should be lighter (higher luminance)
        // surfaceContainerLowest <= surfaceContainerLow <= surfaceContainer <= surfaceContainerHigh <= surfaceContainerHighest
        expect(lowestLum).toBeLessThanOrEqual(lowLum + 0.01); // Small tolerance for rounding
        expect(lowLum).toBeLessThanOrEqual(containerLum + 0.01);
        expect(containerLum).toBeLessThanOrEqual(highLum + 0.01);
        expect(highLum).toBeLessThanOrEqual(highestLum + 0.01);
      })
    );
  });

  it('should have dark surface colors (low luminance base surface)', () => {
    fc.assert(
      fc.property(validHexColorArb, (seedColor) => {
        const scheme = generateDarkColorScheme(seedColor);

        // Base surface should be dark (luminance < 0.2)
        const surfaceLum = calculateLuminance(scheme.surface);
        expect(surfaceLum).toBeLessThan(0.2);

        // surfaceDim should also be dark
        const surfaceDimLum = calculateLuminance(scheme.surfaceDim);
        expect(surfaceDimLum).toBeLessThan(0.2);
      })
    );
  });

  it('should have light on-surface colors for contrast', () => {
    fc.assert(
      fc.property(validHexColorArb, (seedColor) => {
        const scheme = generateDarkColorScheme(seedColor);

        // on-surface should be light (luminance > 0.7)
        const onSurfaceLum = calculateLuminance(scheme.onSurface);
        expect(onSurfaceLum).toBeGreaterThan(0.7);
      })
    );
  });

  it('should have surfaceBright lighter than surface', () => {
    fc.assert(
      fc.property(validHexColorArb, (seedColor) => {
        const scheme = generateDarkColorScheme(seedColor);

        const surfaceLum = calculateLuminance(scheme.surface);
        const surfaceBrightLum = calculateLuminance(scheme.surfaceBright);

        // surfaceBright should be lighter than surface
        expect(surfaceBrightLum).toBeGreaterThan(surfaceLum);
      })
    );
  });

  it('should have inverted primary colors compared to light mode', () => {
    fc.assert(
      fc.property(validHexColorArb, (seedColor) => {
        const scheme = generateDarkColorScheme(seedColor);

        // In dark mode, primary should be lighter (higher luminance)
        // and onPrimary should be darker
        const primaryLum = calculateLuminance(scheme.primary);
        const onPrimaryLum = calculateLuminance(scheme.onPrimary);

        // Primary should be lighter than onPrimary in dark mode
        expect(primaryLum).toBeGreaterThan(onPrimaryLum);
      })
    );
  });

  it('should throw an error for invalid seed colors', () => {
    const invalidColors = ['invalid', '#GGG', 'rgb(0,0,0)', '#12345', ''];
    
    for (const invalidColor of invalidColors) {
      expect(() => generateDarkColorScheme(invalidColor)).toThrow();
    }
  });
});
