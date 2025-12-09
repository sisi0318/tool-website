'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useLazyLoad, type UseLazyLoadOptions } from '@/hooks/use-lazy-load';

/**
 * M3 Lazy Content Component
 * 
 * Wraps content for lazy loading when it enters the viewport.
 * Provides placeholder/skeleton while content is loading.
 * 
 * Requirements: 16.3
 */

export interface LazyContentProps extends UseLazyLoadOptions {
  /** Content to render when in view */
  children: React.ReactNode;
  /** Placeholder to show while loading */
  placeholder?: React.ReactNode;
  /** Whether to show a skeleton loader */
  showSkeleton?: boolean;
  /** Skeleton height (default: 200px) */
  skeletonHeight?: number | string;
  /** Custom class for the container */
  className?: string;
  /** Callback when content becomes visible */
  onVisible?: () => void;
}

/**
 * Default skeleton placeholder
 */
function SkeletonPlaceholder({ 
  height = 200, 
  className 
}: { 
  height?: number | string; 
  className?: string;
}) {
  return (
    <div
      className={cn(
        'w-full rounded-[var(--md-sys-shape-corner-medium)]',
        'bg-[var(--md-sys-color-surface-container-highest)]',
        'animate-pulse',
        className
      )}
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
      aria-hidden="true"
    />
  );
}

/**
 * M3 Lazy Content Component
 * 
 * Renders content only when it enters the viewport.
 * Uses GPU-accelerated fade-in animation for smooth appearance.
 */
const LazyContent = React.forwardRef<HTMLDivElement, LazyContentProps>(
  (
    {
      children,
      placeholder,
      showSkeleton = true,
      skeletonHeight = 200,
      className,
      onVisible,
      rootMargin = '100px',
      threshold = 0.1,
      triggerOnce = true,
      initialInView = false,
    },
    forwardedRef
  ) => {
    const { ref, isInView } = useLazyLoad<HTMLDivElement>({
      rootMargin,
      threshold,
      triggerOnce,
      initialInView,
    });

    // Combine refs
    React.useImperativeHandle(forwardedRef, () => ref.current!);

    // Call onVisible callback when content becomes visible
    React.useEffect(() => {
      if (isInView && onVisible) {
        onVisible();
      }
    }, [isInView, onVisible]);

    return (
      <div ref={ref} className={cn('relative', className)}>
        {isInView ? (
          <div
            className={cn(
              // GPU-accelerated fade-in animation
              'animate-m3-fade-in',
              'transform-gpu'
            )}
          >
            {children}
          </div>
        ) : (
          placeholder || (showSkeleton && <SkeletonPlaceholder height={skeletonHeight} />)
        )}
      </div>
    );
  }
);

LazyContent.displayName = 'LazyContent';

export { LazyContent };
