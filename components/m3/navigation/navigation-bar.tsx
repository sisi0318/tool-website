'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * M3 Navigation Bar Component (Mobile)
 * 
 * Implements Material You 3 Expressive navigation bar specifications with:
 * - Support for up to 5 navigation items
 * - Indicator animation on selection
 * - 80dp height with proper safe area handling
 * - M3 state layers and ripple effects
 * 
 * Requirements: 4.4, 14.1, 14.2, 13.3
 */

export interface NavigationItem {
  /** Unique identifier for the navigation item */
  id: string;
  /** Label text displayed below the icon */
  label: string;
  /** Icon element (inactive state) */
  icon: React.ReactNode;
  /** Icon element for active state (optional, defaults to icon) */
  activeIcon?: React.ReactNode;
  /** Badge count or boolean for dot indicator */
  badge?: number | boolean;
}

export interface M3NavigationBarProps extends React.HTMLAttributes<HTMLElement> {
  /** Navigation items (maximum 5) */
  items: NavigationItem[];
  /** Currently active item ID */
  activeItem: string;
  /** Callback when an item is clicked */
  onItemClick: (id: string) => void;
  /** Accessible label for the navigation */
  'aria-label'?: string;
}

/**
 * Navigation bar container styles
 */
const navigationBarVariants = cva(
  [
    // Base styles - 80dp height per M3 spec
    'fixed bottom-0 left-0 right-0',
    'h-20', // 80px = 80dp
    'bg-[var(--md-sys-color-surface-container)]',
    'flex items-center justify-around',
    'px-2',
    // Safe area handling for notched devices
    'pb-[env(safe-area-inset-bottom)]',
    // Elevation
    'shadow-[0_-1px_3px_rgba(0,0,0,0.12)]',
    // Z-index to stay above content
    'z-50',
  ].join(' ')
);

/**
 * Navigation item styles
 */
const navigationItemVariants = cva(
  [
    'relative',
    'flex flex-col items-center justify-center',
    'min-w-[48px] min-h-[48px]', // Minimum touch target per M3 accessibility
    'px-3 py-1',
    'cursor-pointer',
    'select-none',
    'outline-none',
    'transition-all',
    'duration-[var(--md-sys-motion-duration-medium2)]',
    'ease-[var(--md-sys-motion-easing-emphasized)]',
  ].join(' ')
);

/**
 * Indicator pill styles (active state background)
 */
const indicatorVariants = cva(
  [
    'absolute',
    'top-1',
    'h-8 w-16', // 32px x 64px indicator pill
    'rounded-[var(--md-sys-shape-corner-full)]',
    'bg-[var(--md-sys-color-secondary-container)]',
    'transition-all',
    'duration-[var(--md-sys-motion-duration-medium2)]',
    'ease-[var(--md-sys-motion-easing-emphasized)]',
  ].join(' ')
);

/**
 * Ripple effect hook for navigation items
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
 * Navigation Item Component
 */
interface NavigationItemComponentProps {
  item: NavigationItem;
  isActive: boolean;
  onClick: () => void;
}

function NavigationItemComponent({ item, isActive, onClick }: NavigationItemComponentProps) {
  const { ripples, addRipple } = useRipple();
  const [isHovered, setIsHovered] = React.useState(false);
  const [isPressed, setIsPressed] = React.useState(false);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    addRipple(event);
    onClick();
  };

  const stateLayerOpacity = isPressed ? 0.12 : isHovered ? 0.08 : 0;

  return (
    <button
      type="button"
      className={cn(navigationItemVariants())}
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
          indicatorVariants(),
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
      
      {/* Label */}
      <span
        className={cn(
          'relative z-10 mt-1 text-xs font-medium',
          'transition-all duration-[var(--md-sys-motion-duration-short2)]',
          isActive
            ? 'text-[var(--md-sys-color-on-surface)]'
            : 'text-[var(--md-sys-color-on-surface-variant)]'
        )}
      >
        {item.label}
      </span>
    </button>
  );
}

/**
 * M3 Navigation Bar Component
 * 
 * A Material You 3 Expressive bottom navigation bar for mobile with:
 * - Support for up to 5 navigation items
 * - Animated indicator on selection
 * - 80dp height with safe area handling
 * - Minimum 48dp touch targets
 * - Badge support (dot or count)
 */
const M3NavigationBar = React.forwardRef<HTMLElement, M3NavigationBarProps>(
  ({ className, items, activeItem, onItemClick, 'aria-label': ariaLabel = 'Main navigation', ...props }, ref) => {
    // Validate maximum 5 items per M3 spec
    const displayItems = items.slice(0, 5);
    
    if (process.env.NODE_ENV === 'development' && items.length > 5) {
      console.warn(
        'M3NavigationBar: Maximum 5 navigation items allowed. Extra items will be ignored.'
      );
    }

    return (
      <nav
        ref={ref}
        className={cn(navigationBarVariants(), className)}
        role="navigation"
        aria-label={ariaLabel}
        {...props}
      >
        {displayItems.map((item) => (
          <NavigationItemComponent
            key={item.id}
            item={item}
            isActive={activeItem === item.id}
            onClick={() => onItemClick(item.id)}
          />
        ))}
      </nav>
    );
  }
);

M3NavigationBar.displayName = 'M3NavigationBar';

export { M3NavigationBar, navigationBarVariants };
