'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * M3 EXPRESSIVE Button Component
 * 
 * Implements Material You 3 Expressive button specifications with:
 * - Five variants: filled, outlined, text, elevated, tonal
 * - Enhanced ripple effect with spring-like animation
 * - More rounded M3 Expressive shapes
 * - Vibrant state layers with playful hover effects
 * - Gradient backgrounds for filled variant
 */

/**
 * M3 Expressive Button variant styles
 * Based on Material Design 3 Expressive specifications
 */
const m3ButtonVariants = cva(
  // Base styles
  [
    'relative inline-flex items-center justify-center gap-2',
    'whitespace-nowrap font-semibold',
    'transition-all',
    'duration-[var(--md-sys-motion-duration-short4)]',
    'ease-[var(--md-sys-motion-easing-expressive)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-38',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
    'overflow-hidden', // Required for ripple effect
    'active:scale-[0.97]', // Expressive press effect
  ].join(' '),
  {
    variants: {
      /**
       * M3 Expressive Button variants:
       * - filled: Primary action with gradient background
       * - outlined: Secondary action with vibrant border
       * - text: Low emphasis, tertiary action
       * - elevated: Medium emphasis with enhanced shadow
       * - tonal: Secondary container color with gradient
       */
      variant: {
        filled: [
          'bg-gradient-to-br from-[var(--md-sys-color-primary)] to-[color-mix(in_srgb,var(--md-sys-color-primary)_80%,var(--md-sys-color-tertiary))]',
          'text-[var(--md-sys-color-on-primary)]',
          'shadow-md shadow-[var(--md-sys-color-primary)]/20',
          'hover:shadow-lg hover:shadow-[var(--md-sys-color-primary)]/30',
          'hover:-translate-y-0.5',
          'focus-visible:ring-[var(--md-sys-color-primary)]',
        ].join(' '),
        outlined: [
          'bg-transparent',
          'text-[var(--md-sys-color-primary)]',
          'border-2 border-[var(--md-sys-color-outline)]',
          'hover:bg-[var(--md-sys-color-primary)]/[0.08]',
          'hover:border-[var(--md-sys-color-primary)]',
          'focus-visible:ring-[var(--md-sys-color-primary)]',
        ].join(' '),
        text: [
          'bg-transparent',
          'text-[var(--md-sys-color-primary)]',
          'hover:bg-[var(--md-sys-color-primary)]/[0.08]',
          'focus-visible:ring-[var(--md-sys-color-primary)]',
        ].join(' '),
        elevated: [
          'bg-gradient-to-br from-[var(--md-sys-color-surface-container-low)] to-[var(--md-sys-color-surface-container)]',
          'text-[var(--md-sys-color-primary)]',
          'shadow-md',
          'hover:shadow-xl hover:-translate-y-0.5',
          'focus-visible:ring-[var(--md-sys-color-primary)]',
        ].join(' '),
        tonal: [
          'bg-gradient-to-br from-[var(--md-sys-color-secondary-container)] to-[color-mix(in_srgb,var(--md-sys-color-secondary-container)_85%,var(--md-sys-color-tertiary-container))]',
          'text-[var(--md-sys-color-on-secondary-container)]',
          'hover:shadow-md hover:-translate-y-0.5',
          'focus-visible:ring-[var(--md-sys-color-secondary)]',
        ].join(' '),
      },
      /**
       * M3 Expressive Button sizes - larger radii
       */
      size: {
        small: [
          'h-10 px-4',
          'text-sm',
          'rounded-[var(--md-sys-shape-corner-medium)]',
          '[&_svg]:size-4',
        ].join(' '),
        medium: [
          'h-11 px-7',
          'text-sm',
          'rounded-[var(--md-sys-shape-corner-large)]',
          '[&_svg]:size-5',
        ].join(' '),
        large: [
          'h-14 px-9',
          'text-base',
          'rounded-[var(--md-sys-shape-corner-extra-large)]',
          '[&_svg]:size-6',
        ].join(' '),
      },
      /**
       * FAB (Floating Action Button) mode
       * Uses full rounded corners (pill shape)
       */
      fab: {
        true: 'rounded-[var(--md-sys-shape-corner-full)]',
        false: '',
      },
      /**
       * Full width button
       */
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'filled',
      size: 'medium',
      fab: false,
      fullWidth: false,
    },
  }
);

