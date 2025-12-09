/**
 * **Feature: material-you-3-expressive-redesign, Property 4: Color Contrast Compliance**
 * **Validates: Requirements 2.3, 11.2**
 * 
 * Property: For any text color and background color combination used in the application,
 * the contrast ratio SHALL be at least 4.5:1 for body text and 3:1 for large text
 * (18px+ or 14px+ bold) to meet WCAG 2.1 AA standards.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  calculateContrastRatio,
  calculateRelativeLuminance,
  meetsWCAGAA,
  meetsWCAGAAA,
  isLargeText,
  checkColorContrastAA,
  getWCAGComplianceLevel,
  isValidHexColor,
  WCAG_AA_CONTRAST,
  WCAG_AAA_CONTRAST,
} from './typography';

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
 * Arbitrary for generating font sizes (8-72px)
 */
const fontSizeArb = fc.integer({ min: 8, max: 72 });

/**
 * Arbitrary for generating font weights (100-900)
 */
const fontWeightArb = fc.integer({ min: 1, max: 9 }).map(n => n * 100);

describe('Property 4: Color Contrast Compliance', () => {
  describe('Contrast Ratio Calculation', () => {
    it('should return a ratio between 1 and 21 for any valid color pair', () => {
      fc.assert(
        fc.property(validHexColorArb, validHexColorArb, (foreground, background) => {
          const ratio = calculateContrastRatio(foreground, background);
          
          // Contrast ratio is always between 1 (same color) and 21 (black/white)
          expect(ratio).toBeGreaterThanOrEqual(1);
          expect(ratio).toBeLessThanOrEqual(21);
        })
      );
    });

    it('should be symmetric - ratio(A, B) equals ratio(B, A)', () => {
      fc.assert(
        fc.property(validHexColorArb, validHexColorArb, (color1, color2) => {
          const ratio1 = calculateContrastRatio(color1, color2);
          const ratio2 = calculateContrastRatio(color2, color1);
          
          // Ratios should be equal (symmetric)
          expect(ratio1).toBeCloseTo(ratio2, 10);
        })
      );
    });

    it('should return exactly 1 for identical colors', () => {
      fc.assert(
        fc.property(validHexColorArb, (color) => {
          const ratio = calculateContrastRatio(color, color);
          expect(ratio).toBeCloseTo(1, 10);
        })
      );
    });

    it('should return maximum contrast (21) for black and white', () => {
      const blackWhiteRatio = calculateContrastRatio('#000000', '#FFFFFF');
      expect(blackWhiteRatio).toBeCloseTo(21, 1);
    });
  });


  describe('Relative Luminance', () => {
    it('should return a value between 0 and 1 for any valid color', () => {
      fc.assert(
        fc.property(validHexColorArb, (color) => {
          const luminance = calculateRelativeLuminance(color);
          
          expect(luminance).toBeGreaterThanOrEqual(0);
          expect(luminance).toBeLessThanOrEqual(1);
        })
      );
    });

    it('should return 0 for black (#000000)', () => {
      const luminance = calculateRelativeLuminance('#000000');
      expect(luminance).toBeCloseTo(0, 10);
    });

    it('should return 1 for white (#FFFFFF)', () => {
      const luminance = calculateRelativeLuminance('#FFFFFF');
      expect(luminance).toBeCloseTo(1, 10);
    });
  });

  describe('WCAG AA Compliance', () => {
    it('should require 4.5:1 ratio for normal text', () => {
      expect(WCAG_AA_CONTRAST.normalText).toBe(4.5);
    });

    it('should require 3:1 ratio for large text', () => {
      expect(WCAG_AA_CONTRAST.largeText).toBe(3.0);
    });

    it('should pass AA for normal text when ratio >= 4.5', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 4.5, max: 21, noNaN: true }),
          (ratio) => {
            expect(meetsWCAGAA(ratio, false)).toBe(true);
          }
        )
      );
    });

    it('should fail AA for normal text when ratio < 4.5', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 4.49, noNaN: true }),
          (ratio) => {
            expect(meetsWCAGAA(ratio, false)).toBe(false);
          }
        )
      );
    });

    it('should pass AA for large text when ratio >= 3', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 3.0, max: 21, noNaN: true }),
          (ratio) => {
            expect(meetsWCAGAA(ratio, true)).toBe(true);
          }
        )
      );
    });

    it('should fail AA for large text when ratio < 3', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 2.99, noNaN: true }),
          (ratio) => {
            expect(meetsWCAGAA(ratio, true)).toBe(false);
          }
        )
      );
    });
  });

  describe('WCAG AAA Compliance', () => {
    it('should require 7:1 ratio for normal text', () => {
      expect(WCAG_AAA_CONTRAST.normalText).toBe(7.0);
    });

    it('should require 4.5:1 ratio for large text', () => {
      expect(WCAG_AAA_CONTRAST.largeText).toBe(4.5);
    });

    it('should pass AAA for normal text when ratio >= 7', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 7.0, max: 21, noNaN: true }),
          (ratio) => {
            expect(meetsWCAGAAA(ratio, false)).toBe(true);
          }
        )
      );
    });

    it('should pass AAA for large text when ratio >= 4.5', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 4.5, max: 21, noNaN: true }),
          (ratio) => {
            expect(meetsWCAGAAA(ratio, true)).toBe(true);
          }
        )
      );
    });
  });

  describe('Large Text Detection', () => {
    it('should consider text >= 18px as large regardless of weight', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 18, max: 72 }),
          fontWeightArb,
          (fontSize, fontWeight) => {
            expect(isLargeText(fontSize, fontWeight)).toBe(true);
          }
        )
      );
    });

    it('should consider bold text (weight >= 700) >= 14px as large', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 14, max: 17 }),
          fc.integer({ min: 700, max: 900 }),
          (fontSize, fontWeight) => {
            expect(isLargeText(fontSize, fontWeight)).toBe(true);
          }
        )
      );
    });

    it('should not consider non-bold text < 18px as large', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 8, max: 17 }),
          fc.integer({ min: 100, max: 600 }),
          (fontSize, fontWeight) => {
            expect(isLargeText(fontSize, fontWeight)).toBe(false);
          }
        )
      );
    });

    it('should not consider bold text < 14px as large', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 8, max: 13 }),
          fc.integer({ min: 700, max: 900 }),
          (fontSize, fontWeight) => {
            expect(isLargeText(fontSize, fontWeight)).toBe(false);
          }
        )
      );
    });
  });

  describe('Color Contrast AA Check', () => {
    it('should return true for black text on white background (normal text)', () => {
      expect(checkColorContrastAA('#000000', '#FFFFFF', false)).toBe(true);
    });

    it('should return true for white text on black background (normal text)', () => {
      expect(checkColorContrastAA('#FFFFFF', '#000000', false)).toBe(true);
    });

    it('should return false for same color foreground and background', () => {
      fc.assert(
        fc.property(validHexColorArb, (color) => {
          expect(checkColorContrastAA(color, color, false)).toBe(false);
        })
      );
    });
  });

  describe('WCAG Compliance Level', () => {
    it('should return AAA for ratios >= 7 (normal text)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 7.0, max: 21, noNaN: true }),
          (ratio) => {
            expect(getWCAGComplianceLevel(ratio, false)).toBe('AAA');
          }
        )
      );
    });

    it('should return AA for ratios >= 4.5 and < 7 (normal text)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 4.5, max: 6.99, noNaN: true }),
          (ratio) => {
            expect(getWCAGComplianceLevel(ratio, false)).toBe('AA');
          }
        )
      );
    });

    it('should return fail for ratios < 4.5 (normal text)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 4.49, noNaN: true }),
          (ratio) => {
            expect(getWCAGComplianceLevel(ratio, false)).toBe('fail');
          }
        )
      );
    });

    it('should return AAA for ratios >= 4.5 (large text)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 4.5, max: 21, noNaN: true }),
          (ratio) => {
            expect(getWCAGComplianceLevel(ratio, true)).toBe('AAA');
          }
        )
      );
    });

    it('should return AA for ratios >= 3 and < 4.5 (large text)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 3.0, max: 4.49, noNaN: true }),
          (ratio) => {
            expect(getWCAGComplianceLevel(ratio, true)).toBe('AA');
          }
        )
      );
    });

    it('should return fail for ratios < 3 (large text)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 2.99, noNaN: true }),
          (ratio) => {
            expect(getWCAGComplianceLevel(ratio, true)).toBe('fail');
          }
        )
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid foreground color', () => {
      expect(() => calculateContrastRatio('invalid', '#FFFFFF')).toThrow();
    });

    it('should throw error for invalid background color', () => {
      expect(() => calculateContrastRatio('#000000', 'invalid')).toThrow();
    });

    it('should validate hex colors correctly', () => {
      fc.assert(
        fc.property(validHexColorArb, (color) => {
          expect(isValidHexColor(color)).toBe(true);
        })
      );
    });

    it('should reject invalid hex color formats', () => {
      const invalidColors = ['invalid', '#GGG', 'rgb(0,0,0)', '#12345', '', '#1234567'];
      for (const color of invalidColors) {
        expect(isValidHexColor(color)).toBe(false);
      }
    });
  });
});
