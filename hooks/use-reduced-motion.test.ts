/**
 * Tests for useReducedMotion hook
 * 
 * Requirements: 12.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReducedMotion, getAnimationDuration, getTransitionStyle } from './use-reduced-motion';

describe('useReducedMotion', () => {
  let matchMediaMock: ReturnType<typeof vi.fn>;
  let addEventListenerMock: ReturnType<typeof vi.fn>;
  let removeEventListenerMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    addEventListenerMock = vi.fn();
    removeEventListenerMock = vi.fn();
    
    matchMediaMock = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
      dispatchEvent: vi.fn(),
    }));
    
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaMock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return false when reduced motion is not preferred', () => {
    matchMediaMock.mockImplementation(() => ({
      matches: false,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
    }));

    const { result } = renderHook(() => useReducedMotion());
    
    expect(result.current).toBe(false);
  });

  it('should return true when reduced motion is preferred', () => {
    matchMediaMock.mockImplementation(() => ({
      matches: true,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
    }));

    const { result } = renderHook(() => useReducedMotion());
    
    expect(result.current).toBe(true);
  });

  it('should query the correct media query', () => {
    renderHook(() => useReducedMotion());
    
    expect(matchMediaMock).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('should add event listener for changes', () => {
    renderHook(() => useReducedMotion());
    
    expect(addEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('should remove event listener on unmount', () => {
    const { unmount } = renderHook(() => useReducedMotion());
    
    unmount();
    
    expect(removeEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('should update when preference changes', () => {
    let changeHandler: ((event: MediaQueryListEvent) => void) | null = null;
    
    matchMediaMock.mockImplementation(() => ({
      matches: false,
      addEventListener: (event: string, handler: (event: MediaQueryListEvent) => void) => {
        if (event === 'change') {
          changeHandler = handler;
        }
      },
      removeEventListener: removeEventListenerMock,
    }));

    const { result } = renderHook(() => useReducedMotion());
    
    expect(result.current).toBe(false);
    
    // Simulate preference change
    act(() => {
      if (changeHandler) {
        changeHandler({ matches: true } as MediaQueryListEvent);
      }
    });
    
    expect(result.current).toBe(true);
  });
});

describe('getAnimationDuration', () => {
  it('should return 0 when reduced motion is preferred', () => {
    expect(getAnimationDuration(300, true)).toBe(0);
    expect(getAnimationDuration(500, true)).toBe(0);
    expect(getAnimationDuration(1000, true)).toBe(0);
  });

  it('should return original duration when reduced motion is not preferred', () => {
    expect(getAnimationDuration(300, false)).toBe(300);
    expect(getAnimationDuration(500, false)).toBe(500);
    expect(getAnimationDuration(1000, false)).toBe(1000);
  });
});

describe('getTransitionStyle', () => {
  it('should return "none" when reduced motion is preferred', () => {
    expect(getTransitionStyle('all 300ms ease', true)).toBe('none');
    expect(getTransitionStyle('transform 500ms cubic-bezier(0.2, 0, 0, 1)', true)).toBe('none');
  });

  it('should return original transition when reduced motion is not preferred', () => {
    const transition1 = 'all 300ms ease';
    const transition2 = 'transform 500ms cubic-bezier(0.2, 0, 0, 1)';
    
    expect(getTransitionStyle(transition1, false)).toBe(transition1);
    expect(getTransitionStyle(transition2, false)).toBe(transition2);
  });
});
