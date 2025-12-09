'use client';

import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * M3 Switch Component
 * 
 * Implements Material You 3 Expressive switch specifications with:
 * - Proper track, thumb, and icon states
 * - M3 Expressive shape (full rounded corners)
 * - State layer colors with appropriate opacity values
 * - Support for icons in thumb
 * 
 * Requirements: 4.8
 */

/**
 * M3 Switch track variant styles using CSS custom properties
 * Based on Material Design 3 Expressive specifications
 */
const m3SwitchTrackVariants = cva(
  // Base track styles
  [
    'peer inline-flex shrink-0 cursor-pointer items-center',
    'rounded-[var(--md-sys-shape-corner-full)]',
    'border-2',
    'transition-all',
    'duration-[var(--md-sys-motion-duration-short4)]',
    'ease-[var(--md-sys-motion-easing-standard)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'focus-visible:ring-[var(--md-sys-color-primary)]',
    'disabled:cursor-not-allowed disabled:opacity-38',
  ].join(' '),
  {
    variants: {
      /**
       * Switch size variants
       */
      size: {
        default: 'h-8 w-[52px]',
        small: 'h-6 w-10',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
);

/**
 * M3 Switch thumb variant styles
 */
const m3SwitchThumbVariants = cva(
  // Base thumb styles
  [
    'pointer-events-none flex items-center justify-center',
    'rounded-full',
    'shadow-md',
    'transition-all',
    'duration-[var(--md-sys-motion-duration-short4)]',
    'ease-[var(--md-sys-motion-easing-standard)]',
  ].join(' '),
  {
    variants: {
      size: {
        default: '',
        small: '',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
);

export interface M3SwitchProps
  extends Omit<React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>, 'children'>,
    VariantProps<typeof m3SwitchTrackVariants> {
  /** Icon to display when switch is checked */
  checkedIcon?: React.ReactNode;
  /** Icon to display when switch is unchecked */
  uncheckedIcon?: React.ReactNode;
  /** Whether to show icons in the thumb */
  showIcons?: boolean;
  /** Accessible label for the switch */
  'aria-label'?: string;
  /** ID of element that labels this switch */
  'aria-labelledby'?: string;
  /** ID of element that describes this switch */
  'aria-describedby'?: string;
}

/**
 * Default check icon for M3 Switch
 */
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/**
 * Default close/X icon for M3 Switch
 */
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/**
 * M3 Switch Component
 * 
 * A Material You 3 Expressive switch with support for:
 * - Two sizes: default (32px height) and small (24px height)
 * - Optional icons in thumb for checked/unchecked states
 * - M3 color tokens for track and thumb
 * - Smooth state transitions with M3 motion
 */
const M3Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  M3SwitchProps
>(
  (
    {
      className,
      size = 'default',
      checkedIcon,
      uncheckedIcon,
      showIcons = false,
      ...props
    },
    ref
  ) => {
    // Determine thumb sizes based on switch size and state
    // M3 spec: thumb grows when checked
    const thumbSizeClasses = size === 'default'
      ? 'h-6 w-6 data-[state=checked]:h-6 data-[state=checked]:w-6 data-[state=unchecked]:h-4 data-[state=unchecked]:w-4'
      : 'h-4 w-4 data-[state=checked]:h-4 data-[state=checked]:w-4 data-[state=unchecked]:h-3 data-[state=unchecked]:w-3';

    // Thumb translation based on size
    const thumbTranslateClasses = size === 'default'
      ? 'data-[state=checked]:translate-x-[22px] data-[state=unchecked]:translate-x-[4px]'
      : 'data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-[3px]';

    // Icon size based on switch size
    const iconSizeClass = size === 'default' ? 'size-4' : 'size-3';

    return (
      <SwitchPrimitives.Root
        className={cn(
          m3SwitchTrackVariants({ size }),
          // Track colors - unchecked state
          'data-[state=unchecked]:bg-[var(--md-sys-color-surface-container-highest)]',
          'data-[state=unchecked]:border-[var(--md-sys-color-outline)]',
          // Track colors - checked state
          'data-[state=checked]:bg-[var(--md-sys-color-primary)]',
          'data-[state=checked]:border-[var(--md-sys-color-primary)]',
          // Hover states
          'hover:data-[state=unchecked]:border-[var(--md-sys-color-on-surface)]',
          className
        )}
        {...props}
        ref={ref}
      >
        <SwitchPrimitives.Thumb
          className={cn(
            m3SwitchThumbVariants({ size }),
            thumbSizeClasses,
            thumbTranslateClasses,
            // Thumb colors - unchecked state
            'data-[state=unchecked]:bg-[var(--md-sys-color-outline)]',
            'data-[state=unchecked]:text-[var(--md-sys-color-surface-container-highest)]',
            // Thumb colors - checked state
            'data-[state=checked]:bg-[var(--md-sys-color-on-primary)]',
            'data-[state=checked]:text-[var(--md-sys-color-on-primary-container)]',
          )}
        >
          {/* Icons in thumb */}
          {showIcons && (
            <>
              {/* Checked icon */}
              <span className="absolute data-[state=unchecked]:opacity-0 data-[state=checked]:opacity-100 transition-opacity duration-[var(--md-sys-motion-duration-short2)]">
                {checkedIcon || <CheckIcon className={iconSizeClass} />}
              </span>
              {/* Unchecked icon */}
              <span className="absolute data-[state=checked]:opacity-0 data-[state=unchecked]:opacity-100 transition-opacity duration-[var(--md-sys-motion-duration-short2)]">
                {uncheckedIcon || <CloseIcon className={iconSizeClass} />}
              </span>
            </>
          )}
        </SwitchPrimitives.Thumb>
      </SwitchPrimitives.Root>
    );
  }
);

M3Switch.displayName = 'M3Switch';

export { M3Switch, m3SwitchTrackVariants, m3SwitchThumbVariants };
