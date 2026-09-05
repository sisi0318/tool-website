'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * M3 Bottom Sheet Component
 * 
 * Implements Material You 3 Expressive bottom sheet specifications with:
 * - Modal and standard variants
 * - Drag handle for gesture interaction
 * - Scrim overlay for modal variant
 * - Smooth enter/exit animations
 * 
 * Requirements: 15.5
 */

export interface M3BottomSheetProps {
  /** Whether the bottom sheet is open */
  open: boolean;
  /** Callback when the sheet should close */
  onClose: () => void;
  /** Sheet content */
  children: React.ReactNode;
  /** Whether to show the drag handle */
  showDragHandle?: boolean;
  /** Additional class names */
  className?: string;
  /** Title for the sheet */
  title?: string;
  /** Accessible label for an optional visible close button */
  closeLabel?: string;
  /** Accessible label for the sheet (used if no title) */
  'aria-label'?: string;
  /** ID of element that describes this sheet */
  'aria-describedby'?: string;
}

/**
 * Bottom sheet container styles
 */
const bottomSheetVariants = cva(
  [
    'fixed inset-x-0 bottom-0 z-50',
    'bg-[var(--md-sys-color-surface-container-low)]',
    'rounded-t-[var(--md-sys-shape-corner-extra-large)]',
    'shadow-2xl',
    'max-h-[90vh]',
    'overflow-hidden',
    'flex flex-col',
  ].join(' ')
);

/**
 * Scrim overlay styles
 */
const scrimVariants = cva(
  [
    'fixed inset-0 z-40',
    'bg-[var(--md-sys-color-scrim)]/[0.32]',
  ].join(' ')
);

/**
 * Drag handle styles
 */
const dragHandleVariants = cva(
  [
    'w-8 h-1',
    'bg-[var(--md-sys-color-on-surface-variant)]/[0.4]',
    'rounded-full',
    'mx-auto my-4',
  ].join(' ')
);

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getAttribute('aria-hidden') !== 'true'
  );
}

/**
 * M3 Bottom Sheet Component
 */
const M3BottomSheet = React.forwardRef<HTMLDivElement, M3BottomSheetProps>(
  (
    {
      open,
      onClose,
      children,
      showDragHandle = true,
      className,
      title,
      closeLabel,
      'aria-label': ariaLabel,
      'aria-describedby': ariaDescribedBy,
    },
    ref
  ) => {
    const titleId = React.useId();
    const [isAnimating, setIsAnimating] = React.useState(false);
    const [shouldRender, setShouldRender] = React.useState(open);
    const sheetRef = React.useRef<HTMLDivElement | null>(null);
    const startY = React.useRef<number>(0);
    const currentY = React.useRef<number>(0);

    // Handle open/close animation
    React.useEffect(() => {
      if (open) {
        setShouldRender(true);
        // Small delay to trigger animation
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      } else {
        setIsAnimating(false);
        // Wait for animation to complete before unmounting
        const timer = setTimeout(() => {
          setShouldRender(false);
        }, 300); // Match animation duration
        return () => clearTimeout(timer);
      }
    }, [open]);

    // Handle touch start for drag gesture
    const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
      startY.current = e.touches[0].clientY;
      currentY.current = 0;
    }, []);

    // Handle touch move for drag gesture
    const handleTouchMove = React.useCallback((e: React.TouchEvent) => {
      const deltaY = e.touches[0].clientY - startY.current;
      currentY.current = Math.max(0, deltaY); // Only allow dragging down
      
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translateY(${currentY.current}px)`;
      }
    }, []);

    // Handle touch end for drag gesture
    const handleTouchEnd = React.useCallback(() => {
      if (sheetRef.current) {
        sheetRef.current.style.transform = '';
      }
      
      // If dragged more than 100px, close the sheet
      if (currentY.current > 100) {
        onClose();
      }
      
      currentY.current = 0;
    }, [onClose]);

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

    // 打开时把焦点移进弹层,关闭时还给打开前的元素。模态弹层不接管焦点的话,
    // 键盘用户的焦点会留在被遮住的页面上,Tab 一直在看不见的地方打转。
    React.useEffect(() => {
      if (!open || !shouldRender) return;
      const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const frame = requestAnimationFrame(() => {
        const sheet = sheetRef.current;
        if (!sheet || sheet.contains(document.activeElement)) return;
        (getFocusable(sheet)[0] ?? sheet).focus();
      });
      return () => {
        cancelAnimationFrame(frame);
        if (previouslyFocused?.isConnected) previouslyFocused.focus();
      };
    }, [open, shouldRender]);

    // 焦点圈禁:Tab 到最后一个可聚焦元素后绕回第一个,Shift+Tab 反之
    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Tab' || !sheetRef.current) return;
      const focusable = getFocusable(sheetRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === sheetRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // Prevent body scroll when sheet is open
    React.useEffect(() => {
      if (open) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
      return () => {
        document.body.style.overflow = '';
      };
    }, [open]);

    if (!shouldRender) return null;

    return (
      <>
        {/* Scrim overlay */}
        <div
          className={cn(
            scrimVariants(),
            'transition-opacity duration-md-medium-2',
            isAnimating ? 'opacity-100' : 'opacity-0'
          )}
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Bottom sheet */}
        <div
          ref={(node) => {
            sheetRef.current = node;
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
            }
          }}
          className={cn(
            bottomSheetVariants(),
            'transition-transform duration-md-medium-2 ease-md-emphasized',
            isAnimating ? 'translate-y-0' : 'translate-y-full',
            className
          )}
          role="dialog"
          aria-modal="true"
          aria-label={title ? undefined : ariaLabel}
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={ariaDescribedBy}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Drag handle */}
          {showDragHandle && (
            <div className="flex-shrink-0 cursor-grab active:cursor-grabbing">
              <div className={cn(dragHandleVariants())} />
            </div>
          )}

          {/* Title */}
          {title && (
            <div className="flex flex-shrink-0 items-center justify-between gap-3 px-6 pb-4">
              <h2 
                id={titleId}
                className="text-lg font-medium text-[var(--md-sys-color-on-surface)]"
              >
                {title}
              </h2>
              {closeLabel && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={closeLabel}
                  className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full text-2xl leading-none text-[var(--md-sys-color-on-surface-variant)] transition-colors hover:bg-[var(--md-sys-color-on-surface)]/[0.08]"
                >
                  <span aria-hidden="true">×</span>
                </button>
              )}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-6">
            {children}
          </div>
        </div>
      </>
    );
  }
);

M3BottomSheet.displayName = 'M3BottomSheet';

export { M3BottomSheet, bottomSheetVariants, scrimVariants, dragHandleVariants };
