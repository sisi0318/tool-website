'use client';

import { useState, useCallback, useRef } from 'react';

/**
 * Swipe Gesture Hook
 * 
 * Detects horizontal swipe gestures for tab switching and other interactions.
 * Implements M3 motion guidelines for gesture-based navigation.
 * 
 * Requirements: 17.1
 */

export interface SwipeConfig {
  /** Minimum distance in pixels to trigger a swipe */
  threshold?: number;
  /** Maximum vertical distance allowed during horizontal swipe */
  maxVerticalDistance?: number;
  /** Callback when swiping left */
  onSwipeLeft?: () => void;
  /** Callback when swiping right */
  onSwipeRight?: () => void;
}

export interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

export interface UseSwipeResult {
  /** Touch event handlers to spread on the element */
  handlers: SwipeHandlers;
  /** Whether a swipe is currently in progress */
  isSwiping: boolean;
  /** Current swipe direction during gesture */
  swipeDirection: 'left' | 'right' | null;
  /** Current horizontal offset during swipe */
  swipeOffset: number;
}

/**
 * Hook for detecting horizontal swipe gestures
 * 
 * @param config - Swipe configuration options
 * @returns Swipe handlers and state
 * 
 * @example
 * ```tsx
 * function TabContainer() {
 *   const { handlers, swipeOffset } = useSwipe({
 *     threshold: 50,
 *     onSwipeLeft: () => goToNextTab(),
 *     onSwipeRight: () => goToPrevTab(),
 *   });
 *   
 *   return (
 *     <div {...handlers} style={{ transform: `translateX(${swipeOffset}px)` }}>
 *       {content}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSwipe(config: SwipeConfig = {}): UseSwipeResult {
  const {
    threshold = 50,
    maxVerticalDistance = 100,
    onSwipeLeft,
    onSwipeRight,
  } = config;

  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const startX = useRef<number>(0);
  const startY = useRef<number>(0);
  const isTracking = useRef<boolean>(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    isTracking.current = true;
    setIsSwiping(false);
    setSwipeDirection(null);
    setSwipeOffset(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isTracking.current) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - startX.current;
    const deltaY = touch.clientY - startY.current;

    // Check if vertical movement exceeds threshold - cancel horizontal swipe
    if (Math.abs(deltaY) > maxVerticalDistance) {
      isTracking.current = false;
      setIsSwiping(false);
      setSwipeDirection(null);
      setSwipeOffset(0);
      return;
    }

    // Only track horizontal swipes
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      setIsSwiping(true);
      setSwipeOffset(deltaX);
      setSwipeDirection(deltaX > 0 ? 'right' : 'left');
    }
  }, [maxVerticalDistance]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isTracking.current) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - startX.current;

    // Check if swipe distance exceeds threshold
    if (Math.abs(deltaX) >= threshold) {
      if (deltaX > 0) {
        onSwipeRight?.();
      } else {
        onSwipeLeft?.();
      }
    }

    // Reset state
    isTracking.current = false;
    setIsSwiping(false);
    setSwipeDirection(null);
    setSwipeOffset(0);
  }, [threshold, onSwipeLeft, onSwipeRight]);

  return {
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    isSwiping,
    swipeDirection,
    swipeOffset,
  };
}

export default useSwipe;
