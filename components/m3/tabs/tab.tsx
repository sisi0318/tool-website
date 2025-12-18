'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * M3 Tab Component
 * 
 * Individual tab item for the M3 Tabs component.
 * Implements Material You 3 Expressive tab specifications with:
 * - Primary and secondary variants
 * - State layers and ripple effects
 * - Icon support
 * - Close button support
 * 
 * Requirements: 4.5, 9.1, 9.2
 */

export interface M3TabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Tab variant */
  variant?: 'primary' | 'secondary';
  /** Whether the tab is currently active */
  isActive?: boolean;
  /** Icon to display in the tab */
  icon?: React.ReactNode;
  /** Whether to show close button */
  closable?: boolean;
  /** Callback when close button is clicked */
  onClose?: () => void;
  /** Tab label */
  children: React.ReactNode;
}

/**
 * Tab styles using CSS custom properties
 */
const tabVariants = cva(
  [
    'relative',
    'inline-flex items-center justify-center gap-2',
    'px-4 py-3',
    'min-h-[48px]', // Minimum touch target
    'font-medium text-sm',
    'whitespace-nowrap', // Prevent text wrapping
    'flex-shrink-0', // Prevent shrinking
    'cursor-pointer',
    'select-none',
    'outline-none',
    'overflow-hidden',
    'transition-all',
    'duration-[var(--md-sys-motion-duration-medium2)]',
    'ease-[var(--md-sys-motion-easing-emphasized)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-38',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: [
          'text-[var(--md-sys-color-on-surface-variant)]',
          'hover:text-[var(--md-sys-color-on-surface)]',
          'data-[active=true]:text-[var(--md-sys-color-primary)]',
        ].join(' '),
        secondary: [
          'text-[var(--md-sys-color-on-surface-variant)]',
          'hover:text-[var(--md-sys-color-on-surface)]',
          'data-[active=true]:text-[var(--md-sys-color-on-surface)]',
        ].join(' '),
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  }
);

/**
 * Ripple effect hook for tabs
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
    const size = Math.max(rect.width, rect.height) * 2;

    const newRipple = { key: Date.now(), x, y, size };

    setRipples((prev) => [...prev, newRipple]);

    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.key !== newRipple.key));
    }, 600);
  }, []);

  return { ripples, addRipple };
}

/**
 * Ripple component
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
 * M3 Tab Component
 */
const M3Tab = React.forwardRef<HTMLButtonElement, M3TabProps>(
  (
    {
      className,
      variant = 'primary',
      isActive = false,
      icon,
      closable = false,
      onClose,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const { ripples, addRipple } = useRipple();
    const [isHovered, setIsHovered] = React.useState(false);
    const [isPressed, setIsPressed] = React.useState(false);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      addRipple(event);
      onClick?.(event);
    };

    const handleCloseClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onClose?.();
    };

    const stateLayerOpacity = isPressed ? 0.12 : isHovered ? 0.08 : 0;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        data-active={isActive}
        className={cn(tabVariants({ variant }), className)}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        {...props}
      >
        {/* State layer */}
        <span
          className="absolute inset-0 pointer-events-none bg-current transition-opacity duration-[var(--md-sys-motion-duration-short2)]"
          style={{ opacity: stateLayerOpacity }}
          aria-hidden="true"
        />

        {/* Ripples */}
        {ripples.map((ripple) => (
          <Ripple key={ripple.key} x={ripple.x} y={ripple.y} size={ripple.size} />
        ))}

        {/* Icon */}
        {icon && (
          <span className="relative z-10 flex items-center justify-center w-5 h-5">
            {icon}
          </span>
        )}

        {/* Label */}
        <span className="relative z-10">{children}</span>

        {/* Close button - using span with role="button" to avoid nested button warning */}
        {closable && (
          <span
            role="button"
            tabIndex={0}
            className={cn(
              'relative z-10 ml-1 p-1 rounded-full',
              'hover:bg-[var(--md-sys-color-on-surface)]/[0.08]',
              'focus-visible:outline-none focus-visible:ring-2',
              'transition-colors duration-[var(--md-sys-motion-duration-short2)]',
              'cursor-pointer'
            )}
            onClick={handleCloseClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClose?.();
              }
            }}
            aria-label="Close tab"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        )}
      </button>
    );
  }
);

M3Tab.displayName = 'M3Tab';

export { M3Tab, tabVariants };
