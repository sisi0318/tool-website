'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * M3 TextField Component
 * 
 * Implements Material You 3 Expressive text field specifications with:
 * - Two variants: filled, outlined
 * - Label animation on focus
 * - Supporting text and error text display
 * - Leading and trailing icon support
 * 
 * Requirements: 4.3
 */

/**
 * M3 TextField variant styles using CSS custom properties
 * Based on Material Design 3 Expressive specifications
 */
const m3TextFieldVariants = cva(
  // Base container styles
  [
    'relative w-full',
    'transition-all',
    'duration-[var(--md-sys-motion-duration-short4)]',
    'ease-[var(--md-sys-motion-easing-standard)]',
  ].join(' '),
  {
    variants: {
      /**
       * M3 TextField variants:
       * - filled: Surface container with bottom border
       * - outlined: Transparent with full border
       */
      variant: {
        filled: '',
        outlined: '',
      },
      /**
       * Error state
       */
      error: {
        true: '',
        false: '',
      },
      /**
       * Disabled state
       */
      disabled: {
        true: 'opacity-38 pointer-events-none',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'filled',
      error: false,
      disabled: false,
    },
  }
);


/**
 * Input container styles
 */
const inputContainerVariants = cva(
  [
    'relative flex items-center',
    'min-h-[56px]',
    'transition-all',
    'duration-[var(--md-sys-motion-duration-short4)]',
    'ease-[var(--md-sys-motion-easing-standard)]',
  ].join(' '),
  {
    variants: {
      variant: {
        filled: [
          'bg-[var(--md-sys-color-surface-container-highest)]',
          'rounded-t-[var(--md-sys-shape-corner-extra-small)]',
          'border-b-2',
          'hover:bg-[var(--md-sys-color-on-surface)]/[0.08]',
        ].join(' '),
        outlined: [
          'bg-transparent',
          'rounded-[var(--md-sys-shape-corner-extra-small)]',
          'border',
        ].join(' '),
      },
      error: {
        true: '',
        false: '',
      },
      focused: {
        true: '',
        false: '',
      },
      disabled: {
        true: '',
        false: '',
      },
    },
    compoundVariants: [
      // Filled variant states
      {
        variant: 'filled',
        error: false,
        focused: false,
        className: 'border-b-[var(--md-sys-color-on-surface-variant)]',
      },
      {
        variant: 'filled',
        error: false,
        focused: true,
        className: 'border-b-[var(--md-sys-color-primary)] border-b-[3px]',
      },
      {
        variant: 'filled',
        error: true,
        focused: false,
        className: 'border-b-[var(--md-sys-color-error)]',
      },
      {
        variant: 'filled',
        error: true,
        focused: true,
        className: 'border-b-[var(--md-sys-color-error)] border-b-[3px]',
      },
      // Outlined variant states
      {
        variant: 'outlined',
        error: false,
        focused: false,
        className: 'border-[var(--md-sys-color-outline)]',
      },
      {
        variant: 'outlined',
        error: false,
        focused: true,
        className: 'border-[var(--md-sys-color-primary)] border-2',
      },
      {
        variant: 'outlined',
        error: true,
        focused: false,
        className: 'border-[var(--md-sys-color-error)]',
      },
      {
        variant: 'outlined',
        error: true,
        focused: true,
        className: 'border-[var(--md-sys-color-error)] border-2',
      },
    ],
    defaultVariants: {
      variant: 'filled',
      error: false,
      focused: false,
      disabled: false,
    },
  }
);


/**
 * Label styles with animation
 */
const labelVariants = cva(
  [
    'absolute left-4 pointer-events-none',
    'transition-all',
    'duration-[var(--md-sys-motion-duration-short4)]',
    'ease-[var(--md-sys-motion-easing-emphasized)]',
    'origin-top-left',
  ].join(' '),
  {
    variants: {
      variant: {
        filled: '',
        outlined: '',
      },
      floated: {
        true: '',
        false: '',
      },
      error: {
        true: '',
        false: '',
      },
      focused: {
        true: '',
        false: '',
      },
    },
    compoundVariants: [
      // Filled variant label positions (non-error)
      {
        variant: 'filled',
        floated: false,
        error: false,
        className: 'top-1/2 -translate-y-1/2 text-base text-[var(--md-sys-color-on-surface-variant)]',
      },
      {
        variant: 'filled',
        floated: false,
        error: true,
        className: 'top-1/2 -translate-y-1/2 text-base text-[var(--md-sys-color-error)]',
      },
      {
        variant: 'filled',
        floated: true,
        className: 'top-2 text-xs scale-100',
      },
      // Outlined variant label positions (non-error)
      {
        variant: 'outlined',
        floated: false,
        error: false,
        className: 'top-1/2 -translate-y-1/2 text-base text-[var(--md-sys-color-on-surface-variant)]',
      },
      {
        variant: 'outlined',
        floated: false,
        error: true,
        className: 'top-1/2 -translate-y-1/2 text-base text-[var(--md-sys-color-error)]',
      },
      {
        variant: 'outlined',
        floated: true,
        className: 'top-0 -translate-y-1/2 text-xs scale-100 bg-[var(--md-sys-color-surface)] px-1 ml-[-4px]',
      },
      // Focused state colors (non-error)
      {
        focused: true,
        error: false,
        className: 'text-[var(--md-sys-color-primary)]',
      },
      // Error state colors (always apply error color)
      {
        error: true,
        className: 'text-[var(--md-sys-color-error)]',
      },
      // Floated non-focused non-error
      {
        floated: true,
        focused: false,
        error: false,
        className: 'text-[var(--md-sys-color-on-surface-variant)]',
      },
    ],
    defaultVariants: {
      variant: 'filled',
      floated: false,
      error: false,
      focused: false,
    },
  }
);


export interface M3TextFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'>,
    VariantProps<typeof m3TextFieldVariants> {
  /** Label text displayed above or inside the input */
  label: string;
  /** Supporting text displayed below the input */
  supportingText?: string;
  /** Error text displayed below the input (replaces supporting text when present) */
  errorText?: string;
  /** Icon displayed at the start of the input */
  leadingIcon?: React.ReactNode;
  /** Icon displayed at the end of the input */
  trailingIcon?: React.ReactNode;
  /** Current value of the input */
  value?: string;
  /** Callback when value changes */
  onChange?: (value: string) => void;
  /** Whether the input is in error state */
  error?: boolean;
}

/**
 * M3 TextField Component
 * 
 * A Material You 3 Expressive text field with support for:
 * - Two variants: filled, outlined
 * - Animated floating label
 * - Supporting and error text
 * - Leading and trailing icons
 */
const M3TextField = React.forwardRef<HTMLInputElement, M3TextFieldProps>(
  (
    {
      className,
      variant = 'filled',
      label,
      supportingText,
      errorText,
      leadingIcon,
      trailingIcon,
      value = '',
      onChange,
      error = false,
      disabled = false,
      id,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const [internalValue, setInternalValue] = React.useState(value);
    const inputId = id || React.useId();
    const supportingTextId = React.useId();
    
    // Sync internal value with prop
    React.useEffect(() => {
      setInternalValue(value);
    }, [value]);

    const hasValue = internalValue.length > 0;
    const isFloated = isFocused || hasValue;
    const hasError = error || !!errorText;
    const displayText = errorText || supportingText;

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(event);
    };

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(event);
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      setInternalValue(newValue);
      onChange?.(newValue);
    };

    return (
      <div className={cn(m3TextFieldVariants({ variant, error: hasError, disabled }), className)}>
        {/* Input container */}
        <div
          className={cn(
            inputContainerVariants({
              variant,
              error: hasError,
              focused: isFocused,
              disabled,
            })
          )}
        >
          {/* Leading icon */}
          {leadingIcon && (
            <span
              className={cn(
                'flex items-center justify-center w-12 h-full shrink-0',
                'text-[var(--md-sys-color-on-surface-variant)]',
                '[&_svg]:size-6'
              )}
              aria-hidden="true"
            >
              {leadingIcon}
            </span>
          )}

          {/* Input wrapper with label */}
          <div className="relative flex-1 h-full">
            {/* Floating label */}
            <label
              htmlFor={inputId}
              className={cn(
                labelVariants({
                  variant,
                  floated: isFloated,
                  error: hasError,
                  focused: isFocused,
                }),
                leadingIcon && !isFloated && 'left-0'
              )}
            >
              {label}
            </label>

            {/* Input element */}
            <input
              ref={ref}
              id={inputId}
              type="text"
              value={internalValue}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              disabled={disabled}
              aria-invalid={hasError}
              aria-describedby={displayText ? supportingTextId : undefined}
              className={cn(
                'w-full h-full bg-transparent outline-none',
                'text-[var(--md-sys-color-on-surface)]',
                'text-base',
                'placeholder:text-transparent',
                variant === 'filled' ? 'pt-6 pb-2 px-4' : 'py-4 px-4',
                leadingIcon && 'pl-0',
                trailingIcon && 'pr-0',
                disabled && 'cursor-not-allowed'
              )}
              {...props}
            />
          </div>

          {/* Trailing icon */}
          {trailingIcon && (
            <span
              className={cn(
                'flex items-center justify-center w-12 h-full shrink-0',
                hasError
                  ? 'text-[var(--md-sys-color-error)]'
                  : 'text-[var(--md-sys-color-on-surface-variant)]',
                '[&_svg]:size-6'
              )}
              aria-hidden="true"
            >
              {trailingIcon}
            </span>
          )}
        </div>

        {/* Supporting/Error text */}
        {displayText && (
          <p
            id={supportingTextId}
            className={cn(
              'mt-1 px-4 text-xs',
              'transition-colors duration-[var(--md-sys-motion-duration-short2)]',
              hasError
                ? 'text-[var(--md-sys-color-error)]'
                : 'text-[var(--md-sys-color-on-surface-variant)]'
            )}
          >
            {displayText}
          </p>
        )}
      </div>
    );
  }
);

M3TextField.displayName = 'M3TextField';

export { M3TextField, m3TextFieldVariants };
