'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

/**
 * M3 Dialog Component
 * 
 * Implements Material You 3 Expressive dialog specifications with:
 * - Proper scrim (32% opacity)
 * - Surface-container-high background
 * - Correct action button placement
 * - M3 Expressive shape (extra-large corners)
 * - Smooth enter/exit animations using M3 motion tokens
 * 
 * Requirements: 4.6
 */

/**
 * M3 Dialog content variant styles
 */
const m3DialogContentVariants = cva(
  [
    // Base styles
    'fixed left-[50%] top-[50%] z-50',
    'translate-x-[-50%] translate-y-[-50%]',
    'w-full max-w-lg',
    'p-6',
    // M3 surface-container-high background
    'bg-[var(--md-sys-color-surface-container-high)]',
    'text-[var(--md-sys-color-on-surface)]',
    // M3 Expressive shape (extra-large corners - 28px)
    'rounded-[var(--md-sys-shape-corner-extra-large)]',
    // Shadow for elevation
    'shadow-xl',
    // Animation
    'duration-[var(--md-sys-motion-duration-medium2)]',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
    'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
    'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
    'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
  ].join(' '),
  {
    variants: {
      /**
       * Dialog size variants
       */
      size: {
        small: 'max-w-sm',
        medium: 'max-w-lg',
        large: 'max-w-2xl',
        fullscreen: 'max-w-none w-screen h-screen rounded-none',
      },
    },
    defaultVariants: {
      size: 'medium',
    },
  }
);

/**
 * M3 Dialog Root - wraps Radix Dialog.Root
 */
const M3Dialog = DialogPrimitive.Root;

/**
 * M3 Dialog Trigger - wraps Radix Dialog.Trigger
 */
const M3DialogTrigger = DialogPrimitive.Trigger;

/**
 * M3 Dialog Portal - wraps Radix Dialog.Portal
 */
const M3DialogPortal = DialogPrimitive.Portal;

/**
 * M3 Dialog Close - wraps Radix Dialog.Close
 */
const M3DialogClose = DialogPrimitive.Close;


/**
 * M3 Dialog Overlay (Scrim)
 * 
 * Implements M3 scrim with 32% opacity as per specification
 */
const M3DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50',
      // M3 scrim color with 32% opacity
      'bg-[var(--md-sys-color-scrim)]/[0.32]',
      // Animation
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      'duration-[var(--md-sys-motion-duration-medium2)]',
      className
    )}
    {...props}
  />
));
M3DialogOverlay.displayName = 'M3DialogOverlay';

export interface M3DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof m3DialogContentVariants> {
  /** Whether to show the close button */
  showCloseButton?: boolean;
}

/**
 * M3 Dialog Content
 * 
 * The main content container for the dialog with:
 * - Surface-container-high background
 * - Extra-large corner radius (28px)
 * - Optional close button
 */
const M3DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  M3DialogContentProps
>(({ className, children, size, showCloseButton = true, ...props }, ref) => (
  <M3DialogPortal>
    <M3DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(m3DialogContentVariants({ size }), className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close
          className={cn(
            'absolute right-4 top-4',
            'rounded-[var(--md-sys-shape-corner-full)]',
            'p-2',
            'text-[var(--md-sys-color-on-surface-variant)]',
            'opacity-70 hover:opacity-100',
            'hover:bg-[var(--md-sys-color-on-surface)]/[0.08]',
            'focus:outline-none focus:ring-2',
            'focus:ring-[var(--md-sys-color-primary)]',
            'focus:ring-offset-2',
            'disabled:pointer-events-none',
            'transition-all duration-[var(--md-sys-motion-duration-short2)]'
          )}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </M3DialogPortal>
));
M3DialogContent.displayName = 'M3DialogContent';


/**
 * M3 Dialog Header
 * 
 * Container for dialog title and description with proper spacing
 */
const M3DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-2',
      'text-center sm:text-left',
      className
    )}
    {...props}
  />
);
M3DialogHeader.displayName = 'M3DialogHeader';

/**
 * M3 Dialog Footer
 * 
 * Container for action buttons with proper M3 placement:
 * - Buttons aligned to the right
 * - Proper spacing between buttons
 * - Confirm button on the right, cancel on the left
 */
const M3DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end',
      'gap-2 sm:gap-3',
      'mt-6',
      className
    )}
    {...props}
  />
);
M3DialogFooter.displayName = 'M3DialogFooter';

/**
 * M3 Dialog Title
 * 
 * Dialog headline with M3 typography (headline-small)
 */
const M3DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      // M3 headline-small typography
      'text-lg font-semibold leading-none tracking-tight',
      'text-[var(--md-sys-color-on-surface)]',
      className
    )}
    {...props}
  />
));
M3DialogTitle.displayName = 'M3DialogTitle';

/**
 * M3 Dialog Description
 * 
 * Dialog supporting text with M3 typography (body-medium)
 */
const M3DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn(
      // M3 body-medium typography
      'text-sm',
      'text-[var(--md-sys-color-on-surface-variant)]',
      className
    )}
    {...props}
  />
));
M3DialogDescription.displayName = 'M3DialogDescription';

export {
  M3Dialog,
  M3DialogPortal,
  M3DialogOverlay,
  M3DialogClose,
  M3DialogTrigger,
  M3DialogContent,
  M3DialogHeader,
  M3DialogFooter,
  M3DialogTitle,
  M3DialogDescription,
  m3DialogContentVariants,
};
