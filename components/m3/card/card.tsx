'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * M3 Card Component
 * 
 * Implements Material You 3 Expressive card specifications with:
 * - Three variants: elevated, filled, outlined
 * - M3 Expressive shape (large/extra-large corners)
 * - Hover and pressed state layers with appropriate opacity values
 * - Ripple effect on interaction for interactive cards
 * 
 * Requirements: 4.2, 3.2, 8.1, 8.2, 8.3
 */

/**
 * M3 Card variant styles using CSS custom properties
 * Based on Material Design 3 Expressive specifications
 */
const m3CardVariants = cva(
  // Base styles
  [
    'relative',
    'overflow-hidden', // Required for ripple effect and state layers
    'transition-all',
    'duration-[var(--md-sys-motion-duration-medium2)]',
    'ease-[var(--md-sys-motion-easing-standard)]',
  ].join(' '),
  {
    variants: {
      /**
       * M3 Card variants:
       * - elevated: Surface color with shadow elevation
       * - filled: Surface container color, no shadow
       * - outlined: Surface color with outline border
       */
      variant: {
        elevated: [
          'bg-[var(--md-sys-color-surface-container-low)]',
          'text-[var(--md-sys-color-on-surface)]',
          'shadow-md',
        ].join(' '),
        filled: [
          'bg-[var(--md-sys-color-surface-container-highest)]',
          'text-[var(--md-sys-color-on-surface)]',
        ].join(' '),
        outlined: [
          'bg-[var(--md-sys-color-surface)]',
          'text-[var(--md-sys-color-on-surface)]',
          'border border-[var(--md-sys-color-outline-variant)]',
        ].join(' '),
      },
      /**
       * M3 Expressive shape sizes
       * - medium: 16px corners (standard)
       * - large: 24px corners (default for cards)
       * - extraLarge: 28px corners (expressive)
       */
      shape: {
        medium: 'rounded-[var(--md-sys-shape-corner-medium)]',
        large: 'rounded-[var(--md-sys-shape-corner-large)]',
        extraLarge: 'rounded-[var(--md-sys-shape-corner-extra-large)]',
      },
      /**
       * Interactive state - enables hover/pressed state layers and ripple
       */
      interactive: {
        true: [
          'cursor-pointer',
          'select-none',
          'focus-visible:outline-none',
          'focus-visible:ring-2',
          'focus-visible:ring-[var(--md-sys-color-primary)]',
          'focus-visible:ring-offset-2',
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
      // Elevated card hover state - increase shadow
      {
        variant: 'elevated',
        interactive: true,
        className: 'hover:shadow-lg',
      },
      // Filled card hover state - add subtle shadow
      {
        variant: 'filled',
        interactive: true,
        className: 'hover:shadow-sm',
      },
      // Outlined card hover state - no shadow change
      {
        variant: 'outlined',
        interactive: true,
        className: '',
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
 * Ripple effect hook for M3 cards
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
      className="absolute pointer-events-none animate-ripple rounded-full bg-[var(--md-sys-color-on-surface)] opacity-[0.12]"
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
 * State layer component for hover/focus/pressed states
 * Provides visual feedback for interactive cards
 */
function StateLayer({ isHovered, isPressed }: { isHovered: boolean; isPressed: boolean }) {
  const opacity = isPressed ? 0.12 : isHovered ? 0.08 : 0;
  
  return (
    <span
      className="absolute inset-0 pointer-events-none bg-[var(--md-sys-color-on-surface)] transition-opacity duration-[var(--md-sys-motion-duration-short2)]"
      style={{ opacity }}
      aria-hidden="true"
    />
  );
}

/**
 * M3 Card Component
 * 
 * A Material You 3 Expressive card with support for:
 * - Three variants: elevated, filled, outlined
 * - Three shape sizes: medium, large, extraLarge
 * - Interactive mode with hover/pressed state layers and ripple effect
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
