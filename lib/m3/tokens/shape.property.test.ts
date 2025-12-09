/**
 * **Feature: material-you-3-expressive-redesign, Property 5: Shape Token Validity**
 * **Validates: Requirements 3.1, 3.2, 3.3**
 * 
 * Property: For any M3 Expressive shape token (extraSmall, small, medium, large, extraLarge, full),
 * the value SHALL be a valid CSS border-radius value with extraSmall=4px, small=8px, medium=16px,
 * large=24px, extraLarge=28px, full=9999px.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  M3ExpressiveShape,
  M3_EXPRESSIVE_SHAPE,
  M3_SHAPE_KEYS,
  M3_SHAPE_VALUES_PX,
  isValidShapeValue,
  isValidShapeTokens,
  isValidM3ShapeValue,
  parseShapeValue,
  getShapeToken,
  createShapeTokens,
  shapeTokensToCssVars,
  getComponentShape,
  M3_COMPONENT_SHAPES,
} from './shape';

// Configure fast-check to run minimum 100 iterations
fc.configureGlobal({ numRuns: 100 });

/**
 * Arbitrary for generating valid shape token keys
 */
const shapeKeyArb = fc.constantFrom(...M3_SHAPE_KEYS);

/**
 * Arbitrary for generating valid CSS px values
 */
const validPxValueArb = fc.integer({ min: 0, max: 10000 }).map(n => `${n}px`);

/**
 * Arbitrary for generating invalid shape values
 */
const invalidShapeValueArb = fc.oneof(
  fc.constant(''),
  fc.constant('invalid'),
  fc.constant('16'),           // missing px
  fc.constant('16em'),         // wrong unit
  fc.constant('16rem'),        // wrong unit
  fc.constant('-16px'),        // negative value
  fc.constant('px'),           // missing number
  fc.constant('16 px'),        // space in value
);

