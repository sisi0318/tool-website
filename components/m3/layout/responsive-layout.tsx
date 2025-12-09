'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useBreakpoint, type M3LayoutMode } from '@/hooks/use-breakpoint';
import { M3NavigationBar, type NavigationItem } from '@/components/m3/navigation/navigation-bar';
import { M3NavigationRail } from '@/components/m3/navigation/navigation-rail';
import { cn } from '@/lib/utils';

/**
 * M3 Responsive Layout Component
 * 
 * Provides a responsive layout wrapper that:
 * - Handles navigation switching between Bar (mobile) and Rail (desktop)
 * - Animates layout transitions using M3 motion tokens
 * - Adapts content area based on viewport size
 * 
 * Requirements: 6.4
 */

export interface ResponsiveLayoutProps {
  /** The main content to render */
  children: React.ReactNode;
  /** Navigation items for the navigation components */
  navigationItems?: NavigationItem[];
  /** Currently active navigation item ID */
  activeNavigationItem?: string;
  /** Callback when a navigation item is clicked */
  onNavigationItemClick?: (id: string) => void;
  /** FAB element to display in the navigation rail (desktop only) */
  fab?: React.ReactNode;
  /** Whether to show navigation components */
  showNavigation?: boolean;
  /** Additional CSS classes for the layout container */
  className?: string;
  /** Additional CSS classes for the content area */
  contentClassName?: string;
}

/**
 * Hook for tracking layout mode transitions with animation state
 */
function useLayoutTransition(layoutMode: M3LayoutMode) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [previousMode, setPreviousMode] = useState<M3LayoutMode>(layoutMode);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (layoutMode !== previousMode) {
      setIsTransitioning(true);
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // M3 medium2 duration (300ms) for layout transitions
      timeoutRef.current = setTimeout(() => {
        setIsTransitioning(false);
        setPreviousMode(layoutMode);
      }, 300);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [layoutMode, previousMode]);

  return { isTransitioning, previousMode };
}

/**
 * M3 Responsive Layout Component
 * 
 * A Material You 3 responsive layout wrapper that automatically switches
 * between Navigation Bar (mobile) and Navigation Rail (desktop) based on
 * viewport width, with smooth animated transitions.
 */
export function ResponsiveLayout({
  children,
  navigationItems = [],
  activeNavigationItem = '',
  onNavigationItemClick,
  fab,
  showNavigation = true,
  className,
  contentClassName,
}: ResponsiveLayoutProps) {
  const { layoutMode, isCompact, isMedium, isExpanded } = useBreakpoint();
  const { isTransitioning } = useLayoutTransition(layoutMode);

  // Determine which navigation to show
  const showNavigationBar = showNavigation && isCompact;
  const showNavigationRail = showNavigation && (isMedium || isExpanded);

  // Handle navigation item click
  const handleNavigationClick = (id: string) => {
    onNavigationItemClick?.(id);
  };

  return (
    <div
      className={cn(
        // Base layout styles
        'min-h-screen w-full',
        // Transition animation for layout changes
        'transition-all',
        'duration-[var(--md-sys-motion-duration-medium2)]',
        'ease-[var(--md-sys-motion-easing-standard)]',
        // Add transitioning state for potential animation hooks
        isTransitioning && 'layout-transitioning',
        className
      )}
      data-layout-mode={layoutMode}
      data-transitioning={isTransitioning}
    >
      {/* Navigation Rail (Desktop/Tablet) */}
      {showNavigationRail && navigationItems.length > 0 && (
        <M3NavigationRail
          items={navigationItems}
          activeItem={activeNavigationItem}
          onItemClick={handleNavigationClick}
          fab={fab}
          className={cn(
            // Animate rail entrance/exit
            'transition-transform',
            'duration-[var(--md-sys-motion-duration-medium2)]',
            'ease-[var(--md-sys-motion-easing-emphasized)]',
            isTransitioning && 'translate-x-0'
          )}
        />
      )}

      {/* Main Content Area */}
      <main
        className={cn(
          // Base content styles
          'min-h-screen',
          'transition-all',
          'duration-[var(--md-sys-motion-duration-medium2)]',
          'ease-[var(--md-sys-motion-easing-standard)]',
          // Adjust padding based on navigation presence
          showNavigationRail && 'ml-20', // 80px for navigation rail width
          showNavigationBar && 'pb-20',  // 80px for navigation bar height
          // Responsive padding
          isCompact && 'px-4',
          isMedium && 'px-6',
          isExpanded && 'px-8',
          contentClassName
        )}
      >
        {children}
      </main>

      {/* Navigation Bar (Mobile) */}
      {showNavigationBar && navigationItems.length > 0 && (
        <M3NavigationBar
          items={navigationItems}
          activeItem={activeNavigationItem}
          onItemClick={handleNavigationClick}
          className={cn(
            // Animate bar entrance/exit
            'transition-transform',
            'duration-[var(--md-sys-motion-duration-medium2)]',
            'ease-[var(--md-sys-motion-easing-emphasized)]',
            isTransitioning && 'translate-y-0'
          )}
        />
      )}
    </div>
  );
}

/**
 * Content wrapper component for responsive layouts
 * Provides consistent spacing and max-width constraints
 */
export interface ResponsiveContentProps {
  /** The content to render */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Maximum width constraint */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  /** Whether to center the content */
  centered?: boolean;
}

export function ResponsiveContent({
  children,
  className,
  maxWidth = 'xl',
  centered = true,
}: ResponsiveContentProps) {
  const { layoutMode } = useBreakpoint();

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-full',
  };

  return (
    <div
      className={cn(
        'w-full',
        maxWidthClasses[maxWidth],
        centered && 'mx-auto',
        // Responsive vertical padding
        layoutMode === 'compact' && 'py-4',
        layoutMode === 'medium' && 'py-6',
        layoutMode === 'expanded' && 'py-8',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Grid wrapper component for responsive layouts
 * Automatically adjusts columns based on viewport
 */
export interface ResponsiveGridProps {
  /** The grid items to render */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Minimum column width for auto-fit */
  minColumnWidth?: string;
  /** Gap between grid items */
  gap?: 'sm' | 'md' | 'lg';
}

export function ResponsiveGrid({
  children,
  className,
  minColumnWidth = '280px',
  gap = 'md',
}: ResponsiveGridProps) {
  const { layoutMode } = useBreakpoint();

  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  };

  // Determine column count based on layout mode
  const getGridColumns = () => {
    switch (layoutMode) {
      case 'compact':
        return 'grid-cols-1';
      case 'medium':
        return 'grid-cols-2';
      case 'expanded':
        return `grid-cols-[repeat(auto-fit,minmax(${minColumnWidth},1fr))]`;
      default:
        return 'grid-cols-1';
    }
  };

  return (
    <div
      className={cn(
        'grid',
        getGridColumns(),
        gapClasses[gap],
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Hook for responsive layout utilities
 */
export function useResponsiveLayout() {
  const breakpoint = useBreakpoint();
  
  return {
    ...breakpoint,
    // Navigation helpers
    shouldShowNavigationBar: breakpoint.isCompact,
    shouldShowNavigationRail: breakpoint.isMedium || breakpoint.isExpanded,
    // Content helpers
    contentPadding: breakpoint.isCompact ? 16 : breakpoint.isMedium ? 24 : 32,
    // Grid helpers
    gridColumns: breakpoint.isCompact ? 1 : breakpoint.isMedium ? 2 : 'auto',
  };
}

export default ResponsiveLayout;
