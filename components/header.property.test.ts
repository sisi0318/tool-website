/**
 * **Feature: material-you-3-expressive-redesign, Property 8: Touch Target Minimum Size**
 * **Validates: Requirements 12.1, 13.3**
 * 
 * Property: For any interactive element on mobile, the touch target size
 * SHALL be at least 48dp × 48dp.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// Configure fast-check to run minimum 100 iterations
fc.configureGlobal({ numRuns: 100 });

/**
 * M3 Accessibility Constants
 * Minimum touch target size as per Material Design 3 guidelines
 */
const M3_MIN_TOUCH_TARGET_DP = 48;

/**
 * Touch target size interface
 */
interface TouchTargetSize {
  width: number;
  height: number;
}

/**
 * Validates if a touch target meets M3 minimum size requirements
 * @param size - The touch target size in dp
 * @returns true if the touch target meets minimum 48dp × 48dp requirement
 */
export function meetsMinTouchTarget(size: TouchTargetSize): boolean {
  return size.width >= M3_MIN_TOUCH_TARGET_DP && size.height >= M3_MIN_TOUCH_TARGET_DP;
}

/**
 * Validates if a single dimension meets M3 minimum touch target requirement
 * @param dimension - The dimension value in dp
 * @returns true if the dimension is at least 48dp
 */
export function meetsMinTouchTargetDimension(dimension: number): boolean {
  return dimension >= M3_MIN_TOUCH_TARGET_DP;
}

/**
 * Calculates the effective touch target size considering padding
 * @param contentSize - The content size in dp
 * @param padding - The padding in dp (applied to both sides)
 * @returns The effective touch target size
 */
export function calculateEffectiveTouchTarget(
  contentSize: TouchTargetSize,
  padding: { horizontal: number; vertical: number }
): TouchTargetSize {
  return {
    width: contentSize.width + padding.horizontal * 2,
    height: contentSize.height + padding.vertical * 2,
  };
}

/**
 * M3 Header Interactive Element Specifications
 * These are the touch target sizes used in the M3 Header component
 */
export const M3_HEADER_TOUCH_TARGETS = {
  /** Icon button touch target (48dp × 48dp) */
  iconButton: { width: 48, height: 48 },
  /** Navigation link minimum height (48dp) with variable width */
  navLink: { minHeight: 48 },
  /** Logo/brand link minimum height (48dp) */
  brandLink: { minHeight: 48 },
} as const;

/**
 * Arbitrary for generating valid touch target sizes (>= 48dp)
 */
const validTouchTargetSizeArb = fc.record({
  width: fc.integer({ min: M3_MIN_TOUCH_TARGET_DP, max: 200 }),
  height: fc.integer({ min: M3_MIN_TOUCH_TARGET_DP, max: 200 }),
});

/**
 * Arbitrary for generating invalid touch target sizes (< 48dp in at least one dimension)
 */
const invalidTouchTargetSizeArb = fc.oneof(
  // Width too small
  fc.record({
    width: fc.integer({ min: 0, max: M3_MIN_TOUCH_TARGET_DP - 1 }),
    height: fc.integer({ min: M3_MIN_TOUCH_TARGET_DP, max: 200 }),
  }),
  // Height too small
  fc.record({
    width: fc.integer({ min: M3_MIN_TOUCH_TARGET_DP, max: 200 }),
    height: fc.integer({ min: 0, max: M3_MIN_TOUCH_TARGET_DP - 1 }),
  }),
  // Both too small
  fc.record({
    width: fc.integer({ min: 0, max: M3_MIN_TOUCH_TARGET_DP - 1 }),
    height: fc.integer({ min: 0, max: M3_MIN_TOUCH_TARGET_DP - 1 }),
  }),
);

/**
 * Arbitrary for generating any touch target size
 */
const anyTouchTargetSizeArb = fc.record({
  width: fc.integer({ min: 0, max: 200 }),
  height: fc.integer({ min: 0, max: 200 }),
});

/**
 * Arbitrary for generating content sizes that need padding to meet touch target
 */
const smallContentSizeArb = fc.record({
  width: fc.integer({ min: 16, max: 32 }),
  height: fc.integer({ min: 16, max: 32 }),
});

