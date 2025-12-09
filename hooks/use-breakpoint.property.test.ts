/**
 * **Feature: material-you-3-expressive-redesign, Property 7: Responsive Layout Breakpoint Consistency**
 * **Validates: Requirements 6.1, 6.2, 6.3**
 * 
 * Property: For any viewport width, the layout mode SHALL be:
 * - compact when width < 600px
 * - medium when 600px ≤ width < 840px
 * - expanded when width ≥ 840px
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  getLayoutMode,
  M3_BREAKPOINTS,
  type M3LayoutMode,
} from './use-breakpoint';

// Configure fast-check to run minimum 100 iterations
fc.configureGlobal({ numRuns: 100 });

/**
 * Arbitrary for generating viewport widths in compact range (0 to 599)
 */
const compactWidthArb = fc.integer({ min: 0, max: 599 });

/**
 * Arbitrary for generating viewport widths in medium range (600 to 839)
 */
const mediumWidthArb = fc.integer({ min: 600, max: 839 });

/**
 * Arbitrary for generating viewport widths in expanded range (840+)
 */
const expandedWidthArb = fc.integer({ min: 840, max: 10000 });

/**
 * Arbitrary for generating any valid viewport width
 */
const anyWidthArb = fc.integer({ min: 0, max: 10000 });

describe('Property 7: Responsive Layout Breakpoint Consistency', () => {
  describe('M3 Breakpoint Values', () => {
    it('should define compact breakpoint at 600px', () => {
      expect(M3_BREAKPOINTS.compact).toBe(600);
    });

    it('should define medium breakpoint at 840px', () => {
      expect(M3_BREAKPOINTS.medium).toBe(840);
    });

    it('should define expanded breakpoint at 840px', () => {
      expect(M3_BREAKPOINTS.expanded).toBe(840);
    });
  });

  describe('Compact Layout Mode (width < 600px)', () => {
    it('should return "compact" for any width less than 600px', () => {
      fc.assert(
        fc.property(compactWidthArb, (width) => {
          const layoutMode = getLayoutMode(width);
          expect(layoutMode).toBe('compact');
        })
      );
    });

    it('should return "compact" for width = 0', () => {
      expect(getLayoutMode(0)).toBe('compact');
    });

    it('should return "compact" for width = 599', () => {
      expect(getLayoutMode(599)).toBe('compact');
    });

    it('should NOT return "compact" for width = 600', () => {
      expect(getLayoutMode(600)).not.toBe('compact');
    });
  });

  describe('Medium Layout Mode (600px ≤ width < 840px)', () => {
    it('should return "medium" for any width between 600 and 839', () => {
      fc.assert(
        fc.property(mediumWidthArb, (width) => {
          const layoutMode = getLayoutMode(width);
          expect(layoutMode).toBe('medium');
        })
      );
    });

    it('should return "medium" for width = 600 (lower boundary)', () => {
      expect(getLayoutMode(600)).toBe('medium');
    });

    it('should return "medium" for width = 839 (upper boundary)', () => {
      expect(getLayoutMode(839)).toBe('medium');
    });

    it('should NOT return "medium" for width = 599', () => {
      expect(getLayoutMode(599)).not.toBe('medium');
    });

    it('should NOT return "medium" for width = 840', () => {
      expect(getLayoutMode(840)).not.toBe('medium');
    });
  });

  describe('Expanded Layout Mode (width ≥ 840px)', () => {
    it('should return "expanded" for any width 840px or greater', () => {
      fc.assert(
        fc.property(expandedWidthArb, (width) => {
          const layoutMode = getLayoutMode(width);
          expect(layoutMode).toBe('expanded');
        })
      );
    });

    it('should return "expanded" for width = 840 (lower boundary)', () => {
      expect(getLayoutMode(840)).toBe('expanded');
    });

    it('should return "expanded" for very large widths', () => {
      expect(getLayoutMode(5000)).toBe('expanded');
      expect(getLayoutMode(10000)).toBe('expanded');
    });

    it('should NOT return "expanded" for width = 839', () => {
      expect(getLayoutMode(839)).not.toBe('expanded');
    });
  });

  describe('Layout Mode Exhaustiveness', () => {
    it('should always return one of the three valid layout modes', () => {
      fc.assert(
        fc.property(anyWidthArb, (width) => {
          const layoutMode = getLayoutMode(width);
          expect(['compact', 'medium', 'expanded']).toContain(layoutMode);
        })
      );
    });

    it('should return exactly one layout mode for any width', () => {
      fc.assert(
        fc.property(anyWidthArb, (width) => {
          const layoutMode = getLayoutMode(width);
          const modes: M3LayoutMode[] = ['compact', 'medium', 'expanded'];
          const matchingModes = modes.filter(m => m === layoutMode);
          expect(matchingModes.length).toBe(1);
        })
      );
    });
  });

  describe('Breakpoint Boundary Consistency', () => {
    it('should have no gaps between layout modes', () => {
      // Test that every integer width maps to exactly one mode
      fc.assert(
        fc.property(anyWidthArb, (width) => {
          const layoutMode = getLayoutMode(width);
          
          // Verify the mode is correct based on width
          if (width < 600) {
            expect(layoutMode).toBe('compact');
          } else if (width < 840) {
            expect(layoutMode).toBe('medium');
          } else {
            expect(layoutMode).toBe('expanded');
          }
        })
      );
    });

    it('should transition correctly at 600px boundary', () => {
      expect(getLayoutMode(599)).toBe('compact');
      expect(getLayoutMode(600)).toBe('medium');
    });

    it('should transition correctly at 840px boundary', () => {
      expect(getLayoutMode(839)).toBe('medium');
      expect(getLayoutMode(840)).toBe('expanded');
    });
  });

  describe('Layout Mode Ordering', () => {
    it('should have breakpoints in ascending order', () => {
      // compact < medium < expanded in terms of viewport width
      expect(M3_BREAKPOINTS.compact).toBeLessThanOrEqual(M3_BREAKPOINTS.medium);
    });

    it('should map smaller widths to "smaller" layout modes', () => {
      fc.assert(
        fc.property(
          compactWidthArb,
          expandedWidthArb,
          (compactWidth, expandedWidth) => {
            const compactMode = getLayoutMode(compactWidth);
            const expandedMode = getLayoutMode(expandedWidth);
            
            // Compact mode should be "smaller" than expanded mode
            expect(compactMode).toBe('compact');
            expect(expandedMode).toBe('expanded');
          }
        )
      );
    });
  });

  describe('Determinism', () => {
    it('should return the same layout mode for the same width', () => {
      fc.assert(
        fc.property(anyWidthArb, (width) => {
          const mode1 = getLayoutMode(width);
          const mode2 = getLayoutMode(width);
          expect(mode1).toBe(mode2);
        })
      );
    });
  });
});
