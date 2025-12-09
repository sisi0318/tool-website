'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { M3CircularProgress } from '@/components/m3/progress';

/**
 * M3 Pull-to-Refresh Indicator Component
 * 
 * Displays a Material You 3 styled indicator during pull-to-refresh gestures.
 * Uses M3 circular progress indicator with proper animations.
 * 
 * Requirements: 17.2
 */

export interface M3PullToRefreshIndicatorProps {
  /** Whether the indicator is visible */
  visible: boolean;
  /** Current pull distance in pixels */
  pullDistance: number;
  /** Progress value from 0 to 1 */
  progress: number;
  /** Whether refresh is in progress */
  isRefreshing: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * M3 Pull-to-Refresh Indicator
 * 
 * Shows a circular progress indicator that:
 * - Scales and rotates based on pull progress
 * - Animates continuously when refreshing
 * - Uses M3 motion tokens for smooth transitions
 */
const M3PullToRefreshIndicator = React.forwardRef<
  HTMLDivElement,
  M3PullToRefreshIndicatorProps
>(
  (
    {
      visible,
      pullDistance,
      progress,
      isRefreshing,
      className,
    },
    ref
  ) => {
    if (!visible && !isRefreshing) return null;

    // Calculate scale based on progress (0.5 to 1)
    const scale = 0.5 + progress * 0.5;
    
    // Calculate rotation based on progress (0 to 360 degrees)
    const rotation = progress * 360;

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-center',
          'overflow-hidden',
          'transition-[height] duration-[var(--md-sys-motion-duration-medium2)] ease-[var(--md-sys-motion-easing-emphasized)]',
          className
        )}
        style={{
          height: visible || isRefreshing ? Math.max(pullDistance, isRefreshing ? 56 : 0) : 0,
        }}
        aria-hidden={!visible && !isRefreshing}
      >
        <div
          className={cn(
            'flex items-center justify-center',
            'w-10 h-10',
            'rounded-full',
            'bg-[var(--md-sys-color-surface-container-high)]',
            'shadow-md',
            'transition-transform duration-[var(--md-sys-motion-duration-short4)] ease-[var(--md-sys-motion-easing-standard)]'
          )}
          style={{
            transform: isRefreshing 
              ? 'scale(1)' 
              : `scale(${scale}) rotate(${rotation}deg)`,
          }}
        >
          <M3CircularProgress
            size="small"
            value={isRefreshing ? undefined : progress * 100}
            aria-label={isRefreshing ? 'Refreshing content' : 'Pull to refresh'}
          />
        </div>
      </div>
    );
  }
);

M3PullToRefreshIndicator.displayName = 'M3PullToRefreshIndicator';

export { M3PullToRefreshIndicator };
