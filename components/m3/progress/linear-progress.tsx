'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * M3 Linear Progress Component
 * 
 * Implements Material You 3 Expressive linear progress indicator with:
 * - Determinate mode (shows specific progress value)
 * - Indeterminate mode (shows ongoing activity)
 * - M3 color tokens for track and indicator
 * - M3 motion tokens for smooth animations
 * 
 * Requirements: 4.10
 */

/**
 * M3 Linear Progress track variant styles
 */
const m3LinearProgressTrackVariants = cva(
  [
    'relative w-full overflow-hidden',
    'rounded-[var(--md-sys-shape-corner-full)]',
    'bg-[var(--md-sys-color-surface-container-highest)]',
  ].join(' '),
  {
    variants: {
      size: {
        default: 'h-1',
        large: 'h-2',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
);

/**
 * M3 Linear Progress indicator variant styles
 */
const m3LinearProgressIndicatorVariants = cva(
  [
    'absolute h-full',
    'rounded-[var(--md-sys-shape-corner-full)]',
    'bg-[var(--md-sys-color-primary)]',
  ].join(' '),
  {
    variants: {
      size: {
        default: '',
        large: '',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
);

export interface M3LinearProgressProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof m3LinearProgressTrackVariants> {
  /** Progress value from 0 to 100. If undefined, shows indeterminate animation */
  value?: number;
  /** Maximum value (default: 100) */
  max?: number;
  /** Accessible label for the progress bar */
  'aria-label'?: string;
  /** ID of element that labels this progress bar */
  'aria-labelledby'?: string;
}

/**
 * M3 Linear Progress Component
 * 
 * A Material You 3 Expressive linear progress indicator with support for:
 * - Determinate mode with specific progress value
 * - Indeterminate mode with animated indicator
 * - Two sizes: default (4px) and large (8px)
 * - M3 color tokens for track and indicator
 */
const M3LinearProgress = React.forwardRef<HTMLDivElement, M3LinearProgressProps>(
  (
    {
      className,
      size = 'default',
      value,
      max = 100,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      ...props
    },
    ref
  ) => {
    const isIndeterminate = value === undefined;
    const normalizedValue = isIndeterminate ? 0 : Math.min(Math.max(0, value), max);
    const percentage = (normalizedValue / max) * 100;

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={isIndeterminate ? undefined : normalizedValue}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={cn(m3LinearProgressTrackVariants({ size }), className)}
        {...props}
      >
        <div
          className={cn(
            m3LinearProgressIndicatorVariants({ size }),
            isIndeterminate
              ? 'animate-m3-linear-progress-indeterminate'
              : 'transition-[width] duration-[var(--md-sys-motion-duration-medium2)] ease-[var(--md-sys-motion-easing-standard)]'
          )}
          style={
            isIndeterminate
              ? undefined
              : { width: `${percentage}%`, left: 0 }
          }
        />
      </div>
    );
  }
);

M3LinearProgress.displayName = 'M3LinearProgress';

export {
  M3LinearProgress,
  m3LinearProgressTrackVariants,
  m3LinearProgressIndicatorVariants,
};
