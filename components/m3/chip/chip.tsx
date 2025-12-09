'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * M3 Chip Component
 * 
 * Implements Material You 3 Expressive chip specifications with:
 * - Four variants: assist, filter, input, suggestion
 * - M3 Expressive shape (small corners - 8px)
 * - State layer colors with appropriate opacity values
 * - Ripple effect on interaction
 * 
 * Requirements: 4.7
 */

/**
 * M3 Chip variant styles using CSS custom properties
 * Based on Material Design 3 Expressive specifications
 */
const m3ChipVariants = cva(
  // Base styles
  [
    'relative inline-flex items-center justify-center gap-2',
    'h-8 px-4',
    'text-sm font-medium',
    'rounded-[var(--md-sys-shape-corner-small)]',
    'transition-all',
    'duration-[var(--md-sys-motion-duration-short2)]',
    'ease-[var(--md-sys-motion-easing-standard)]',
    'cursor-pointer select-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-38',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-[18px]',
    'overflow-hidden', // Required for ripple effect
  ].join(' '),
  {
    variants: {
      /**
       * M3 Chip variants:
       * - assist: Help users take action or provide information
       * - filter: Allow users to filter content
       * - input: Represent user input (tags, selections)
       * - suggestion: Provide dynamic suggestions
       */
      variant: {
        assist: [
          'bg-transparent',
          'text-[var(--md-sys-color-on-surface)]',
          'border border-[var(--md-sys-color-outline)]',
          'hover:bg-[var(--md-sys-color-on-surface)]/[0.08]',
          'focus-visible:ring-[var(--md-sys-color-primary)]',
        ].join(' '),
        filter: [
          'bg-transparent',
          'text-[var(--md-sys-color-on-surface-variant)]',
          'border border-[var(--md-sys-color-outline)]',
          'hover:bg-[var(--md-sys-color-on-surface)]/[0.08]',
          'focus-visible:ring-[var(--md-sys-color-secondary)]',
        ].join(' '),
        input: [
          'bg-transparent',
          'text-[var(--md-sys-color-on-surface-variant)]',
          'border border-[var(--md-sys-color-outline)]',
          'hover:bg-[var(--md-sys-color-on-surface)]/[0.08]',
          'focus-visible:ring-[var(--md-sys-color-primary)]',
        ].join(' '),
        suggestion: [
          'bg-transparent',
          'text-[var(--md-sys-color-on-surface-variant)]',
          'border border-[var(--md-sys-color-outline)]',
          'hover:bg-[var(--md-sys-color-on-surface)]/[0.08]',
          'focus-visible:ring-[var(--md-sys-color-primary)]',
        ].join(' '),
      },
      /**
       * Selected state for filter chips
       */
      selected: {
        true: '',
        false: '',
      },
      /**
       * Elevated style (adds shadow)
       */
      elevated: {
        true: 'shadow-sm border-transparent',
        false: '',
      },
      /**
       * Disabled state
       */
      disabled: {
        true: 'opacity-38 cursor-not-allowed',
        false: '',
      },
    },
    compoundVariants: [
      // Selected filter chip
      {
        variant: 'filter',
        selected: true,
        className: [
          'bg-[var(--md-sys-color-secondary-container)]',
          'text-[var(--md-sys-color-on-secondary-container)]',
          'border-transparent',
        ].join(' '),
      },
      // Selected input chip
      {
        variant: 'input',
        selected: true,
        className: [
          'bg-[var(--md-sys-color-secondary-container)]',
          'text-[var(--md-sys-color-on-secondary-container)]',
          'border-transparent',
        ].join(' '),
      },
      // Elevated assist chip
      {
        variant: 'assist',
        elevated: true,
        className: 'bg-[var(--md-sys-color-surface-container-low)]',
      },
      // Elevated suggestion chip
      {
        variant: 'suggestion',
        elevated: true,
        className: 'bg-[var(--md-sys-color-surface-container-low)]',
      },
    ],
    defaultVariants: {
      variant: 'assist',
      selected: false,
      elevated: false,
      disabled: false,
    },
  }
);

export interface M3ChipProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'>,
    VariantProps<typeof m3ChipVariants> {
  /** Leading icon */
  leadingIcon?: React.ReactNode;
  /** Trailing icon (typically close/remove for input chips) */
  trailingIcon?: React.ReactNode;
  /** Avatar element (for input chips) */
  avatar?: React.ReactNode;
  /** Whether the chip is selected (for filter chips) */
  selected?: boolean;
  /** Whether the chip is elevated */
  elevated?: boolean;
  /** Whether the chip is disabled */
  disabled?: boolean;
  /** Callback when trailing icon is clicked (for input chips) */
  onTrailingIconClick?: (event: React.MouseEvent<HTMLSpanElement>) => void;
  /** Accessible label for the chip */
  'aria-label'?: string;
  /** ID of element that describes this chip */
  'aria-describedby'?: string;
}


