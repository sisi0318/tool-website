'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Pull-to-Refresh Hook
 * 
 * Detects vertical pull-down gestures to trigger refresh actions.
 * Implements M3 motion guidelines for gesture-based interactions.
 * 
 * Requirements: 17.2
 */

export interface PullToRefreshConfig {
  /** Minimum distance in pixels to trigger refresh (default: 80) */
  threshold?: number;
  /** Maximum pull distance in pixels (default: 150) */
  maxPullDistance?: number;
  /** Callback when refresh is triggered */
  onRefresh?: () => Promise<void> | void;
  /** Whether pull-to-refresh is enabled (default: true) */
  enabled?: boolean;
}

export interface PullToRefreshHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

export interface UsePullToRefreshResult {
  /** Touch event handlers to spread on the scrollable element */
  handlers: PullToRefreshHandlers;
  /** Whether a pull gesture is currently in progress */
  isPulling: boolean;
  /** Whether refresh is currently in progress */
  isRefreshing: boolean;
  /** Current pull distance (0 to maxPullDistance) */
  pullDistance: number;
  /** Progress value from 0 to 1 based on threshold */
  pullProgress: number;
}

/**
 * Hook for detecting pull-to-refresh gestures
 * 
 * @param config - Pull-to-refresh configuration options
 * @returns Pull-to-refresh handlers and state
 * 
 * @example
 * ```tsx
 * function ScrollableContent() {
 *   const { handlers, isPulling, isRefreshing, pullDistance, pullProgress } = usePullToRefresh({
 *     threshold: 80,
 *     onRefresh: async () => {
 *       await fetchData();
 *     },
 *   });
 *   
 *   return (
 *     <div {...handlers} className="overflow-y-auto">
 *       {isPulling && (
 *         <div style={{ height: pullDistance }}>
 *           <CircularProgress value={pullProgress * 100} />
 *         </div>
 *       )}
 *       {content}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePullToRefresh(config: PullToRefreshConfig = {}): UsePullToRefreshResult {
  const {
    threshold = 80,
    maxPullDistance = 150,
    onRefresh,
    enabled = true,
  } = config;

  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const startY = useRef<number>(0);
  const isTracking = useRef<boolean>(false);
  const scrollableElement = useRef<HTMLElement | null>(null);

  // Calculate pull progress (0 to 1)
  const pullProgress = Math.min(pullDistance / threshold, 1);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled || isRefreshing) return;

    // Find the scrollable parent element
    const target = e.currentTarget as HTMLElement;
    scrollableElement.current = target;

    // Only start tracking if at the top of scroll
    if (target.scrollTop <= 0) {
      const touch = e.touches[0];
      startY.current = touch.clientY;
      isTracking.current = true;
    }
  }, [enabled, isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isTracking.current || !enabled || isRefreshing) return;

    const target = e.currentTarget as HTMLElement;
    
    // Stop tracking if user scrolled down
    if (target.scrollTop > 0) {
      isTracking.current = false;
      setIsPulling(false);
      setPullDistance(0);
      return;
    }

    const touch = e.touches[0];
    const deltaY = touch.clientY - startY.current;

    // Only track downward pulls
    if (deltaY > 0) {
      // Apply resistance to make pull feel natural
      const resistance = 0.5;
      const adjustedDistance = Math.min(deltaY * resistance, maxPullDistance);
      
      setIsPulling(true);
      setPullDistance(adjustedDistance);

      // Prevent default scroll behavior when pulling
      if (adjustedDistance > 0) {
        e.preventDefault();
      }
    } else {
      setIsPulling(false);
      setPullDistance(0);
    }
  }, [enabled, isRefreshing, maxPullDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!isTracking.current || !enabled) return;

    isTracking.current = false;

    // Check if pull distance exceeds threshold
    if (pullDistance >= threshold && onRefresh) {
      setIsRefreshing(true);
      setPullDistance(threshold); // Keep indicator visible during refresh

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setIsPulling(false);
        setPullDistance(0);
      }
    } else {
      // Reset state with animation
      setIsPulling(false);
      setPullDistance(0);
    }
  }, [enabled, pullDistance, threshold, onRefresh]);

  // Reset state when disabled
  useEffect(() => {
    if (!enabled) {
      setIsPulling(false);
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [enabled]);

  return {
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    isPulling,
    isRefreshing,
    pullDistance,
    pullProgress,
  };
}

export default usePullToRefresh;
