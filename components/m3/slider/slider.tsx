'use client';

import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * M3 Slider Component
 * 
 * Implements Material You 3 Expressive slider specifications with:
 * - Proper track styling with active/inactive segments
 * - Thumb with state layer colors
 * - Optional value indicator (tooltip)
 * - M3 motion tokens for smooth interactions
 * 
 * Requirements: 4.9
 */

/**
 * M3 Slider track variant styles
 */
const m3SliderTrackVariants = cva(
  [
    'relative w-full grow overflow-hidden',
    'rounded-[var(--md-sys-shape-corner-full)]',
    'bg-[var(--md-sys-color-surface-container-highest)]',
  ].join(' '),
  {
    variants: {
      size: {
        default: 'h-1',
        large: 'h-2',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
);

/**
 * M3 Slider range (active track) variant styles
 */
const m3SliderRangeVariants = cva(
  [
    'absolute h-full',
    'bg-[var(--md-sys-color-primary)]',
    'rounded-[var(--md-sys-shape-corner-full)]',
  ].join(' '),
  {
    variants: {
      size: {
        default: '',
        large: '',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
);


/**
 * M3 Slider thumb variant styles
 */
const m3SliderThumbVariants = cva(
  [
    'block rounded-full',
    'border-2 border-[var(--md-sys-color-primary)]',
    'bg-[var(--md-sys-color-primary)]',
    'shadow-md',
    'transition-all',
    'duration-[var(--md-sys-motion-duration-short4)]',
    'ease-[var(--md-sys-motion-easing-standard)]',
    'focus-visible:outline-none',
    'focus-visible:ring-2',
    'focus-visible:ring-[var(--md-sys-color-primary)]',
    'focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-38',
    // Hover state layer
    'hover:shadow-lg',
    // Active/pressed state
    'active:scale-110',
  ].join(' '),
  {
    variants: {
      size: {
        default: 'h-5 w-5',
        large: 'h-6 w-6',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
);

export interface M3SliderProps
  extends Omit<React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>, 'children'>,
    VariantProps<typeof m3SliderTrackVariants> {
  /** Whether to show the value indicator tooltip */
  showValueIndicator?: boolean;
  /** Custom format function for the value indicator */
  formatValue?: (value: number) => string;
  /** Whether to show tick marks */
  showTicks?: boolean;
  /** Number of tick marks to show (only used when showTicks is true) */
  tickCount?: number;
  /** Accessible label for the slider */
  'aria-label'?: string;
  /** ID of element that labels this slider */
  'aria-labelledby'?: string;
  /** ID of element that describes this slider */
  'aria-describedby'?: string;
}

/**
 * Value Indicator component for M3 Slider
 * Shows current value in a tooltip above the thumb
 */
function ValueIndicator({ 
  value, 
  formatValue,
  visible 
}: { 
  value: number; 
  formatValue?: (value: number) => string;
  visible: boolean;
}) {
  const displayValue = formatValue ? formatValue(value) : String(value);
  
  return (
    <div
      className={cn(
        'absolute -top-8 left-1/2 -translate-x-1/2',
        'px-2 py-1',
        'rounded-[var(--md-sys-shape-corner-small)]',
        'bg-[var(--md-sys-color-primary)]',
        'text-[var(--md-sys-color-on-primary)]',
        'text-xs font-medium',
        'transition-opacity',
        'duration-[var(--md-sys-motion-duration-short2)]',
        'ease-[var(--md-sys-motion-easing-standard)]',
        visible ? 'opacity-100' : 'opacity-0',
        // Arrow/pointer at bottom
        'after:absolute after:top-full after:left-1/2 after:-translate-x-1/2',
        'after:border-4 after:border-transparent',
        'after:border-t-[var(--md-sys-color-primary)]'
      )}
      role="tooltip"
      aria-hidden={!visible}
    >
      {displayValue}
    </div>
  );
}


/**
 * M3 Slider Component
 * 
 * A Material You 3 Expressive slider with support for:
 * - Two sizes: default and large
 * - Optional value indicator tooltip
 * - Optional tick marks
 * - M3 color tokens for track and thumb
 * - Smooth state transitions with M3 motion
 */
const M3Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  M3SliderProps
>(
  (
    {
      className,
      size = 'default',
      showValueIndicator = false,
      formatValue,
      showTicks = false,
      tickCount = 5,
      defaultValue,
      value,
      min = 0,
      max = 100,
      step = 1,
      disabled,
      onValueChange,
      ...props
    },
    ref
  ) => {
    const [localValue, setLocalValue] = React.useState<number[]>(
      value ?? defaultValue ?? [min]
    );
    const [isDragging, setIsDragging] = React.useState(false);

    // Sync with controlled value
    React.useEffect(() => {
      if (value !== undefined) {
        setLocalValue(value);
      }
    }, [value]);

    const handleValueChange = (newValue: number[]) => {
      setLocalValue(newValue);
      onValueChange?.(newValue);
    };

    // Generate tick marks
    const ticks = React.useMemo(() => {
      if (!showTicks || tickCount < 2) return [];
      const tickValues: number[] = [];
      const range = max - min;
      for (let i = 0; i < tickCount; i++) {
        tickValues.push(min + (range * i) / (tickCount - 1));
      }
      return tickValues;
    }, [showTicks, tickCount, min, max]);

    return (
      <div className="relative w-full">
        {/* Tick marks */}
        {showTicks && ticks.length > 0 && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none">
            {ticks.map((tick, index) => (
              <div
                key={index}
                className={cn(
                  'w-0.5 h-2 rounded-full',
                  tick <= (localValue[0] ?? min)
                    ? 'bg-[var(--md-sys-color-on-primary)]'
                    : 'bg-[var(--md-sys-color-outline)]'
                )}
                style={{
                  position: 'absolute',
                  left: `${((tick - min) / (max - min)) * 100}%`,
                  transform: 'translateX(-50%)',
                }}
              />
            ))}
          </div>
        )}

        <SliderPrimitive.Root
          ref={ref}
          className={cn(
            'relative flex w-full touch-none select-none items-center',
            disabled && 'opacity-38 cursor-not-allowed',
            className
          )}
          defaultValue={defaultValue}
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onValueChange={handleValueChange}
          onPointerDown={() => setIsDragging(true)}
          onPointerUp={() => setIsDragging(false)}
          {...props}
        >
          <SliderPrimitive.Track className={m3SliderTrackVariants({ size })}>
            <SliderPrimitive.Range className={m3SliderRangeVariants({ size })} />
          </SliderPrimitive.Track>
          
          {(localValue ?? [min]).map((val, index) => (
            <SliderPrimitive.Thumb
              key={index}
              className={cn(m3SliderThumbVariants({ size }), 'relative')}
            >
              {showValueIndicator && (
                <ValueIndicator
                  value={val}
                  formatValue={formatValue}
                  visible={isDragging}
                />
              )}
            </SliderPrimitive.Thumb>
          ))}
        </SliderPrimitive.Root>
      </div>
    );
  }
);

M3Slider.displayName = 'M3Slider';

export { M3Slider, m3SliderTrackVariants, m3SliderRangeVariants, m3SliderThumbVariants };
