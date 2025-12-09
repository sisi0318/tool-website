'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';

/**
 * M3 Mobile Tool Layout Component
 * 
 * Provides a mobile-optimized layout for tool pages with:
 * - Vertical stacking for input/output sections on compact viewports
 * - Full-width button styling
 * - Keyboard visibility handling
 * 
 * Requirements: 15.1, 15.2, 15.3, 13.5
 */

export interface MobileToolLayoutProps {
  /** The content to render in the layout */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Whether to enable keyboard visibility handling */
  enableKeyboardHandling?: boolean;
}

export interface MobileToolSectionProps {
  /** The content to render in the section */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Section type for semantic styling */
  type?: 'input' | 'output' | 'actions' | 'default';
}

export interface MobileToolActionsProps {
  /** The action buttons to render */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Whether to use sticky positioning at bottom */
  sticky?: boolean;
}

/**
 * Determines if the layout should use vertical stacking based on viewport width
 * 
 * @param width - The viewport width in pixels
 * @returns true if width < 600px (compact layout), false otherwise
 */
export function shouldStackVertically(width: number): boolean {
  return width < 600;
}

/**
 * Main mobile tool layout container
 * Automatically applies vertical stacking on compact viewports
 */
export function MobileToolLayout({
  children,
  className,
  enableKeyboardHandling = true,
}: MobileToolLayoutProps) {
  const { isCompact, width } = useBreakpoint();
  const containerRef = useRef<HTMLDivElement>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Handle keyboard visibility on mobile
  useEffect(() => {
    if (!enableKeyboardHandling || typeof window === 'undefined') return;

    const handleResize = () => {
      // On mobile, when keyboard opens, the visual viewport height decreases
      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        // If visual viewport is significantly smaller than window, keyboard is likely open
        setKeyboardVisible(viewportHeight < windowHeight * 0.75);
      }
    };

    // Listen to visual viewport changes for keyboard detection
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      return () => {
        window.visualViewport?.removeEventListener('resize', handleResize);
      };
    }
  }, [enableKeyboardHandling]);

  // Scroll focused input into view when keyboard opens
  useEffect(() => {
    if (!enableKeyboardHandling || !keyboardVisible) return;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Delay to allow keyboard to fully open
        setTimeout(() => {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }, 100);
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, [enableKeyboardHandling, keyboardVisible]);

  const isVerticalStack = shouldStackVertically(width);

  return (
    <div
      ref={containerRef}
      className={cn(
        // Base styles
        'w-full',
        // Vertical stacking on compact viewports (< 600px)
        isVerticalStack && 'flex flex-col',
        // M3 spacing: 16dp between sections
        isVerticalStack && 'gap-4',
        // Padding for mobile
        isCompact && 'px-4 py-4',
        // Handle keyboard visibility
        keyboardVisible && 'pb-0',
        className
      )}
      data-layout-mode={isVerticalStack ? 'vertical' : 'horizontal'}
      data-keyboard-visible={keyboardVisible}
    >
      {children}
    </div>
  );
}

/**
 * Section component for input/output areas
 * Automatically stacks vertically on compact viewports
 */
export function MobileToolSection({
  children,
  className,
  type = 'default',
}: MobileToolSectionProps) {
  const { isCompact } = useBreakpoint();

  return (
    <div
      className={cn(
        // Base styles
        'w-full',
        // Full width on compact viewports
        isCompact && 'max-w-full',
        // Section-specific styling
        type === 'input' && 'order-1',
        type === 'output' && 'order-2',
        type === 'actions' && 'order-3',
        className
      )}
      data-section-type={type}
    >
      {children}
    </div>
  );
}

/**
 * Actions container for full-width buttons on mobile
 * Supports sticky positioning at bottom
 */
export function MobileToolActions({
  children,
  className,
  sticky = false,
}: MobileToolActionsProps) {
  const { isCompact } = useBreakpoint();

  return (
    <div
      className={cn(
        // Base styles
        'w-full',
        // Full-width button container on mobile
        isCompact && 'flex flex-col gap-3',
        // Sticky positioning at bottom
        sticky && isCompact && 'sticky bottom-0 bg-surface py-4 -mx-4 px-4',
        // M3 surface elevation for sticky
        sticky && isCompact && 'shadow-[0_-2px_4px_rgba(0,0,0,0.1)]',
        className
      )}
      data-sticky={sticky}
    >
      {/* Apply full-width styling to button children on mobile */}
      {isCompact
        ? React.Children.map(children, (child) => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child as React.ReactElement<{ className?: string }>, {
                className: cn(
                  (child.props as { className?: string }).className,
                  'w-full'
                ),
              });
            }
            return child;
          })
        : children}
    </div>
  );
}

/**
 * Hook for detecting if layout should be vertical
 * Useful for conditional rendering in tool pages
 */
export function useMobileToolLayout() {
  const { isCompact, width, layoutMode } = useBreakpoint();
  const isVerticalStack = shouldStackVertically(width);

  return {
    isCompact,
    isVerticalStack,
    layoutMode,
    width,
  };
}

export default MobileToolLayout;
