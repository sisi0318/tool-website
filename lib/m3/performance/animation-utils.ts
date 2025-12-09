/**
 * M3 Animation Performance Utilities
 * 
 * Provides utilities for creating performant animations that maintain 60fps.
 * Uses CSS transforms and opacity for animations to avoid layout-triggering properties.
 * 
 * Requirements: 16.2
 * 
 * Performance Guidelines:
 * - Use transform and opacity for animations (GPU-accelerated)
 * - Avoid animating layout-triggering properties (width, height, top, left, margin, padding)
 * - Use will-change sparingly and remove after animation completes
 * - Prefer CSS animations over JavaScript animations when possible
 */

/**
 * CSS properties that trigger layout recalculation (avoid animating these)
 */
export const LAYOUT_TRIGGERING_PROPERTIES = [
  'width',
  'height',
  'top',
  'right',
  'bottom',
  'left',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'border',
  'borderWidth',
  'display',
  'position',
  'float',
  'clear',
  'overflow',
  'font',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'textAlign',
  'verticalAlign',
] as const;

/**
 * CSS properties that are GPU-accelerated and safe for 60fps animations
 */
export const GPU_ACCELERATED_PROPERTIES = [
  'transform',
  'opacity',
  'filter',
  'clipPath',
] as const;

/**
 * Transform-based animation presets for common UI patterns
 * These use only GPU-accelerated properties for smooth 60fps performance
 */
export const TRANSFORM_ANIMATIONS = {
  /** Scale up from 0 to 1 (for enter animations) */
  scaleIn: {
    from: { transform: 'scale(0)', opacity: '0' },
    to: { transform: 'scale(1)', opacity: '1' },
  },
  /** Scale down from 1 to 0 (for exit animations) */
  scaleOut: {
    from: { transform: 'scale(1)', opacity: '1' },
    to: { transform: 'scale(0)', opacity: '0' },
  },
  /** Fade in */
  fadeIn: {
    from: { opacity: '0' },
    to: { opacity: '1' },
  },
  /** Fade out */
  fadeOut: {
    from: { opacity: '1' },
    to: { opacity: '0' },
  },
  /** Slide in from bottom */
  slideInFromBottom: {
    from: { transform: 'translateY(100%)', opacity: '0' },
    to: { transform: 'translateY(0)', opacity: '1' },
  },
  /** Slide out to bottom */
  slideOutToBottom: {
    from: { transform: 'translateY(0)', opacity: '1' },
    to: { transform: 'translateY(100%)', opacity: '0' },
  },
  /** Slide in from top */
  slideInFromTop: {
    from: { transform: 'translateY(-100%)', opacity: '0' },
    to: { transform: 'translateY(0)', opacity: '1' },
  },
  /** Slide out to top */
  slideOutToTop: {
    from: { transform: 'translateY(0)', opacity: '1' },
    to: { transform: 'translateY(-100%)', opacity: '0' },
  },
  /** Slide in from left */
  slideInFromLeft: {
    from: { transform: 'translateX(-100%)', opacity: '0' },
    to: { transform: 'translateX(0)', opacity: '1' },
  },
  /** Slide out to left */
  slideOutToLeft: {
    from: { transform: 'translateX(0)', opacity: '1' },
    to: { transform: 'translateX(-100%)', opacity: '0' },
  },
  /** Slide in from right */
  slideInFromRight: {
    from: { transform: 'translateX(100%)', opacity: '0' },
    to: { transform: 'translateX(0)', opacity: '1' },
  },
  /** Slide out to right */
  slideOutToRight: {
    from: { transform: 'translateX(0)', opacity: '1' },
    to: { transform: 'translateX(100%)', opacity: '0' },
  },
  /** Ripple expand (for M3 ripple effect) */
  rippleExpand: {
    from: { transform: 'scale(0)', opacity: '0.12' },
    to: { transform: 'scale(1)', opacity: '0' },
  },
  /** Hover lift effect using transform */
  hoverLift: {
    from: { transform: 'translateY(0)' },
    to: { transform: 'translateY(-2px)' },
  },
  /** Press effect using transform */
  pressDown: {
    from: { transform: 'scale(1)' },
    to: { transform: 'scale(0.98)' },
  },
} as const;

/**
 * CSS class names for performant animations
 * These classes use will-change to hint browser optimization
 */
export const PERFORMANCE_CLASSES = {
  /** Optimize for transform animations */
  willChangeTransform: 'will-change-transform',
  /** Optimize for opacity animations */
  willChangeOpacity: 'will-change-[opacity]',
  /** Optimize for both transform and opacity */
  willChangeTransformOpacity: 'will-change-[transform,opacity]',
  /** Force GPU acceleration */
  gpuAccelerated: 'transform-gpu',
  /** Backface visibility hidden (prevents flickering) */
  backfaceHidden: 'backface-visibility-hidden',
} as const;

/**
 * Generates inline styles for transform-based position changes
 * Use this instead of animating top/left/right/bottom
 * 
 * @param x - Horizontal offset in pixels
 * @param y - Vertical offset in pixels
 * @returns CSS transform string
 */
export function getTransformPosition(x: number, y: number): string {
  return `translate3d(${x}px, ${y}px, 0)`;
}

/**
 * Generates inline styles for transform-based size changes
 * Use this instead of animating width/height
 * 
 * @param scaleX - Horizontal scale factor (1 = 100%)
 * @param scaleY - Vertical scale factor (1 = 100%)
 * @returns CSS transform string
 */
export function getTransformScale(scaleX: number, scaleY: number = scaleX): string {
  return `scale3d(${scaleX}, ${scaleY}, 1)`;
}

/**
 * Combines multiple transforms into a single transform string
 * 
 * @param transforms - Array of transform strings
 * @returns Combined CSS transform string
 */
export function combineTransforms(...transforms: string[]): string {
  return transforms.filter(Boolean).join(' ');
}

/**
 * Creates a performant animation style object
 * Uses only GPU-accelerated properties
 * 
 * @param duration - Animation duration in ms
 * @param easing - CSS easing function
 * @returns CSS style object for transitions
 */
export function createPerformantTransition(
  duration: number = 300,
  easing: string = 'var(--md-sys-motion-easing-standard)'
): React.CSSProperties {
  return {
    transition: `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`,
    willChange: 'transform, opacity',
  };
}

/**
 * Removes will-change after animation completes to free up resources
 * Call this in useEffect cleanup or after animation ends
 * 
 * @param element - DOM element to clean up
 */
export function cleanupWillChange(element: HTMLElement | null): void {
  if (element) {
    element.style.willChange = 'auto';
  }
}

/**
 * Checks if a CSS property is safe for 60fps animations
 * 
 * @param property - CSS property name
 * @returns true if the property is GPU-accelerated
 */
export function isGpuAcceleratedProperty(property: string): boolean {
  return GPU_ACCELERATED_PROPERTIES.includes(
    property as typeof GPU_ACCELERATED_PROPERTIES[number]
  );
}

/**
 * Checks if a CSS property triggers layout recalculation
 * 
 * @param property - CSS property name
 * @returns true if the property triggers layout
 */
export function isLayoutTriggeringProperty(property: string): boolean {
  return LAYOUT_TRIGGERING_PROPERTIES.some(
    (layoutProp) => property.toLowerCase().includes(layoutProp.toLowerCase())
  );
}

/**
 * Type for React.CSSProperties
 */
type CSSProperties = React.CSSProperties;