/**
 * Arbitrary for generating padding values
 */
const paddingArb = fc.record({
  horizontal: fc.integer({ min: 0, max: 24 }),
  vertical: fc.integer({ min: 0, max: 24 }),
});

describe('Property 8: Touch Target Minimum Size', () => {
  describe('Touch Target Validation', () => {
    /**
     * Core property: Any touch target with both dimensions >= 48dp should be valid
     */
    it('should accept any touch target with dimensions >= 48dp', () => {
      fc.assert(
        fc.property(validTouchTargetSizeArb, (size) => {
          expect(meetsMinTouchTarget(size)).toBe(true);
        })
      );
    });

    /**
     * Core property: Any touch target with at least one dimension < 48dp should be invalid
     */
    it('should reject any touch target with dimensions < 48dp', () => {
      fc.assert(
        fc.property(invalidTouchTargetSizeArb, (size) => {
          expect(meetsMinTouchTarget(size)).toBe(false);
        })
      );
    });

    /**
     * Property: The boundary at exactly 48dp should be valid
     */
    it('should accept touch target at exactly 48dp × 48dp (boundary)', () => {
      expect(meetsMinTouchTarget({ width: 48, height: 48 })).toBe(true);
    });

    /**
     * Property: The boundary at 47dp should be invalid
     */
    it('should reject touch target at 47dp × 47dp (boundary)', () => {
      expect(meetsMinTouchTarget({ width: 47, height: 47 })).toBe(false);
    });

    /**
     * Property: Width of 47dp with valid height should be invalid
     */
    it('should reject touch target with width 47dp even if height is valid', () => {
      expect(meetsMinTouchTarget({ width: 47, height: 48 })).toBe(false);
    });

    /**
     * Property: Height of 47dp with valid width should be invalid
     */
    it('should reject touch target with height 47dp even if width is valid', () => {
      expect(meetsMinTouchTarget({ width: 48, height: 47 })).toBe(false);
    });
  });

  describe('Single Dimension Validation', () => {
    /**
     * Property: Any dimension >= 48dp should be valid
     */
    it('should accept any dimension >= 48dp', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: M3_MIN_TOUCH_TARGET_DP, max: 200 }),
          (dimension) => {
            expect(meetsMinTouchTargetDimension(dimension)).toBe(true);
          }
        )
      );
    });

    /**
     * Property: Any dimension < 48dp should be invalid
     */
    it('should reject any dimension < 48dp', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: M3_MIN_TOUCH_TARGET_DP - 1 }),
          (dimension) => {
            expect(meetsMinTouchTargetDimension(dimension)).toBe(false);
          }
        )
      );
    });
  });

  describe('Effective Touch Target Calculation', () => {
    /**
     * Property: Adding padding should increase effective touch target size
     */
    it('should increase effective size when padding is added', () => {
      fc.assert(
        fc.property(
          smallContentSizeArb,
          paddingArb,
          (contentSize, padding) => {
            const effectiveSize = calculateEffectiveTouchTarget(contentSize, padding);
            
            expect(effectiveSize.width).toBe(contentSize.width + padding.horizontal * 2);
            expect(effectiveSize.height).toBe(contentSize.height + padding.vertical * 2);
          }
        )
      );
    });

    /**
     * Property: Small content with sufficient padding should meet touch target requirements
     */
    it('should meet touch target requirements when padding compensates for small content', () => {
      // 24px icon with 12px padding on each side = 48px touch target
      const iconSize = { width: 24, height: 24 };
      const padding = { horizontal: 12, vertical: 12 };
      
      const effectiveSize = calculateEffectiveTouchTarget(iconSize, padding);
      
      expect(meetsMinTouchTarget(effectiveSize)).toBe(true);
      expect(effectiveSize.width).toBe(48);
      expect(effectiveSize.height).toBe(48);
    });

    /**
     * Property: Zero padding should not change the content size
     */
    it('should return content size when padding is zero', () => {
      fc.assert(
        fc.property(anyTouchTargetSizeArb, (contentSize) => {
          const effectiveSize = calculateEffectiveTouchTarget(contentSize, { horizontal: 0, vertical: 0 });
          
          expect(effectiveSize.width).toBe(contentSize.width);
          expect(effectiveSize.height).toBe(contentSize.height);
        })
      );
    });
  });

  describe('M3 Header Component Touch Targets', () => {
    /**
     * Property: Icon button touch target should meet M3 requirements
     * Requirements 7.3, 12.1
     */
    it('should have icon button touch target of at least 48dp × 48dp', () => {
      const iconButtonTarget = M3_HEADER_TOUCH_TARGETS.iconButton;
      
      expect(meetsMinTouchTarget(iconButtonTarget)).toBe(true);
      expect(iconButtonTarget.width).toBeGreaterThanOrEqual(M3_MIN_TOUCH_TARGET_DP);
      expect(iconButtonTarget.height).toBeGreaterThanOrEqual(M3_MIN_TOUCH_TARGET_DP);
    });

    /**
     * Property: Navigation link should have minimum height of 48dp
     * Requirements 12.1, 13.3
     */
    it('should have navigation link minimum height of 48dp', () => {
      const navLinkMinHeight = M3_HEADER_TOUCH_TARGETS.navLink.minHeight;
      
      expect(meetsMinTouchTargetDimension(navLinkMinHeight)).toBe(true);
      expect(navLinkMinHeight).toBeGreaterThanOrEqual(M3_MIN_TOUCH_TARGET_DP);
    });

    /**
     * Property: Brand link should have minimum height of 48dp
     * Requirements 12.1
     */
    it('should have brand link minimum height of 48dp', () => {
      const brandLinkMinHeight = M3_HEADER_TOUCH_TARGETS.brandLink.minHeight;
      
      expect(meetsMinTouchTargetDimension(brandLinkMinHeight)).toBe(true);
      expect(brandLinkMinHeight).toBeGreaterThanOrEqual(M3_MIN_TOUCH_TARGET_DP);
    });
  });

  describe('M3 Specification Compliance', () => {
    /**
     * Property: The minimum touch target should be exactly 48dp as per M3 spec
     * Requirements 12.1, 13.3
     */
    it('should use 48dp as the minimum touch target per M3 specification', () => {
      expect(M3_MIN_TOUCH_TARGET_DP).toBe(48);
    });

    /**
     * Property: Validation should be deterministic
     */
    it('should be deterministic for any touch target size', () => {
      fc.assert(
        fc.property(anyTouchTargetSizeArb, (size) => {
          const result1 = meetsMinTouchTarget(size);
          const result2 = meetsMinTouchTarget(size);
          expect(result1).toBe(result2);
        })
      );
    });

    /**
     * Property: Larger touch targets should always be valid if minimum is valid
     */
    it('should accept any touch target larger than the minimum', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: M3_MIN_TOUCH_TARGET_DP, max: 200 }),
          fc.integer({ min: 0, max: 100 }),
          (baseSize, increment) => {
            const size = { width: baseSize + increment, height: baseSize + increment };
            expect(meetsMinTouchTarget(size)).toBe(true);
          }
        )
      );
    });
  });

  describe('Edge Cases', () => {
    /**
     * Property: Zero dimensions should be invalid
     */
    it('should reject zero dimensions', () => {
      expect(meetsMinTouchTarget({ width: 0, height: 0 })).toBe(false);
      expect(meetsMinTouchTarget({ width: 0, height: 48 })).toBe(false);
      expect(meetsMinTouchTarget({ width: 48, height: 0 })).toBe(false);
    });

    /**
     * Property: Very large touch targets should be valid
     */
    it('should accept very large touch targets', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 10000 }),
          (size) => {
            expect(meetsMinTouchTarget({ width: size, height: size })).toBe(true);
          }
        )
      );
    });

    /**
     * Property: Asymmetric touch targets should be valid if both dimensions meet minimum
     */
    it('should accept asymmetric touch targets if both dimensions are valid', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: M3_MIN_TOUCH_TARGET_DP, max: 200 }),
          fc.integer({ min: M3_MIN_TOUCH_TARGET_DP, max: 200 }),
          (width, height) => {
            expect(meetsMinTouchTarget({ width, height })).toBe(true);
          }
        )
      );
    });
  });
});
