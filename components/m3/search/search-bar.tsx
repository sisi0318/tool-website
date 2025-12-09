'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * M3 Search Bar Component
 * 
 * Implements Material You 3 Expressive search bar specifications with:
 * - Large corner radius (full rounded for M3 Expressive style)
 * - Proper surface color (surface-container-high)
 * - Expand animation on focus using M3 emphasized motion
 * - Leading search icon and optional trailing icon
 * - Search results dropdown support
 * 
 * Requirements: 10.1, 10.3
 */

/**
 * M3 Search Bar container styles
 */
const m3SearchBarVariants = cva(
  [
    'relative flex items-center',
    'bg-[var(--md-sys-color-surface-container-high)]',
    'rounded-[var(--md-sys-shape-corner-full)]',
    'transition-all',
    'duration-[var(--md-sys-motion-duration-medium2)]',
    'ease-[var(--md-sys-motion-easing-emphasized)]',
  ].join(' '),
  {
    variants: {
      /**
       * Size variants for the search bar
       */
      size: {
        small: 'h-10 min-w-[200px]',
        medium: 'h-12 min-w-[280px]',
        large: 'h-14 min-w-[360px]',
      },
      /**
       * Expanded state (on focus)
       */
      expanded: {
        true: '',
        false: '',
      },
      /**
       * Full width mode
       */
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    compoundVariants: [
      {
        expanded: true,
        fullWidth: false,
        size: 'small',
        className: 'min-w-[280px]',
      },
      {
        expanded: true,
        fullWidth: false,
        size: 'medium',
        className: 'min-w-[360px]',
      },
      {
        expanded: true,
        fullWidth: false,
        size: 'large',
        className: 'min-w-[480px]',
      },
    ],
    defaultVariants: {
      size: 'medium',
      expanded: false,
      fullWidth: false,
    },
  }
);

export interface M3SearchBarProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'>,
    VariantProps<typeof m3SearchBarVariants> {
  /** Current search value */
  value?: string;
  /** Callback when search value changes */
  onChange?: (value: string) => void;
  /** Callback when search is submitted (Enter key) */
  onSearch?: (value: string) => void;
  /** Callback when clear button is clicked */
  onClear?: () => void;
  /** Leading icon (defaults to search icon) */
  leadingIcon?: React.ReactNode;
  /** Trailing icon or action */
  trailingIcon?: React.ReactNode;
  /** Whether to show clear button when there's text */
  showClearButton?: boolean;
  /** Children for dropdown/results */
  children?: React.ReactNode;
  /** Whether dropdown is open */
  dropdownOpen?: boolean;
}

/**
 * Default search icon
 */
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}


/**
 * Clear/close icon
 */
function ClearIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

/**
 * M3 Search Bar Component
 * 
 * A Material You 3 Expressive search bar with:
 * - Large corner radius (pill shape)
 * - Surface container high background
 * - Expand animation on focus
 * - Leading and trailing icon support
 * - Optional clear button
 * - Dropdown support for search results
 */
