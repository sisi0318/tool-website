'use client';

import * as React from 'react';

/**
 * useLazyLoad Hook
 * 
 * A hook for lazy loading content when it enters the viewport.
 * Uses IntersectionObserver for efficient visibility detection.
 * 
 * Requirements: 16.3
 * 
 * @param options - IntersectionObserver options
 * @returns Object with ref to attach to element and isInView state
 */

export interface UseLazyLoadOptions {
  /** Root margin for IntersectionObserver (default: '100px') */
  rootMargin?: string;
  /** Threshold for IntersectionObserver (default: 0.1) */
  threshold?: number;
  /** Whether to trigger only once (default: true) */
  triggerOnce?: boolean;
  /** Initial state (default: false) */
  initialInView?: boolean;
}

export interface UseLazyLoadReturn<T extends HTMLElement> {
  /** Ref to attach to the element */
  ref: React.RefObject<T>;
  /** Whether the element is in view */
  isInView: boolean;
  /** Manually set the element as in view */
  setInView: () => void;
}

/**
 * Hook for lazy loading content when it enters the viewport
 * 
 * @example
 * ```tsx
 * function LazyComponent() {
 *   const { ref, isInView } = useLazyLoad<HTMLDivElement>();
 *   
 *   return (
 *     <div ref={ref}>
 *       {isInView ? <ExpensiveContent /> : <Placeholder />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useLazyLoad<T extends HTMLElement = HTMLDivElement>(
  options: UseLazyLoadOptions = {}
): UseLazyLoadReturn<T> {
  const {
    rootMargin = '100px',
    threshold = 0.1,
    triggerOnce = true,
    initialInView = false,
  } = options;

  const ref = React.useRef<T>(null);
  const [isInView, setIsInView] = React.useState(initialInView);

  const setInView = React.useCallback(() => {
    setIsInView(true);
  }, []);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // If already in view and triggerOnce, don't observe
    if (isInView && triggerOnce) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            if (triggerOnce) {
              observer.unobserve(element);
            }
          } else if (!triggerOnce) {
            setIsInView(false);
          }
        });
      },
      {
        rootMargin,
        threshold,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin, threshold, triggerOnce, isInView]);

  return { ref, isInView, setInView };
}

/**
 * Hook for preloading content before it enters the viewport
 * Useful for critical content that should be ready when scrolled to
 * 
 * @param preloadFn - Function to call when element is about to enter viewport
 * @param options - IntersectionObserver options with larger default rootMargin
 */
export function usePreload<T extends HTMLElement = HTMLDivElement>(
  preloadFn: () => void | Promise<void>,
  options: UseLazyLoadOptions = {}
): UseLazyLoadReturn<T> {
  const {
    rootMargin = '200px', // Larger margin for preloading
    threshold = 0,
    triggerOnce = true,
    initialInView = false,
  } = options;

  const result = useLazyLoad<T>({
    rootMargin,
    threshold,
    triggerOnce,
    initialInView,
  });

  const hasPreloaded = React.useRef(false);

  React.useEffect(() => {
    if (result.isInView && !hasPreloaded.current) {
      hasPreloaded.current = true;
      preloadFn();
    }
  }, [result.isInView, preloadFn]);

  return result;
}

export default useLazyLoad;
