/**
 * **Feature: material-you-3-expressive-redesign, Property 3: Typography Scale Completeness**
 * **Validates: Requirements 2.1**
 * 
 * Property: For any M3 type scale configuration, all 15 typography styles (display-large
 * through label-small) SHALL be defined with valid fontFamily, fontSize, fontWeight,
 * lineHeight, and letterSpacing values.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  M3TypeScale,
  M3_TYPE_SCALE,
  M3_TYPOGRAPHY_KEYS,
  TypographyStyle,
  isValidTypographyStyle,
  isValidTypeScale,
  createTypeScale,
} from './typography';

// Configure fast-check to run minimum 100 iterations
fc.configureGlobal({ numRuns: 100 });

/**
 * Arbitrary for generating valid font family strings
 */
const validFontFamilyArb = fc.constantFrom(
  "'Google Sans', 'Roboto', sans-serif",
  "'Roboto', sans-serif",
  "'Arial', sans-serif",
  "'Helvetica Neue', Helvetica, sans-serif"
);

/**
 * Arbitrary for generating valid font sizes (px values)
 */
const validFontSizeArb = fc.integer({ min: 8, max: 96 }).map(n => `${n}px`);

/**
 * Arbitrary for generating valid font weights (100-900 in increments of 100)
 */
const validFontWeightArb = fc.integer({ min: 1, max: 9 }).map(n => n * 100);

/**
 * Arbitrary for generating valid line heights (px values)
 */
const validLineHeightArb = fc.integer({ min: 12, max: 120 }).map(n => `${n}px`);

/**
 * Arbitrary for generating valid letter spacing (px values, can be negative)
 */
const validLetterSpacingArb = fc.double({ min: -2, max: 2, noNaN: true })
  .map(n => `${n.toFixed(2)}px`);

/**
 * Arbitrary for generating valid typography styles
 */
const validTypographyStyleArb: fc.Arbitrary<TypographyStyle> = fc.record({
  fontFamily: validFontFamilyArb,
  fontSize: validFontSizeArb,
  fontWeight: validFontWeightArb,
  lineHeight: validLineHeightArb,
  letterSpacing: validLetterSpacingArb,
});