const M3SearchBar = React.forwardRef<HTMLInputElement, M3SearchBarProps>(
  (
    {
      className,
      size = 'medium',
      fullWidth,
      value = '',
      onChange,
      onSearch,
      onClear,
      leadingIcon,
      trailingIcon,
      showClearButton = true,
      children,
      dropdownOpen,
      placeholder = 'Search',
      onFocus,
      onBlur,
      onKeyDown,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const [internalValue, setInternalValue] = React.useState(value);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    
    // Merge refs
    React.useImperativeHandle(ref, () => inputRef.current!);
    
    // Sync internal value with prop
    React.useEffect(() => {
      setInternalValue(value);
    }, [value]);

    const hasValue = internalValue.length > 0;
    const isExpanded = isFocused;
    const showDropdown = dropdownOpen !== undefined ? dropdownOpen : (isFocused && hasValue && React.Children.count(children) > 0);


    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(event);
    };

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      // Delay blur to allow click on dropdown items
      setTimeout(() => {
        if (!containerRef.current?.contains(document.activeElement)) {
          setIsFocused(false);
        }
      }, 150);
      onBlur?.(event);
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      setInternalValue(newValue);
      onChange?.(newValue);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' && onSearch) {
        onSearch(internalValue);
      }
      if (event.key === 'Escape') {
        inputRef.current?.blur();
        setIsFocused(false);
      }
      onKeyDown?.(event);
    };

    const handleClear = () => {
      setInternalValue('');
      onChange?.('');
      onClear?.();
      inputRef.current?.focus();
    };

    // Get icon size based on search bar size
    const iconSize = size === 'small' ? 'size-5' : size === 'large' ? 'size-6' : 'size-5';

    return (
      <div ref={containerRef} className="relative">
        {/* Search bar container */}
        <div
          className={cn(
            m3SearchBarVariants({ size, expanded: isExpanded, fullWidth }),
            // Add shadow on focus for elevation
            isFocused && 'shadow-md',
            className
          )}
        >
          {/* Leading icon */}
          <span
            className={cn(
              'flex items-center justify-center shrink-0',
              'text-[var(--md-sys-color-on-surface-variant)]',
              'transition-colors duration-[var(--md-sys-motion-duration-short2)]',
              size === 'small' ? 'w-10' : size === 'large' ? 'w-14' : 'w-12',
              isFocused && 'text-[var(--md-sys-color-on-surface)]'
            )}
            aria-hidden="true"
          >
            {leadingIcon || <SearchIcon className={iconSize} />}
          </span>


          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={internalValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(
              'flex-1 h-full bg-transparent outline-none',
              'text-[var(--md-sys-color-on-surface)]',
              'placeholder:text-[var(--md-sys-color-on-surface-variant)]',
              size === 'small' ? 'text-sm' : size === 'large' ? 'text-base' : 'text-base',
              'pr-2'
            )}
            role="searchbox"
            aria-label={placeholder}
            {...props}
          />

          {/* Trailing icon or clear button */}
          {(hasValue && showClearButton) || trailingIcon ? (
            <span
              className={cn(
                'flex items-center justify-center shrink-0',
                size === 'small' ? 'w-10' : size === 'large' ? 'w-14' : 'w-12'
              )}
            >
              {hasValue && showClearButton ? (
                <button
                  type="button"
                  onClick={handleClear}
                  className={cn(
                    'flex items-center justify-center',
                    'rounded-full p-1.5',
                    'text-[var(--md-sys-color-on-surface-variant)]',
                    'hover:bg-[var(--md-sys-color-on-surface)]/[0.08]',
                    'active:bg-[var(--md-sys-color-on-surface)]/[0.12]',
                    'transition-colors duration-[var(--md-sys-motion-duration-short2)]',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)]'
                  )}
                  aria-label="Clear search"
                >
                  <ClearIcon className={iconSize} />
                </button>
              ) : (
                <span
                  className="text-[var(--md-sys-color-on-surface-variant)]"
                  aria-hidden="true"
                >
                  {trailingIcon}
                </span>
              )}
            </span>
          ) : null}
        </div>


        {/* Dropdown for search results */}
        {showDropdown && children && (
          <div
            className={cn(
              'absolute z-50 w-full mt-2',
              'bg-[var(--md-sys-color-surface-container)]',
              'rounded-[var(--md-sys-shape-corner-extra-large)]',
              'shadow-lg',
              'overflow-hidden',
              'animate-in fade-in-0 zoom-in-95',
              'duration-[var(--md-sys-motion-duration-short4)]',
              'ease-[var(--md-sys-motion-easing-emphasized-decelerate)]'
            )}
            role="listbox"
          >
            {children}
          </div>
        )}
      </div>
    );
  }
);

M3SearchBar.displayName = 'M3SearchBar';

/**
 * Search result item component for use within M3SearchBar dropdown
 */
export interface M3SearchResultItemProps {
  /** Icon to display */
  icon?: React.ReactNode;
  /** Primary text */
  primary: string;
  /** Secondary text */
  secondary?: string;
  /** Click handler */
  onClick?: () => void;
  /** Whether this item is highlighted/selected */
  highlighted?: boolean;
}

const M3SearchResultItem = React.forwardRef<HTMLButtonElement, M3SearchResultItemProps>(
  ({ icon, primary, secondary, onClick, highlighted }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        className={cn(
          'w-full flex items-center gap-4 px-4 py-3',
          'text-left',
          'transition-colors duration-[var(--md-sys-motion-duration-short2)]',
          'hover:bg-[var(--md-sys-color-on-surface)]/[0.08]',
          'active:bg-[var(--md-sys-color-on-surface)]/[0.12]',
          'focus:outline-none focus-visible:bg-[var(--md-sys-color-on-surface)]/[0.12]',
          highlighted && 'bg-[var(--md-sys-color-on-surface)]/[0.08]'
        )}
        role="option"
        aria-selected={highlighted}
      >
        {icon && (
          <span className="shrink-0 text-[var(--md-sys-color-on-surface-variant)] [&_svg]:size-6">
            {icon}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[var(--md-sys-color-on-surface)] text-base truncate">
            {primary}
          </div>
          {secondary && (
            <div className="text-[var(--md-sys-color-on-surface-variant)] text-sm truncate">
              {secondary}
            </div>
          )}
        </div>
      </button>
    );
  }
);

M3SearchResultItem.displayName = 'M3SearchResultItem';

export { M3SearchBar, M3SearchResultItem, m3SearchBarVariants };