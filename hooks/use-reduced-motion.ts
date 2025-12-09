'use client';

import { useState, useEffect } from 'react';

/**
 * Hook to detect user's reduced motion preference
 * 
 * Returns true if the user has requested reduced motion in their system settings.
 * This allows components to provide static fallback states for animations.
 * 
 * Requirements: 12.4
 * 
 * @example
 * ```tsx
 * const prefersReducedMotion = useReducedMotion();
 * 
 * return (
 *   <div className={prefersReducedMotion ? 'static-state' : 'animated-state'}>
 *     Content
 *   </div>
 * );
 * ```
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check if window is available (SSR safety)
    if (typeof window === 'undefined') {
      return;
    }

    // Create media query for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    // Set initial value
    setPrefersReducedMotion(mediaQuery.matches);

    // Listen for changes to the preference
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    // Add event listener
    mediaQuery.addEventListener('change', handleChange);

    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return prefersReducedMotion;
}

/**
 * Get animation duration based on reduced motion preference
 * 
 * Returns 0 if reduced motion is preferred, otherwise returns the provided duration.
 * 
 * @param duration - The animation duration in milliseconds
 * @param prefersReducedMotion - Whether reduced motion is preferred
 * @returns The adjusted duration
 */
export function getAnimationDuration(
  duration: number,
  prefersReducedMotion: boolean
): number {
  return prefersReducedMotion ? 0 : duration;
}

/**
 * Get transition style based on reduced motion preference
 * 
 * Returns 'none' if reduced motion is preferred, otherwise returns the provided transition.
 * 
 * @param transition - The CSS transition value
 * @param prefersReducedMotion - Whether reduced motion is preferred
 * @returns The adjusted transition value
 */
export function getTransitionStyle(
  transition: string,
  prefersReducedMotion: boolean
): string {
  return prefersReducedMotion ? 'none' : transition;
}

export default useReducedMotion;
