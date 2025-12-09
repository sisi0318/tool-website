/**
 * **Feature: material-you-3-expressive-redesign, Property 10: Mobile Layout Vertical Stacking**
 * **Validates: Requirements 15.1, 15.2**
 * 
 * Property: For any tool page displayed on a compact viewport (width < 600px),
 * input and output sections SHALL be arranged in a vertical stack (not side-by-side).
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { shouldStackVertically } from './mobile-tool-layout';

// Configure fast-check to run minimum 100 iterations
fc.configureGlobal({ numRuns: 100 });

/**
 * M3 Breakpoint Constants
 * - compact: < 600px (mobile phones)
 * - medium: 600px - 840px (tablets)
 * - expanded: > 840px (desktops)
 */
const M3_COMPACT_BREAKPOINT = 600;

/**
 * Arbitrary for generating compact viewport widths (< 600px)
 * These are mobile device widths where vertical stacking should be applied
 */
const compactViewportWidthArb = fc.integer({ min: 0, max: M3_COMPACT_BREAKPOINT - 1 });

/**
 * Arbitrary for generating non-compact viewport widths (>= 600px)
 * These are tablet/desktop widths where horizontal layout may be used
 */
const nonCompactViewportWidthArb = fc.integer({ min: M3_COMPACT_BREAKPOINT, max: 4096 });

/**
 * Arbitrary for generating any valid viewport width
 */
const anyViewportWidthArb = fc.integer({ min: 0, max: 4096 });

/**
 * Arbitrary for generating common mobile device widths
 * Based on real device viewport widths
 */
const commonMobileWidthsArb = fc.constantFrom(
  320,  // iPhone SE
  375,  // iPhone 6/7/8/X
  390,  // iPhone 12/13
  393,  // Pixel 5
  412,  // Pixel 4
  414,  // iPhone 6/7/8 Plus
  428,  // iPhone 12/13 Pro Max
  360,  // Samsung Galaxy S series
  384,  // Nexus 4
  540,  // Surface Duo (single screen)
);

/**
 * Arbitrary for generating common tablet/desktop widths
 */
const commonTabletDesktopWidthsArb = fc.constantFrom(
  600,  // M3 medium breakpoint start
  768,  // iPad Mini
  820,  // iPad Air
  840,  // M3 expanded breakpoint start
  1024, // iPad Pro 11"
  1280, // Desktop
  1440, // Desktop HD
  1920, // Full HD
);

