'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * M3 EXPRESSIVE Card Component
 * 
 * Implements Material You 3 Expressive card specifications with:
 * - Three variants: elevated, filled, outlined
 * - Larger M3 Expressive shape radii
 * - Enhanced hover states with playful animations
 * - Gradient backgrounds for visual interest
 * - Spring-like ripple effect on interaction
 */

/**
 * M3 Expressive Card variant styles
 * Based on Material Design 3 Expressive specifications
 */
const m3CardVariants = cva(
  // Base styles
  [
    'relative',
    'overflow-hidden',
    'transition-all',
    'duration-[var(--md-sys-motion-duration-medium2)]',
    'ease-[var(--md-sys-motion-easing-expressive)]',
  ].join(' '),
  {
    variants: {
      /**
       * M3 Expressive Card variants:
       * - elevated: Gradient surface with enhanced shadow
       * - filled: Surface container with subtle gradient
       * - outlined: Surface with vibrant border
       */
      variant: {
        elevated: [
          'bg-gradient-to-br from-[var(--md-sys-color-surface-container-low)] to-[var(--md-sys-color-surface-container)]',
          'text-[var(--md-sys-color-on-surface)]',
          'shadow-lg shadow-[var(--md-sys-color-shadow)]/10',
        ].join(' '),
        filled: [
          'bg-gradient-to-br from-[var(--md-sys-color-surface-container-highest)] to-[var(--md-sys-color-surface-container-high)]',
          'text-[var(--md-sys-color-on-surface)]',
        ].join(' '),
        outlined: [
          'bg-[var(--md-sys-color-surface)]',
          'text-[var(--md-sys-color-on-surface)]',
          'border-2 border-[var(--md-sys-color-outline-variant)]',
        ].join(' '),
      },
      /**
       * M3 Expressive shape sizes - larger radii
       */
      shape: {
        medium: 'rounded-[var(--md-sys-shape-corner-medium)]',
        large: 'rounded-[var(--md-sys-shape-corner-large)]',
        extraLarge: 'rounded-[var(--md-sys-shape-corner-extra-large)]',
      },
      /**
       * Interactive state - enables expressive hover/pressed states
       */
      interactive: {
        true: [
          'cursor-pointer',
          'select-none',
          'focus-visible:outline-none',
          'focus-visible:ring-2',
          'focus-visible:ring-[var(--md-sys-color-primary)]',
          'focus-visible:ring-offset-2',
          'hover:-translate-y-1',
          'active:scale-[0.98]',
          'active:translate-y-0',
        ].join(' '),
        false: '',
      },
      /**
       * Full width card
       */
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    compoundVariants: [
      // Elevated card hover state - enhanced shadow
      {
        variant: 'elevated',
        interactive: true,
        className: 'hover:shadow-xl hover:shadow-[var(--md-sys-color-primary)]/10',
      },
      // Filled card hover state - add subtle shadow
      {
        variant: 'filled',
        interactive: true,
        className: 'hover:shadow-md',
      },
      // Outlined card hover state - vibrant border
      {
        variant: 'outlined',
        interactive: true,
        className: 'hover:border-[var(--md-sys-color-outline)] hover:shadow-sm',
      },
    ],
    defaultVariants: {
      variant: 'elevated',
      shape: 'large',
      interactive: false,
      fullWidth: false,
    },
  }
);

export interface M3CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof m3CardVariants> {
  /** Whether the card is interactive (clickable) */
  interactive?: boolean;
  /** Click handler for interactive cards */
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  /** Render as a different element */
  as?: 'div' | 'article' | 'section';
}

/**
 * Enhanced Ripple effect hook for M3 Expressive cards
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
    
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Larger ripple for expressive effect
    const size = Math.max(rect.width, rect.height) * 2.5;
    
    const newRipple = {
      key: Date.now(),
      x,
      y,
      size,
    };
    
    setRipples((prev) => [...prev, newRipple]);
    
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
      className="absolute pointer-events-none rounded-full bg-[var(--md-sys-color-on-surface)] opacity-[0.08]"
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
 * Expressive State layer component for hover/focus/pressed states
 */
function StateLayer({ isHovered, isPressed }: { isHovered: boolean; isPressed: boolean }) {
  const opacity = isPressed ? 0.16 : isHovered ? 0.08 : 0;
  
  return (
    <span
      className="absolute inset-0 pointer-events-none bg-[var(--md-sys-color-on-surface)] transition-opacity duration-[var(--md-sys-motion-duration-short4)] ease-[var(--md-sys-motion-easing-expressive)]"
      style={{ opacity }}
      aria-hidden="true"
    />
  );
}

/**
 * M3 EXPRESSIVE Card Component
 * 
 * A Material You 3 Expressive card with support for:
 * - Three variants: elevated, filled, outlined
 * - Three shape sizes: medium, large, extraLarge
 * - Interactive mode with expressive hover/pressed states and ripple
 * - Gradient backgrounds for visual interest
 * - Playful spring-like animations
 */
const M3Card = React.forwardRef<HTMLDivElement, M3CardProps>(
  (
    {
      className,
      variant,
      shape,
      interactive = false,
      fullWidth,
      as: Component = 'div',
      children,
      onClick,
      onMouseDown,
      onMouseUp,
      onMouseEnter,
      onMouseLeave,
      ...props
    },
    ref
  ) => {
    const { ripples, addRipple } = useRipple();
    const [isHovered, setIsHovered] = React.useState(false);
    const [isPressed, setIsPressed] = React.useState(false);

    const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
      if (interactive) {
        addRipple(event);
      }
      onClick?.(event);
    };

    const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
      if (interactive) {
        setIsPressed(true);
      }
      onMouseDown?.(event);
    };

    const handleMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
      setIsPressed(false);
      onMouseUp?.(event);
    };

    const handleMouseEnter = (event: React.MouseEvent<HTMLDivElement>) => {
      if (interactive) {
        setIsHovered(true);
      }
      onMouseEnter?.(event);
    };

    const handleMouseLeave = (event: React.MouseEvent<HTMLDivElement>) => {
      setIsHovered(false);
      setIsPressed(false);
      onMouseLeave?.(event);
    };

    // Determine role and tabIndex for interactive cards
    const interactiveProps = interactive
      ? {
          role: 'button' as const,
          tabIndex: 0,
          onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onClick?.(event as unknown as React.MouseEvent<HTMLDivElement>);
            }
          },
        }
      : {};

    return (
      <Component
        className={cn(
          m3CardVariants({ variant, shape, interactive, fullWidth }),
          className
        )}
        ref={ref}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...interactiveProps}
        {...props}
      >
        {/* State layer for hover/focus/pressed states */}
        {interactive && <StateLayer isHovered={isHovered} isPressed={isPressed} />}
        
        {/* Ripple container */}
        {interactive && ripples.map((ripple) => (
          <Ripple key={ripple.key} x={ripple.x} y={ripple.y} size={ripple.size} />
        ))}
        
        {/* Card content */}
        <div className="relative z-10">
          {children}
        </div>
      </Component>
    );
  }
);

M3Card.displayName = 'M3Card';

export { M3Card, m3CardVariants };