export interface M3ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof m3ButtonVariants> {
  /** Render as child component (for composition) */
  asChild?: boolean;
  /** Icon to display before text */
  icon?: React.ReactNode;
  /** Icon position */
  iconPosition?: 'start' | 'end';
  /** Loading state */
  loading?: boolean;
  /** Accessible label for icon-only buttons */
  'aria-label'?: string;
}


/**
 * Enhanced Ripple effect hook for M3 Expressive buttons
 * Creates a spring-like ripple animation
 */
function useRipple() {
  const [ripples, setRipples] = React.useState<Array<{
    key: number;
    x: number;
    y: number;
    size: number;
  }>>([]);

  const addRipple = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Larger ripple for more expressive effect
    const size = Math.max(rect.width, rect.height) * 2.5;
    
    const newRipple = {
      key: Date.now(),
      x,
      y,
      size,
    };
    
    setRipples((prev) => [...prev, newRipple]);
    
    // Longer duration for expressive feel
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.key !== newRipple.key));
    }, 800);
  }, []);

  return { ripples, addRipple };
}

/**
 * Expressive Ripple component with spring animation
 */
function Ripple({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <span
      className="absolute pointer-events-none rounded-full bg-current opacity-[0.15] animate-[ripple_0.8s_ease-out_forwards]"
      style={{
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        transform: 'scale(0)',
        animation: 'ripple 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      }}
    />
  );
}

/**
 * Loading spinner component
 */
function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/**
 * M3 EXPRESSIVE Button Component
 * 
 * A Material You 3 Expressive button with support for:
 * - Five variants: filled, outlined, text, elevated, tonal
 * - Three sizes: small, medium, large
 * - FAB mode with pill shape
 * - Enhanced ripple effect with spring animation
 * - Playful hover and press states
 * - Loading state
 * - Icon support
 */
const M3Button = React.forwardRef<HTMLButtonElement, M3ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fab,
      fullWidth,
      asChild = false,
      icon,
      iconPosition = 'start',
      loading = false,
      disabled,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const { ripples, addRipple } = useRipple();
    const Comp = asChild ? Slot : 'button';

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!disabled && !loading) {
        addRipple(event);
        onClick?.(event);
      }
    };

    const isDisabled = disabled || loading;

    return (
      <Comp
        className={cn(
          m3ButtonVariants({ variant, size, fab, fullWidth }),
          className
        )}
        ref={ref}
        disabled={isDisabled}
        onClick={handleClick}
        aria-disabled={isDisabled}
        aria-busy={loading}
        {...props}
      >
        {/* Ripple container */}
        {ripples.map((ripple) => (
          <Ripple key={ripple.key} x={ripple.x} y={ripple.y} size={ripple.size} />
        ))}
        
        {/* State layer for hover/focus/pressed states */}
        <span
          className="absolute inset-0 rounded-inherit pointer-events-none transition-opacity duration-[var(--md-sys-motion-duration-short2)]"
          aria-hidden="true"
        />
        
        {/* Loading spinner */}
        {loading && (
          <LoadingSpinner className="size-4" />
        )}
        
        {/* Icon at start position */}
        {!loading && icon && iconPosition === 'start' && (
          <span className="shrink-0">{icon}</span>
        )}
        
        {/* Button content */}
        {children && (
          <span className={cn(loading && 'opacity-0')}>{children}</span>
        )}
        
        {/* Icon at end position */}
        {!loading && icon && iconPosition === 'end' && (
          <span className="shrink-0">{icon}</span>
        )}
      </Comp>
    );
  }
);

M3Button.displayName = 'M3Button';

export { M3Button, m3ButtonVariants };
