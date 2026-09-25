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
 * 起点落在这些元素里时不跟踪滑动:在输入框里拖选文字、拖滑块、在画布或预览上画框,
 * 都是工具本身的操作,不该顺带切走整个标签。
 */
const SWIPE_IGNORE_SELECTOR =
  'input, textarea, select, [contenteditable="true"], [role="slider"], canvas, svg, video, [data-no-swipe]';

function ignoresSwipeFrom(target: EventTarget | null, container: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest(SWIPE_IGNORE_SELECTOR)) return true;
  for (let element: Element | null = target; element && element !== container; element = element.parentElement) {
    const style = window.getComputedStyle(element);
    // 自己处理触摸的区域(touch-action: none 等,比如打码、表格校对的画布)
    if (style.touchAction && !['auto', 'manipulation'].includes(style.touchAction)) return true;
    // 可以横向滚动的表格、代码块:横向手势属于它们
    if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && element.scrollWidth > element.clientWidth) return true;
  }
  return false;
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
    isTracking.current = !ignoresSwipeFrom(e.target, e.currentTarget);
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
    const deltaY = touch.clientY - startY.current;

    // 距离够、且明显是横向手势才算:斜着往下滚动页面时不切标签
    if (Math.abs(deltaX) >= threshold && Math.abs(deltaX) > 2 * Math.abs(deltaY)) {
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