/**
 * Ripple effect hook for M3 chips
 * Creates a ripple animation originating from the touch/click point
 */
function useRipple() {
  const [ripples, setRipples] = React.useState<Array<{
    key: number;
    x: number;
    y: number;
    size: number;
  }>>([]);

  const addRipple = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    
    // Calculate ripple position relative to element
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Calculate ripple size (should cover the entire element)
    const size = Math.max(rect.width, rect.height) * 2;
    
    const newRipple = {
      key: Date.now(),
      x,
      y,
      size,
    };
    
    setRipples((prev) => [...prev, newRipple]);
    
    // Remove ripple after animation completes
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.key !== newRipple.key));
    }, 600); // M3 ripple duration
  }, []);

  return { ripples, addRipple };
}

/**
 * Ripple component for visual feedback
 */
function Ripple({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <span
      className="absolute pointer-events-none animate-ripple rounded-full bg-current opacity-[0.12]"
      style={{
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
      }}
    />
  );
}

/**
 * Checkmark icon for selected filter chips
 */
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/**
 * Close icon for input chips
 */
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
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
 * M3 Chip Component
 * 
 * A Material You 3 Expressive chip with support for:
 * - Four variants: assist, filter, input, suggestion
 * - Selected state for filter and input chips
 * - Elevated style option
 * - Leading/trailing icons and avatar support
 * - Ripple effect on interaction
 */
const M3Chip = React.forwardRef<HTMLButtonElement, M3ChipProps>(
  (
    {
      className,
      variant = 'assist',
      selected = false,
      elevated = false,
      disabled = false,
      leadingIcon,
      trailingIcon,
      avatar,
      children,
      onClick,
      onTrailingIconClick,
      ...props
    },
    ref
  ) => {
    const { ripples, addRipple } = useRipple();

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!disabled) {
        addRipple(event);
        onClick?.(event);
      }
    };

    const handleTrailingIconClick = (event: React.MouseEvent<HTMLSpanElement>) => {
      event.stopPropagation();
      if (!disabled && onTrailingIconClick) {
        onTrailingIconClick(event);
      }
    };

    // Determine if we should show the checkmark for filter chips
    const showCheckmark = variant === 'filter' && selected;
    
    // Determine if we should show the close icon for input chips
    const showCloseIcon = variant === 'input' && !trailingIcon && onTrailingIconClick;

    // Adjust padding based on content
    const hasLeadingContent = avatar || leadingIcon || showCheckmark;
    const hasTrailingContent = trailingIcon || showCloseIcon;

    return (
      <button
        type="button"
        className={cn(
          m3ChipVariants({ variant, selected, elevated, disabled }),
          hasLeadingContent && 'pl-2',
          hasTrailingContent && 'pr-2',
          className
        )}
        ref={ref}
        disabled={disabled}
        onClick={handleClick}
        aria-pressed={variant === 'filter' ? selected : undefined}
        aria-disabled={disabled}
        {...props}
      >
        {/* Ripple container */}
        {ripples.map((ripple) => (
          <Ripple key={ripple.key} x={ripple.x} y={ripple.y} size={ripple.size} />
        ))}
        
        {/* Avatar (for input chips) */}
        {avatar && (
          <span className="shrink-0 -ml-1 size-6 rounded-full overflow-hidden">
            {avatar}
          </span>
        )}
        
        {/* Checkmark for selected filter chips */}
        {showCheckmark && (
          <CheckIcon className="size-[18px] shrink-0" />
        )}
        
        {/* Leading icon */}
        {!showCheckmark && leadingIcon && (
          <span className="shrink-0">{leadingIcon}</span>
        )}
        
        {/* Chip label */}
        <span className="relative z-10">{children}</span>
        
        {/* Trailing icon */}
        {trailingIcon && (
          <span
            className={cn(
              'shrink-0',
              onTrailingIconClick && 'cursor-pointer hover:opacity-80'
            )}
            onClick={onTrailingIconClick ? handleTrailingIconClick : undefined}
            role={onTrailingIconClick ? 'button' : undefined}
            aria-label={onTrailingIconClick ? 'Remove' : undefined}
          >
            {trailingIcon}
          </span>
        )}
        
        {/* Close icon for input chips */}
        {showCloseIcon && (
          <span
            className="shrink-0 cursor-pointer hover:opacity-80"
            onClick={handleTrailingIconClick}
            role="button"
            aria-label="Remove"
          >
            <CloseIcon className="size-[18px]" />
          </span>
        )}
      </button>
    );
  }
);

M3Chip.displayName = 'M3Chip';

export { M3Chip, m3ChipVariants };
