'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * M3 Lazy Image Component
 * 
 * Implements lazy loading for images and icons to improve initial load performance.
 * Uses native browser lazy loading with IntersectionObserver fallback.
 * 
 * Requirements: 16.3
 * 
 * Features:
 * - Native lazy loading with loading="lazy"
 * - IntersectionObserver for browsers without native support
 * - Placeholder/skeleton while loading
 * - Fade-in animation on load (GPU-accelerated)
 * - Error state handling
 */

export interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Image source URL */
  src: string;
  /** Alt text for accessibility */
  alt: string;
  /** Optional placeholder image or color */
  placeholder?: string;
  /** Whether to show a skeleton loader */
  showSkeleton?: boolean;
  /** Root margin for IntersectionObserver (default: '100px') */
  rootMargin?: string;
  /** Threshold for IntersectionObserver (default: 0.1) */
  threshold?: number;
  /** Callback when image loads successfully */
  onLoad?: () => void;
  /** Callback when image fails to load */
  onError?: () => void;
  /** Custom class for the container */
  containerClassName?: string;
}

/**
 * Skeleton loader component for image placeholder
 */
function ImageSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'absolute inset-0',
        'bg-[var(--md-sys-color-surface-container-highest)]',
        'animate-pulse',
        className
      )}
      aria-hidden="true"
    />
  );
}

/**
 * M3 Lazy Image Component
 * 
 * A performant image component with lazy loading support.
 * Uses GPU-accelerated fade-in animation for smooth appearance.
 */
const LazyImage = React.forwardRef<HTMLImageElement, LazyImageProps>(
  (
    {
      src,
      alt,
      placeholder,
      showSkeleton = true,
      rootMargin = '100px',
      threshold = 0.1,
      onLoad,
      onError,
      className,
      containerClassName,
      style,
      ...props
    },
    ref
  ) => {
    const [isLoaded, setIsLoaded] = React.useState(false);
    const [isInView, setIsInView] = React.useState(false);
    const [hasError, setHasError] = React.useState(false);
    const imgRef = React.useRef<HTMLImageElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Combine refs
    React.useImperativeHandle(ref, () => imgRef.current!);

    // IntersectionObserver for lazy loading
    React.useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      // Check if native lazy loading is supported
      if ('loading' in HTMLImageElement.prototype) {
        setIsInView(true);
        return;
      }

      // Fallback to IntersectionObserver
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsInView(true);
              observer.unobserve(container);
            }
          });
        },
        {
          rootMargin,
          threshold,
        }
      );

      observer.observe(container);

      return () => {
        observer.disconnect();
      };
    }, [rootMargin, threshold]);

    const handleLoad = () => {
      setIsLoaded(true);
      onLoad?.();
    };

    const handleError = () => {
      setHasError(true);
      onError?.();
    };

    return (
      <div
        ref={containerRef}
        className={cn(
          'relative overflow-hidden',
          containerClassName
        )}
        style={style}
      >
        {/* Skeleton/Placeholder */}
        {showSkeleton && !isLoaded && !hasError && (
          <ImageSkeleton />
        )}
        
        {/* Placeholder image */}
        {placeholder && !isLoaded && !hasError && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${placeholder})` }}
            aria-hidden="true"
          />
        )}

        {/* Actual image */}
        {isInView && !hasError && (
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            onLoad={handleLoad}
            onError={handleError}
            className={cn(
              // GPU-accelerated fade-in animation
              'transition-opacity duration-[var(--md-sys-motion-duration-medium2)] ease-[var(--md-sys-motion-easing-standard)]',
              'transform-gpu',
              isLoaded ? 'opacity-100' : 'opacity-0',
              className
            )}
            {...props}
          />
        )}

        {/* Error state */}
        {hasError && (
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center',
              'bg-[var(--md-sys-color-surface-container)]',
              'text-[var(--md-sys-color-on-surface-variant)]'
            )}
            role="img"
            aria-label={`Failed to load: ${alt}`}
          >
            <svg
              className="w-8 h-8 opacity-50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
      </div>
    );
  }
);

LazyImage.displayName = 'LazyImage';

export { LazyImage };
