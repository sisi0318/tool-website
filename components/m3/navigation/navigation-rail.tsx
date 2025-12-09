'use client';

import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import type { NavigationItem } from './navigation-bar';

/**
 * M3 Navigation Rail Component (Desktop)
 * 
 * Implements Material You 3 Expressive navigation rail specifications with:
 * - Support for FAB placement
 * - Indicator animation on selection
 * - Vertical layout for desktop/tablet
 * - M3 state layers and ripple effects
 * 
 * Requirements: 4.4, 6.2, 6.3
 */

export interface M3NavigationRailProps extends React.HTMLAttributes<HTMLElement> {
  /** Navigation items */
  items: NavigationItem[];
  /** Currently active item ID */
  activeItem: string;
  /** Callback when an item is clicked */
  onItemClick: (id: string) => void;
  /** FAB (Floating Action Button) element to display at top */
  fab?: React.ReactNode;
  /** Alignment of navigation items */
  alignment?: 'top' | 'center' | 'bottom';
  /** Whether to show labels */
  showLabels?: boolean;
  /** Accessible label for the navigation */
  'aria-label'?: string;
}

/**
 * Navigation rail container styles
 */
const navigationRailVariants = cva(
  [
    // Base styles - 80dp width per M3 spec
    'fixed left-0 top-0 bottom-0',
    'w-20', // 80px = 80dp
    'bg-[var(--md-sys-color-surface)]',
    'flex flex-col',
    'py-3',
    // Safe area handling
    'pt-[max(12px,env(safe-area-inset-top))]',
    'pb-[max(12px,env(safe-area-inset-bottom))]',
    // Border
    'border-r border-[var(--md-sys-color-surface-variant)]',
    // Z-index
    'z-50',
  ].join(' ')
);

/**
 * Navigation item styles for rail
 */
const railItemVariants = cva(
  [
    'relative',
    'flex flex-col items-center justify-center',
    'w-14 h-14', // 56px touch target
    'mx-auto',
    'cursor-pointer',
    'select-none',
    'outline-none',
    'rounded-[var(--md-sys-shape-corner-full)]',
    'transition-all',
    'duration-[var(--md-sys-motion-duration-medium2)]',
    'ease-[var(--md-sys-motion-easing-emphasized)]',
    'overflow-hidden',
  ].join(' ')
);

/**
 * Indicator pill styles for rail (active state background)
 */
const railIndicatorVariants = cva(
  [
    'absolute',
    'inset-x-1',
    'top-1/2 -translate-y-1/2',
    'h-8', // 32px indicator height
    'rounded-[var(--md-sys-shape-corner-full)]',
    'bg-[var(--md-sys-color-secondary-container)]',
    'transition-all',
    'duration-[var(--md-sys-motion-duration-medium2)]',
    'ease-[var(--md-sys-motion-easing-emphasized)]',
  ].join(' ')
);

/**
 * Ripple effect hook
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
 * Badge component for navigation items
 */
function Badge({ value }: { value: number | boolean }) {
  if (value === false) return null;
  
  const isDot = value === true;
  
  return (
    <span
      className={cn(
        'absolute',
        'bg-[var(--md-sys-color-error)]',
        'text-[var(--md-sys-color-on-error)]',
        isDot
          ? 'top-0 right-0 w-2 h-2 rounded-full'
          : 'top-[-2px] right-[-4px] min-w-[16px] h-4 px-1 rounded-full text-[11px] font-medium flex items-center justify-center'
      )}
    >
      {!isDot && (value > 99 ? '99+' : value)}
    </span>
  );
}

/**
 * Rail Navigation Item Component
 */
interface RailItemComponentProps {
  item: NavigationItem;
  isActive: boolean;
  onClick: () => void;
  showLabel: boolean;
}

function RailItemComponent({ item, isActive, onClick, showLabel }: RailItemComponentProps) {
  const { ripples, addRipple } = useRipple();
  const [isHovered, setIsHovered] = React.useState(false);
  const [isPressed, setIsPressed] = React.useState(false);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    addRipple(event);
    onClick();
  };

  const stateLayerOpacity = isPressed ? 0.12 : isHovered ? 0.08 : 0;

  return (
    <div className="flex flex-col items-center mb-2">
      <button
        type="button"
        className={cn(railItemVariants())}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        aria-current={isActive ? 'page' : undefined}
        aria-label={item.label}
      >
        {/* Indicator pill (active state) */}
        <span
          className={cn(
            railIndicatorVariants(),
            isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
          )}
          aria-hidden="true"
        />
        
        {/* State layer */}
        <span
          className="absolute inset-0 rounded-[var(--md-sys-shape-corner-full)] pointer-events-none bg-[var(--md-sys-color-on-surface)] transition-opacity duration-[var(--md-sys-motion-duration-short2)]"
          style={{ opacity: stateLayerOpacity }}
          aria-hidden="true"
        />
        
        {/* Ripples */}
        {ripples.map((ripple) => (
          <Ripple key={ripple.key} x={ripple.x} y={ripple.y} size={ripple.size} />
        ))}
        
        {/* Icon container */}
        <span className="relative z-10 flex items-center justify-center w-6 h-6">
          {isActive && item.activeIcon ? item.activeIcon : item.icon}
          {item.badge !== undefined && <Badge value={item.badge} />}
        </span>
      </button>
      
      {/* Label (outside button for rail) */}
      {showLabel && (
        <span
          className={cn(
            'mt-1 text-xs font-medium text-center',
            'transition-all duration-[var(--md-sys-motion-duration-short2)]',
            isActive
              ? 'text-[var(--md-sys-color-on-surface)]'
              : 'text-[var(--md-sys-color-on-surface-variant)]'
          )}
        >
          {item.label}
        </span>
      )}
    </div>
  );
}

/**
 * M3 Navigation Rail Component
 * 
 * A Material You 3 Expressive side navigation rail for desktop/tablet with:
 * - Support for FAB placement at top
 * - Animated indicator on selection
 * - 80dp width
 * - Configurable item alignment
 * - Optional labels
 */
const M3NavigationRail = React.forwardRef<HTMLElement, M3NavigationRailProps>(
  (
    {
      className,
      items,
      activeItem,
      onItemClick,
      fab,
      alignment = 'top',
      showLabels = true,
      'aria-label': ariaLabel = 'Main navigation',
      ...props
    },
    ref
  ) => {
    const alignmentClasses = {
      top: 'justify-start',
      center: 'justify-center',
      bottom: 'justify-end',
    };

    return (
      <nav
        ref={ref}
        className={cn(navigationRailVariants(), className)}
        role="navigation"
        aria-label={ariaLabel}
        {...props}
      >
        {/* FAB placement area */}
        {fab && (
          <div className="flex justify-center mb-4 px-2">
            {fab}
          </div>
        )}
        
        {/* Navigation items container */}
        <div className={cn('flex-1 flex flex-col', alignmentClasses[alignment])}>
          {items.map((item) => (
            <RailItemComponent
              key={item.id}
              item={item}
              isActive={activeItem === item.id}
              onClick={() => onItemClick(item.id)}
              showLabel={showLabels}
            />
          ))}
        </div>
      </nav>
    );
  }
);

M3NavigationRail.displayName = 'M3NavigationRail';

export { M3NavigationRail, navigationRailVariants };
