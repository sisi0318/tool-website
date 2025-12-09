'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * M3 Context Menu Component
 * 
 * Implements Material You 3 styled context menu for long-press interactions.
 * Uses M3 menu styling with proper elevation, surface colors, and animations.
 * 
 * Requirements: 17.3
 */

export interface M3ContextMenuItem {
  /** Unique identifier for the item */
  id: string;
  /** Display label */
  label: string;
  /** Optional icon */
  icon?: React.ReactNode;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Whether this is a destructive action */
  destructive?: boolean;
  /** Click handler */
  onClick?: () => void;
}

export interface M3ContextMenuProps {
  /** Whether the menu is open */
  open: boolean;
  /** Callback when the menu should close */
  onClose: () => void;
  /** Menu items */
  items: M3ContextMenuItem[];
  /** Position of the menu */
  position: { x: number; y: number };
  /** Additional class names */
  className?: string;
  /** Accessible label for the menu */
  'aria-label'?: string;
}

/**
 * Context menu container styles
 */
const contextMenuVariants = cva(
  [
    'fixed z-50',
    'min-w-[180px] max-w-[280px]',
    'py-2',
    'bg-[var(--md-sys-color-surface-container)]',
    'rounded-[var(--md-sys-shape-corner-medium)]',
    'shadow-lg',
    'overflow-hidden',
  ].join(' ')
);

/**
 * Menu item styles
 */
const menuItemVariants = cva(
  [
    'flex items-center gap-3',
    'w-full px-4 py-3',
    'text-sm font-medium',
    'text-[var(--md-sys-color-on-surface)]',
    'transition-colors duration-[var(--md-sys-motion-duration-short2)]',
    'cursor-pointer',
    'outline-none',
    // State layers
    'hover:bg-[var(--md-sys-color-on-surface)]/[0.08]',
    'focus-visible:bg-[var(--md-sys-color-on-surface)]/[0.12]',
    'active:bg-[var(--md-sys-color-on-surface)]/[0.12]',
  ].join(' '),
  {
    variants: {
      disabled: {
        true: [
          'opacity-38',
          'cursor-not-allowed',
          'hover:bg-transparent',
          'active:bg-transparent',
        ].join(' '),
      },
      destructive: {
        true: [
          'text-[var(--md-sys-color-error)]',
          'hover:bg-[var(--md-sys-color-error)]/[0.08]',
          'focus-visible:bg-[var(--md-sys-color-error)]/[0.12]',
          'active:bg-[var(--md-sys-color-error)]/[0.12]',
        ].join(' '),
      },
    },
  }
);

/**
 * Scrim overlay styles
 */
const scrimVariants = cva(
  [
    'fixed inset-0 z-40',
    'bg-transparent',
  ].join(' ')
);

/**
 * M3 Context Menu Component
 */
const M3ContextMenu = React.forwardRef<HTMLDivElement, M3ContextMenuProps>(
  (
    {
      open,
      onClose,
      items,
      position,
      className,
      'aria-label': ariaLabel = 'Context menu',
    },
    ref
  ) => {
    const menuRef = React.useRef<HTMLDivElement>(null);
    const [adjustedPosition, setAdjustedPosition] = React.useState(position);
    const [isAnimating, setIsAnimating] = React.useState(false);
    const [shouldRender, setShouldRender] = React.useState(open);

    // Handle open/close animation
    React.useEffect(() => {
      if (open) {
        setShouldRender(true);
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      } else {
        setIsAnimating(false);
        const timer = setTimeout(() => {
          setShouldRender(false);
        }, 150); // Match animation duration
        return () => clearTimeout(timer);
      }
    }, [open]);

    // Adjust position to keep menu within viewport
    React.useEffect(() => {
      if (!open || !menuRef.current) return;

      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let x = position.x;
      let y = position.y;

      // Adjust horizontal position
      if (x + rect.width > viewportWidth - 16) {
        x = viewportWidth - rect.width - 16;
      }
      if (x < 16) {
        x = 16;
      }

      // Adjust vertical position
      if (y + rect.height > viewportHeight - 16) {
        y = viewportHeight - rect.height - 16;
      }
      if (y < 16) {
        y = 16;
      }

      setAdjustedPosition({ x, y });
    }, [open, position]);

    // Handle escape key
    React.useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && open) {
          onClose();
        }
      };

      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }, [open, onClose]);

    // Handle item click
    const handleItemClick = React.useCallback((item: M3ContextMenuItem) => {
      if (item.disabled) return;
      item.onClick?.();
      onClose();
    }, [onClose]);

    // Handle keyboard navigation
    const handleKeyDown = React.useCallback((e: React.KeyboardEvent, item: M3ContextMenuItem, index: number) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleItemClick(item);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = (index + 1) % items.length;
        const nextItem = menuRef.current?.querySelector(`[data-index="${nextIndex}"]`) as HTMLElement;
        nextItem?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = (index - 1 + items.length) % items.length;
        const prevItem = menuRef.current?.querySelector(`[data-index="${prevIndex}"]`) as HTMLElement;
        prevItem?.focus();
      }
    }, [handleItemClick, items.length]);

    if (!shouldRender) return null;

    return (
      <>
        {/* Scrim overlay */}
        <div
          className={cn(scrimVariants())}
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Context menu */}
        <div
          ref={(node) => {
            (menuRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          className={cn(
            contextMenuVariants(),
            'transition-all duration-150 ease-[var(--md-sys-motion-easing-emphasized-decelerate)]',
            isAnimating 
              ? 'opacity-100 scale-100' 
              : 'opacity-0 scale-95',
            className
          )}
          style={{
            left: adjustedPosition.x,
            top: adjustedPosition.y,
            transformOrigin: 'top left',
          }}
          role="menu"
          aria-label={ariaLabel}
        >
          {items.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                menuItemVariants({
                  disabled: item.disabled,
                  destructive: item.destructive,
                })
              )}
              role="menuitem"
              tabIndex={item.disabled ? -1 : 0}
              data-index={index}
              onClick={() => handleItemClick(item)}
              onKeyDown={(e) => handleKeyDown(e, item, index)}
              aria-disabled={item.disabled}
            >
              {item.icon && (
                <span className="flex-shrink-0 w-5 h-5">
                  {item.icon}
                </span>
              )}
              <span className="flex-1 truncate">{item.label}</span>
            </div>
          ))}
        </div>
      </>
    );
  }
);

M3ContextMenu.displayName = 'M3ContextMenu';

export { M3ContextMenu, contextMenuVariants, menuItemVariants };
