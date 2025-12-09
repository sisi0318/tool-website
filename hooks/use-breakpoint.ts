'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * M3 Responsive Breakpoints
 * 
 * Material You 3 defines three layout modes based on viewport width:
 * - compact: < 600px (mobile phones)
 * - medium: 600px - 840px (tablets, small laptops)
 * - expanded: > 840px (desktops, large tablets)
 * 
 * Requirements: 6.1, 6.2, 6.3
 */

export type M3LayoutMode = 'compact' | 'medium' | 'expanded';

export interface M3Breakpoints {
  compact: number;   // < 600px
  medium: number;    // 600px - 840px
  expanded: number;  // > 840px
}

/**
 * M3 breakpoint values in pixels
 */
export const M3_BREAKPOINTS: M3Breakpoints = {
  compact: 600,
  medium: 840,
  expanded: 840, // expanded starts at 840px
};

/**
 * Determines the layout mode based on viewport width
 * 
 * @param width - The viewport width in pixels
 * @returns The M3 layout mode: 'compact', 'medium', or 'expanded'
 */
export function getLayoutMode(width: number): M3LayoutMode {
  if (width < M3_BREAKPOINTS.compact) {
    return 'compact';
  }
  if (width < M3_BREAKPOINTS.medium) {
    return 'medium';
  }
  return 'expanded';
}

export interface UseBreakpointResult {
  /** Current layout mode: 'compact', 'medium', or 'expanded' */
  layoutMode: M3LayoutMode;
  /** Whether the current layout is compact (mobile) */
  isCompact: boolean;
  /** Whether the current layout is medium (tablet) */
  isMedium: boolean;
  /** Whether the current layout is expanded (desktop) */
  isExpanded: boolean;
  /** Current viewport width in pixels */
  width: number;
}

/**
 * Hook for detecting M3 responsive breakpoints
 * 
 * Detects the current viewport width and returns the corresponding M3 layout mode:
 * - compact: viewport width < 600px
 * - medium: viewport width >= 600px and < 840px
 * - expanded: viewport width >= 840px
 * 
 * @returns Object containing layout mode and convenience boolean flags
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { layoutMode, isCompact, isMedium, isExpanded } = useBreakpoint();
 *   
 *   return (
 *     <div>
 *       {isCompact && <MobileNavigation />}
 *       {(isMedium || isExpanded) && <DesktopNavigation />}
 *     </div>
 *   );
 * }
 * ```
 * 
 * Requirements: 6.1, 6.2, 6.3
 */
export function useBreakpoint(): UseBreakpointResult {
  // Initialize with a default value for SSR
  const [width, setWidth] = useState<number>(0);
  const [isClient, setIsClient] = useState(false);

  const handleResize = useCallback(() => {
    setWidth(window.innerWidth);
  }, []);

  useEffect(() => {
    // Mark that we're on the client
    setIsClient(true);
    
    // Set initial width
    handleResize();

    // Listen for window resize events
    window.addEventListener('resize', handleResize);

    // Clean up event listener on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [handleResize]);

  // During SSR or before hydration, default to expanded layout
  const effectiveWidth = isClient ? width : 1024;
  const layoutMode = getLayoutMode(effectiveWidth);

  return {
    layoutMode,
    isCompact: layoutMode === 'compact',
    isMedium: layoutMode === 'medium',
    isExpanded: layoutMode === 'expanded',
    width: effectiveWidth,
  };
}

export default useBreakpoint;