describe('Property 5: Shape Token Validity', () => {
  describe('M3 Expressive Shape Token Values', () => {
    it('should have all 6 required shape tokens defined', () => {
      expect(M3_SHAPE_KEYS.length).toBe(6);
      
      for (const key of M3_SHAPE_KEYS) {
        expect(M3_EXPRESSIVE_SHAPE).toHaveProperty(key);
        expect(M3_EXPRESSIVE_SHAPE[key]).toBeDefined();
      }
    });

    it('should have extraSmall = 4px', () => {
      expect(M3_EXPRESSIVE_SHAPE.extraSmall).toBe('4px');
      expect(parseShapeValue(M3_EXPRESSIVE_SHAPE.extraSmall)).toBe(4);
    });

    it('should have small = 8px', () => {
      expect(M3_EXPRESSIVE_SHAPE.small).toBe('8px');
      expect(parseShapeValue(M3_EXPRESSIVE_SHAPE.small)).toBe(8);
    });

    it('should have medium = 16px', () => {
      expect(M3_EXPRESSIVE_SHAPE.medium).toBe('16px');
      expect(parseShapeValue(M3_EXPRESSIVE_SHAPE.medium)).toBe(16);
    });

    it('should have large = 24px', () => {
      expect(M3_EXPRESSIVE_SHAPE.large).toBe('24px');
      expect(parseShapeValue(M3_EXPRESSIVE_SHAPE.large)).toBe(24);
    });

    it('should have extraLarge = 28px', () => {
      expect(M3_EXPRESSIVE_SHAPE.extraLarge).toBe('28px');
      expect(parseShapeValue(M3_EXPRESSIVE_SHAPE.extraLarge)).toBe(28);
    });

    it('should have full = 9999px (pill shape)', () => {
      expect(M3_EXPRESSIVE_SHAPE.full).toBe('9999px');
      expect(parseShapeValue(M3_EXPRESSIVE_SHAPE.full)).toBe(9999);
    });
  });

  describe('Shape Value Validation', () => {
    it('should validate all default shape tokens as valid CSS border-radius values', () => {
      for (const key of M3_SHAPE_KEYS) {
        const value = M3_EXPRESSIVE_SHAPE[key];
        expect(isValidShapeValue(value)).toBe(true);
      }
    });

    it('should validate the complete default shape token set', () => {
      expect(isValidShapeTokens(M3_EXPRESSIVE_SHAPE)).toBe(true);
    });

    it('should accept any valid px value as a valid shape value', () => {
      fc.assert(
        fc.property(validPxValueArb, (pxValue) => {
          expect(isValidShapeValue(pxValue)).toBe(true);
        })
      );
    });

    it('should reject invalid shape values', () => {
      fc.assert(
        fc.property(invalidShapeValueArb, (invalidValue) => {
          expect(isValidShapeValue(invalidValue)).toBe(false);
        })
      );
    });

    it('should correctly parse shape values to numeric pixels', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }),
          (pixels) => {
            const pxValue = `${pixels}px`;
            expect(parseShapeValue(pxValue)).toBe(pixels);
          }
        )
      );
    });

    it('should return null for invalid shape values when parsing', () => {
      fc.assert(
        fc.property(invalidShapeValueArb, (invalidValue) => {
          expect(parseShapeValue(invalidValue)).toBeNull();
        })
      );
    });
  });

  describe('M3 Specification Compliance', () => {
    it('should validate each shape token against M3 specification values', () => {
      fc.assert(
        fc.property(shapeKeyArb, (key) => {
          const value = M3_EXPRESSIVE_SHAPE[key];
          const expectedPx = M3_SHAPE_VALUES_PX[key];
          const actualPx = parseShapeValue(value);
          
          expect(actualPx).toBe(expectedPx);
          expect(isValidM3ShapeValue(key, value)).toBe(true);
        })
      );
    });

    it('should reject values that do not match M3 specification', () => {
      fc.assert(
        fc.property(
          shapeKeyArb,
          fc.integer({ min: 0, max: 10000 }).filter(n => {
            // Filter out values that match any M3 spec value
            return !Object.values(M3_SHAPE_VALUES_PX).includes(n);
          }),
          (key, wrongPx) => {
            const wrongValue = `${wrongPx}px`;
            expect(isValidM3ShapeValue(key, wrongValue)).toBe(false);
          }
        )
      );
    });

    it('should have shape values in ascending order (except full)', () => {
      const orderedKeys: (keyof M3ExpressiveShape)[] = ['extraSmall', 'small', 'medium', 'large', 'extraLarge'];
      
      for (let i = 0; i < orderedKeys.length - 1; i++) {
        const currentPx = M3_SHAPE_VALUES_PX[orderedKeys[i]];
        const nextPx = M3_SHAPE_VALUES_PX[orderedKeys[i + 1]];
        expect(currentPx).toBeLessThan(nextPx);
      }
    });
  });

  describe('Shape Token Utilities', () => {
    it('should get correct shape token values', () => {
      fc.assert(
        fc.property(shapeKeyArb, (key) => {
          const value = getShapeToken(key);
          expect(value).toBe(M3_EXPRESSIVE_SHAPE[key]);
        })
      );
    });

    it('should create shape tokens with defaults when no overrides provided', () => {
      const tokens = createShapeTokens();
      
      for (const key of M3_SHAPE_KEYS) {
        expect(tokens[key]).toBe(M3_EXPRESSIVE_SHAPE[key]);
      }
    });

    it('should create shape tokens with overrides applied', () => {
      fc.assert(
        fc.property(
          shapeKeyArb,
          validPxValueArb,
          (key, overrideValue) => {
            const overrides: Partial<M3ExpressiveShape> = { [key]: overrideValue };
            const tokens = createShapeTokens(overrides);
            
            expect(tokens[key]).toBe(overrideValue);
            
            // Other keys should remain default
            for (const otherKey of M3_SHAPE_KEYS) {
              if (otherKey !== key) {
                expect(tokens[otherKey]).toBe(M3_EXPRESSIVE_SHAPE[otherKey]);
              }
            }
          }
        )
      );
    });

    it('should convert shape tokens to CSS custom properties', () => {
      const cssVars = shapeTokensToCssVars();
      
      expect(cssVars['--md-sys-shape-corner-extra-small']).toBe('4px');
      expect(cssVars['--md-sys-shape-corner-small']).toBe('8px');
      expect(cssVars['--md-sys-shape-corner-medium']).toBe('16px');
      expect(cssVars['--md-sys-shape-corner-large']).toBe('24px');
      expect(cssVars['--md-sys-shape-corner-extra-large']).toBe('28px');
      expect(cssVars['--md-sys-shape-corner-full']).toBe('9999px');
    });
  });

  describe('Component Shape Recommendations', () => {
    it('should provide valid shape values for all component types', () => {
      const componentKeys = Object.keys(M3_COMPONENT_SHAPES) as (keyof typeof M3_COMPONENT_SHAPES)[];
      
      for (const component of componentKeys) {
        const shapeValue = getComponentShape(component);
        expect(isValidShapeValue(shapeValue)).toBe(true);
      }
    });

    it('should use large or extraLarge corners for cards (Expressive style)', () => {
      // Requirement 3.2: Cards should use large (24dp) or extra-large (28dp) corner radius
      const cardComponents = ['cardElevated', 'cardFilled', 'cardOutlined', 'cardExpressive'] as const;
      
      for (const card of cardComponents) {
        const shapeKey = M3_COMPONENT_SHAPES[card];
        expect(['large', 'extraLarge']).toContain(shapeKey);
      }
    });

    it('should use full corners for FABs (pill shape)', () => {
      // Requirement 3.3: FABs should have fully rounded corners
      expect(M3_COMPONENT_SHAPES.buttonFab).toBe('full');
      expect(getComponentShape('buttonFab')).toBe('9999px');
    });

    it('should use medium corners for standard buttons', () => {
      // Requirement 3.3: Standard buttons should have medium (16dp) corners
      expect(M3_COMPONENT_SHAPES.buttonStandard).toBe('medium');
      expect(getComponentShape('buttonStandard')).toBe('16px');
    });
  });
});
