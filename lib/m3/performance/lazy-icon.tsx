'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * M3 Lazy Icon Component
 * 
 * Implements lazy loading for SVG icons to improve initial load performance.
 * Uses dynamic imports to load icons only when needed.
 * 
 * Requirements: 16.3
 * 
 * Features:
 * - Dynamic import for code splitting
 * - Placeholder while loading
 * - GPU-accelerated fade-in animation
 * - Error state handling
 */

export interface LazyIconProps extends React.SVGAttributes<SVGSVGElement> {
  /** Icon name from lucide-react */
  name: string;
  /** Icon size (default: 24) */
  size?: number;
  /** Stroke width (default: 2) */
  strokeWidth?: number;
  /** Whether to show a placeholder while loading */
  showPlaceholder?: boolean;
  /** Custom fallback component */
  fallback?: React.ReactNode;
}

/**
 * Icon placeholder component
 */
function IconPlaceholder({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-[var(--md-sys-shape-corner-small)]',
        'bg-[var(--md-sys-color-surface-container-highest)]',
        'animate-pulse',
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

/**
 * Cache for loaded icons to prevent re-fetching
 */
const iconCache = new Map<string, React.ComponentType<React.SVGAttributes<SVGSVGElement>>>();

/**
 * M3 Lazy Icon Component
 * 
 * A performant icon component with lazy loading support.
 * Dynamically imports icons from lucide-react to reduce initial bundle size.
 */
const LazyIcon = React.forwardRef<SVGSVGElement, LazyIconProps>(
  (
    {
      name,
      size = 24,
      strokeWidth = 2,
      showPlaceholder = true,
      fallback,
      className,
      ...props
    },
    ref
  ) => {
    const [IconComponent, setIconComponent] = React.useState<React.ComponentType<React.SVGAttributes<SVGSVGElement>> | null>(
      () => iconCache.get(name) || null
    );
    const [isLoading, setIsLoading] = React.useState(!iconCache.has(name));
    const [hasError, setHasError] = React.useState(false);

    React.useEffect(() => {
      // Check cache first
      if (iconCache.has(name)) {
        setIconComponent(() => iconCache.get(name)!);
        setIsLoading(false);
        return;
      }

      let isMounted = true;

      const loadIcon = async () => {
        try {
          // Dynamic import from lucide-react
          const icons = await import('lucide-react');
          
          // Convert kebab-case to PascalCase for icon name
          const pascalName = name
            .split('-')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join('');

          const Icon = (icons as Record<string, React.ComponentType<React.SVGAttributes<SVGSVGElement>>>)[pascalName];

          if (Icon && isMounted) {
            iconCache.set(name, Icon);
            setIconComponent(() => Icon);
            setIsLoading(false);
          } else if (isMounted) {
            setHasError(true);
            setIsLoading(false);
          }
        } catch (error) {
          if (isMounted) {
            setHasError(true);
            setIsLoading(false);
          }
        }
      };

      loadIcon();

      return () => {
        isMounted = false;
      };
    }, [name]);

    // Loading state
    if (isLoading) {
      if (fallback) return <>{fallback}</>;
      if (showPlaceholder) return <IconPlaceholder size={size} className={className} />;
      return null;
    }

    // Error state
    if (hasError || !IconComponent) {
      if (fallback) return <>{fallback}</>;
      return (
        <svg
          ref={ref}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn('opacity-50', className)}
          aria-hidden="true"
          {...props}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
    }

    // Render loaded icon with fade-in animation
    return (
      <IconComponent
        ref={ref}
        width={size}
        height={size}
        strokeWidth={strokeWidth}
        className={cn(
          // GPU-accelerated fade-in
          'transition-opacity duration-[var(--md-sys-motion-duration-short4)] ease-[var(--md-sys-motion-easing-standard)]',
          'transform-gpu',
          className
        )}
        aria-hidden="true"
        {...props}
      />
    );
  }
);

LazyIcon.displayName = 'LazyIcon';

/**
 * Preload icons for critical paths
 * Call this to preload icons that will be needed immediately
 * 
 * @param iconNames - Array of icon names to preload
 */
export async function preloadIcons(iconNames: string[]): Promise<void> {
  try {
    const icons = await import('lucide-react');
    
    iconNames.forEach((name) => {
      const pascalName = name
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
      
      const Icon = (icons as Record<string, React.ComponentType<React.SVGAttributes<SVGSVGElement>>>)[pascalName];
      
      if (Icon) {
        iconCache.set(name, Icon);
      }
    });
  } catch (error) {
    console.warn('Failed to preload icons:', error);
  }
}

/**
 * Clear the icon cache
 * Useful for memory management in long-running applications
 */
export function clearIconCache(): void {
  iconCache.clear();
}

export { LazyIcon };