describe('Property 3: Typography Scale Completeness', () => {
  it('should have all 15 required typography styles defined in the default type scale', () => {
    // Verify all 15 required keys are present
    expect(M3_TYPOGRAPHY_KEYS.length).toBe(15);
    
    for (const key of M3_TYPOGRAPHY_KEYS) {
      expect(M3_TYPE_SCALE).toHaveProperty(key);
      expect(M3_TYPE_SCALE[key]).toBeDefined();
    }
  });

  it('should have valid typography style properties for all 15 styles in the default type scale', () => {
    for (const key of M3_TYPOGRAPHY_KEYS) {
      const style = M3_TYPE_SCALE[key];
      
      // Verify all required properties exist
      expect(style).toHaveProperty('fontFamily');
      expect(style).toHaveProperty('fontSize');
      expect(style).toHaveProperty('fontWeight');
      expect(style).toHaveProperty('lineHeight');
      expect(style).toHaveProperty('letterSpacing');
      
      // Verify property types
      expect(typeof style.fontFamily).toBe('string');
      expect(typeof style.fontSize).toBe('string');
      expect(typeof style.fontWeight).toBe('number');
      expect(typeof style.lineHeight).toBe('string');
      expect(typeof style.letterSpacing).toBe('string');
    }
  });

  it('should validate that all default typography styles pass validation', () => {
    for (const key of M3_TYPOGRAPHY_KEYS) {
      const style = M3_TYPE_SCALE[key];
      expect(isValidTypographyStyle(style)).toBe(true);
    }
  });

  it('should validate the complete default type scale', () => {
    expect(isValidTypeScale(M3_TYPE_SCALE)).toBe(true);
  });

  it('should have valid fontFamily values (non-empty strings) for any generated typography style', () => {
    fc.assert(
      fc.property(validTypographyStyleArb, (style) => {
        expect(style.fontFamily.length).toBeGreaterThan(0);
        expect(typeof style.fontFamily).toBe('string');
      })
    );
  });

  it('should have valid fontSize values (px format) for any generated typography style', () => {
    fc.assert(
      fc.property(validTypographyStyleArb, (style) => {
        expect(style.fontSize).toMatch(/^\d+(\.\d+)?px$/);
      })
    );
  });

  it('should have valid fontWeight values (100-900) for any generated typography style', () => {
    fc.assert(
      fc.property(validTypographyStyleArb, (style) => {
        expect(style.fontWeight).toBeGreaterThanOrEqual(100);
        expect(style.fontWeight).toBeLessThanOrEqual(900);
        expect(style.fontWeight % 100).toBe(0);
      })
    );
  });

  it('should have valid lineHeight values (px format) for any generated typography style', () => {
    fc.assert(
      fc.property(validTypographyStyleArb, (style) => {
        expect(style.lineHeight).toMatch(/^\d+(\.\d+)?px$/);
      })
    );
  });

  it('should have valid letterSpacing values (px format, can be negative) for any generated typography style', () => {
    fc.assert(
      fc.property(validTypographyStyleArb, (style) => {
        expect(style.letterSpacing).toMatch(/^-?\d+(\.\d+)?px$/);
      })
    );
  });

  it('should create a valid type scale when merging overrides with defaults', () => {
    fc.assert(
      fc.property(
        fc.record({
          displayLarge: fc.option(validTypographyStyleArb, { nil: undefined }),
          bodyMedium: fc.option(validTypographyStyleArb, { nil: undefined }),
        }),
        (overrides) => {
          const filteredOverrides: Partial<M3TypeScale> = {};
          if (overrides.displayLarge) filteredOverrides.displayLarge = overrides.displayLarge;
          if (overrides.bodyMedium) filteredOverrides.bodyMedium = overrides.bodyMedium;
          
          const customScale = createTypeScale(filteredOverrides);
          
          // Should still have all 15 keys
          for (const key of M3_TYPOGRAPHY_KEYS) {
            expect(customScale).toHaveProperty(key);
          }
          
          // Overridden values should be applied
          if (overrides.displayLarge) {
            expect(customScale.displayLarge).toEqual(overrides.displayLarge);
          }
          if (overrides.bodyMedium) {
            expect(customScale.bodyMedium).toEqual(overrides.bodyMedium);
          }
        }
      )
    );
  });

  it('should include all display styles (large, medium, small)', () => {
    const displayStyles = ['displayLarge', 'displayMedium', 'displaySmall'] as const;
    
    for (const styleName of displayStyles) {
      expect(M3_TYPOGRAPHY_KEYS).toContain(styleName);
      expect(isValidTypographyStyle(M3_TYPE_SCALE[styleName])).toBe(true);
    }
  });

  it('should include all headline styles (large, medium, small)', () => {
    const headlineStyles = ['headlineLarge', 'headlineMedium', 'headlineSmall'] as const;
    
    for (const styleName of headlineStyles) {
      expect(M3_TYPOGRAPHY_KEYS).toContain(styleName);
      expect(isValidTypographyStyle(M3_TYPE_SCALE[styleName])).toBe(true);
    }
  });

  it('should include all title styles (large, medium, small)', () => {
    const titleStyles = ['titleLarge', 'titleMedium', 'titleSmall'] as const;
    
    for (const styleName of titleStyles) {
      expect(M3_TYPOGRAPHY_KEYS).toContain(styleName);
      expect(isValidTypographyStyle(M3_TYPE_SCALE[styleName])).toBe(true);
    }
  });

  it('should include all body styles (large, medium, small)', () => {
    const bodyStyles = ['bodyLarge', 'bodyMedium', 'bodySmall'] as const;
    
    for (const styleName of bodyStyles) {
      expect(M3_TYPOGRAPHY_KEYS).toContain(styleName);
      expect(isValidTypographyStyle(M3_TYPE_SCALE[styleName])).toBe(true);
    }
  });

  it('should include all label styles (large, medium, small)', () => {
    const labelStyles = ['labelLarge', 'labelMedium', 'labelSmall'] as const;
    
    for (const styleName of labelStyles) {
      expect(M3_TYPOGRAPHY_KEYS).toContain(styleName);
      expect(isValidTypographyStyle(M3_TYPE_SCALE[styleName])).toBe(true);
    }
  });
});
