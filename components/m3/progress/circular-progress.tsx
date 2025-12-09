'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * M3 Circular Progress Component
 * 
 * Implements Material You 3 Expressive circular progress indicator with:
 * - Determinate mode (shows specific progress value)
 * - Indeterminate mode (shows ongoing activity with spinning animation)
 * - M3 color tokens for track and indicator
 * - M3 motion tokens for smooth animations
 * 
 * Requirements: 4.10
 */

/**
 * M3 Circular Progress size variant styles
 */
const m3CircularProgressVariants = cva(
  [
    'inline-block',
  ].join(' '),
  {
    variants: {
      size: {
        small: 'h-6 w-6',
        default: 'h-10 w-10',
        large: 'h-12 w-12',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
);

/**
 * Stroke width mapping for each size
 */
const STROKE_WIDTH_MAP = {
  small: 3,
  default: 4,
  large: 4,
} as const;

export interface M3CircularProgressProps
  extends Omit<React.SVGAttributes<SVGSVGElement>, 'children'>,
    VariantProps<typeof m3CircularProgressVariants> {
  /** Progress value from 0 to 100. If undefined, shows indeterminate animation */
  value?: number;
  /** Maximum value (default: 100) */
  max?: number;
  /** Accessible label for the progress indicator */
  'aria-label'?: string;
  /** ID of element that labels this progress indicator */
  'aria-labelledby'?: string;
}

/**
 * M3 Circular Progress Component
 * 
 * A Material You 3 Expressive circular progress indicator with support for:
 * - Determinate mode with specific progress value
 * - Indeterminate mode with spinning animation
 * - Three sizes: small (24px), default (40px), large (48px)
 * - M3 color tokens for track and indicator
 */
const M3CircularProgress = React.forwardRef<SVGSVGElement, M3CircularProgressProps>(
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

    // SVG circle calculations
    const strokeWidth = STROKE_WIDTH_MAP[size || 'default'];
    const radius = 18; // Base radius for viewBox of 44
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <svg
        ref={ref}
        role="progressbar"
        aria-valuenow={isIndeterminate ? undefined : normalizedValue}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        viewBox="0 0 44 44"
        className={cn(
          m3CircularProgressVariants({ size }),
          isIndeterminate && 'animate-m3-circular-progress-rotate',
          className
        )}
        {...props}
      >
        {/* Track circle */}
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-[var(--md-sys-color-surface-container-highest)]"
        />
        {/* Progress indicator circle */}
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={cn(
            'stroke-[var(--md-sys-color-primary)]',
            'origin-center -rotate-90',
            isIndeterminate
              ? 'animate-m3-circular-progress-dash'
              : 'transition-[stroke-dashoffset] duration-[var(--md-sys-motion-duration-medium2)] ease-[var(--md-sys-motion-easing-standard)]'
          )}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: isIndeterminate ? undefined : strokeDashoffset,
          }}
        />
      </svg>
    );
  }
);

M3CircularProgress.displayName = 'M3CircularProgress';

export {
  M3CircularProgress,
  m3CircularProgressVariants,
  STROKE_WIDTH_MAP,
};
