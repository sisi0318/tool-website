'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Long Press Hook
 * 
 * Detects long-press gestures on touch devices for context menu interactions.
 * Implements M3 motion guidelines for gesture-based interactions.
 * 
 * Requirements: 17.3
 */

export interface LongPressConfig {
  /** Duration in milliseconds to trigger long press (default: 500) */
  duration?: number;
  /** Callback when long press is triggered */
  onLongPress?: (event: React.TouchEvent | React.MouseEvent) => void;
  /** Callback when press starts */
  onPressStart?: () => void;
  /** Callback when press ends (without triggering long press) */
  onPressEnd?: () => void;
  /** Whether long press is enabled (default: true) */
  enabled?: boolean;
  /** Maximum movement in pixels before canceling (default: 10) */
  moveThreshold?: number;
}

export interface LongPressHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchCancel: (e: React.TouchEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export interface UseLongPressResult {
  /** Event handlers to spread on the element */
  handlers: LongPressHandlers;
  /** Whether a long press is currently in progress (timer running) */
  isPressed: boolean;
  /** Whether the long press has been triggered */
  isLongPressed: boolean;
}

/**
 * Hook for detecting long-press gestures
 * 
 * @param config - Long press configuration options
 * @returns Long press handlers and state
 * 
 * @example
 * ```tsx
 * function ToolCard({ tool }) {
 *   const [showMenu, setShowMenu] = useState(false);
 *   const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
 *   
 *   const { handlers, isPressed } = useLongPress({
 *     duration: 500,
 *     onLongPress: (e) => {
 *       const touch = e.touches?.[0] || e;
 *       setMenuPosition({ x: touch.clientX, y: touch.clientY });
 *       setShowMenu(true);
 *     },
 *   });
 *   
 *   return (
 *     <div {...handlers} className={isPressed ? 'scale-95' : ''}>
 *       {content}
 *       {showMenu && <ContextMenu position={menuPosition} />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useLongPress(config: LongPressConfig = {}): UseLongPressResult {
  const {
    duration = 500,
    onLongPress,
    onPressStart,
    onPressEnd,
    enabled = true,
    moveThreshold = 10,
  } = config;

  const [isPressed, setIsPressed] = useState(false);
  const [isLongPressed, setIsLongPressed] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosition = useRef<{ x: number; y: number } | null>(null);
  const eventRef = useRef<React.TouchEvent | React.MouseEvent | null>(null);

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startPress = useCallback((x: number, y: number, event: React.TouchEvent | React.MouseEvent) => {
    if (!enabled) return;

    clearTimer();
    startPosition.current = { x, y };
    eventRef.current = event;
    setIsPressed(true);
    setIsLongPressed(false);
    onPressStart?.();

    timerRef.current = setTimeout(() => {
      setIsLongPressed(true);
      if (eventRef.current) {
        onLongPress?.(eventRef.current);
      }
    }, duration);
  }, [enabled, duration, onLongPress, onPressStart, clearTimer]);

  const checkMovement = useCallback((x: number, y: number) => {
    if (!startPosition.current) return false;
    
    const deltaX = Math.abs(x - startPosition.current.x);
    const deltaY = Math.abs(y - startPosition.current.y);
    
    return deltaX > moveThreshold || deltaY > moveThreshold;
  }, [moveThreshold]);

  const cancelPress = useCallback(() => {
    clearTimer();
    if (isPressed && !isLongPressed) {
      onPressEnd?.();
    }
    setIsPressed(false);
    startPosition.current = null;
    eventRef.current = null;
  }, [clearTimer, isPressed, isLongPressed, onPressEnd]);

  const endPress = useCallback(() => {
    clearTimer();
    if (isPressed && !isLongPressed) {
      onPressEnd?.();
    }
    setIsPressed(false);
    setIsLongPressed(false);
    startPosition.current = null;
    eventRef.current = null;
  }, [clearTimer, isPressed, isLongPressed, onPressEnd]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startPress(touch.clientX, touch.clientY, e);
  }, [startPress]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (checkMovement(touch.clientX, touch.clientY)) {
      cancelPress();
    }
  }, [checkMovement, cancelPress]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    // Prevent click event if long press was triggered
    if (isLongPressed) {
      e.preventDefault();
    }
    endPress();
  }, [isLongPressed, endPress]);

  const handleTouchCancel = useCallback(() => {
    cancelPress();
  }, [cancelPress]);

  // Mouse handlers (for desktop support)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only handle left click
    if (e.button !== 0) return;
    startPress(e.clientX, e.clientY, e);
  }, [startPress]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (checkMovement(e.clientX, e.clientY)) {
      cancelPress();
    }
  }, [checkMovement, cancelPress]);

  const handleMouseUp = useCallback(() => {
    endPress();
  }, [endPress]);

  const handleMouseLeave = useCallback(() => {
    cancelPress();
  }, [cancelPress]);

  // Prevent default context menu on right-click
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (enabled && onLongPress) {
      e.preventDefault();
      onLongPress(e);
    }
  }, [enabled, onLongPress]);

  return {
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel,
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseLeave,
      onContextMenu: handleContextMenu,
    },
    isPressed,
    isLongPressed,
  };
}

export default useLongPress;