describe('Property 10: Mobile Layout Vertical Stacking', () => {
  describe('Compact Viewport Vertical Stacking', () => {
    /**
     * Core property: For any viewport width < 600px, layout should stack vertically
     * This validates Requirements 15.1 and 15.2
     */
    it('should return true (vertical stack) for any compact viewport width (< 600px)', () => {
      fc.assert(
        fc.property(compactViewportWidthArb, (width) => {
          const shouldStack = shouldStackVertically(width);
          expect(shouldStack).toBe(true);
        })
      );
    });

    /**
     * Property: For any viewport width >= 600px, layout should NOT stack vertically
     */
    it('should return false (horizontal layout) for any non-compact viewport width (>= 600px)', () => {
      fc.assert(
        fc.property(nonCompactViewportWidthArb, (width) => {
          const shouldStack = shouldStackVertically(width);
          expect(shouldStack).toBe(false);
        })
      );
    });

    /**
     * Property: The breakpoint at exactly 600px should NOT stack vertically
     * (600px is the start of medium layout, not compact)
     */
    it('should return false at exactly 600px (boundary condition)', () => {
      expect(shouldStackVertically(600)).toBe(false);
    });

    /**
     * Property: The breakpoint at 599px should stack vertically
     * (599px is still compact layout)
     */
    it('should return true at exactly 599px (boundary condition)', () => {
      expect(shouldStackVertically(599)).toBe(true);
    });
  });

  describe('Common Device Widths', () => {
    /**
     * Property: All common mobile device widths should trigger vertical stacking
     */
    it('should stack vertically for all common mobile device widths', () => {
      fc.assert(
        fc.property(commonMobileWidthsArb, (width) => {
          const shouldStack = shouldStackVertically(width);
          expect(shouldStack).toBe(true);
        })
      );
    });

    /**
     * Property: All common tablet/desktop widths should NOT trigger vertical stacking
     */
    it('should not stack vertically for common tablet/desktop widths', () => {
      fc.assert(
        fc.property(commonTabletDesktopWidthsArb, (width) => {
          const shouldStack = shouldStackVertically(width);
          expect(shouldStack).toBe(false);
        })
      );
    });
  });

  describe('Breakpoint Consistency', () => {
    /**
     * Property: The function should be deterministic - same input always produces same output
     */
    it('should be deterministic for any viewport width', () => {
      fc.assert(
        fc.property(anyViewportWidthArb, (width) => {
          const result1 = shouldStackVertically(width);
          const result2 = shouldStackVertically(width);
          expect(result1).toBe(result2);
        })
      );
    });

    /**
     * Property: There should be exactly one breakpoint transition at 600px
     * For any width w, if shouldStackVertically(w) !== shouldStackVertically(w+1),
     * then w must be 599 (the transition point)
     */
    it('should have exactly one breakpoint transition at 600px', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 4095 }),
          (width) => {
            const currentResult = shouldStackVertically(width);
            const nextResult = shouldStackVertically(width + 1);
            
            // If there's a transition, it must be at 599 -> 600
            if (currentResult !== nextResult) {
              expect(width).toBe(599);
              expect(currentResult).toBe(true);  // 599px should stack
              expect(nextResult).toBe(false);    // 600px should not stack
            }
          }
        )
      );
    });

    /**
     * Property: The function should be monotonic - once it returns false,
     * it should continue returning false for all larger widths
     */
    it('should be monotonically decreasing (once false, stays false)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 4000 }),
          fc.integer({ min: 1, max: 100 }),
          (width, increment) => {
            const currentResult = shouldStackVertically(width);
            const largerResult = shouldStackVertically(width + increment);
            
            // If current is false, larger must also be false
            if (!currentResult) {
              expect(largerResult).toBe(false);
            }
          }
        )
      );
    });
  });

  describe('Edge Cases', () => {
    /**
     * Property: Zero width should stack vertically (extreme edge case)
     */
    it('should handle zero width', () => {
      expect(shouldStackVertically(0)).toBe(true);
    });

    /**
     * Property: Very large widths should not stack vertically
     */
    it('should handle very large widths', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10000, max: 100000 }),
          (width) => {
            expect(shouldStackVertically(width)).toBe(false);
          }
        )
      );
    });
  });

  describe('M3 Specification Compliance', () => {
    /**
     * Property: The compact breakpoint should be exactly 600px as per M3 spec
     * Requirements 6.1, 15.1, 15.2
     */
    it('should use 600px as the compact breakpoint per M3 specification', () => {
      // All widths from 0 to 599 should be compact (vertical stack)
      for (let w = 0; w < 600; w += 50) {
        expect(shouldStackVertically(w)).toBe(true);
      }
      
      // All widths from 600 onwards should not be compact
      for (let w = 600; w <= 1200; w += 50) {
        expect(shouldStackVertically(w)).toBe(false);
      }
    });

    /**
     * Property: Input and output sections should be in vertical order on compact
     * This is validated by the shouldStackVertically function returning true
     * which triggers flex-col layout in the component
     */
    it('should indicate vertical stacking for mobile tool pages (Requirements 15.1, 15.2)', () => {
      // Simulate various mobile viewport widths
      const mobileWidths = [320, 375, 390, 414, 428, 540, 599];
      
      for (const width of mobileWidths) {
        const shouldStack = shouldStackVertically(width);
        expect(shouldStack).toBe(true);
        // When shouldStack is true, the layout component applies:
        // - flex flex-col (vertical stacking)
        // - gap-4 (16dp spacing between sections per Requirement 15.1)
      }
    });
  });
});
