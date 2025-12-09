/**
 * Material You 3 Motion Token System
 * 
 * This module provides the M3 motion tokens interface and definitions
 * for duration values and easing curves used throughout the design system.
 * Motion tokens enable consistent, meaningful animations that follow
 * Material Design 3 specifications.
 */

/**
 * M3 Motion Duration tokens interface
 * Defines timing values for animations and transitions
 */
export interface M3MotionDuration {
  /** 50ms - Very quick micro-interactions */
  short1: string;
  /** 100ms - Quick feedback */
  short2: string;
  /** 150ms - Fast transitions */
  short3: string;
  /** 200ms - Standard quick transitions */
  short4: string;
  /** 250ms - Medium transitions */
  medium1: string;
  /** 300ms - Standard transitions */
  medium2: string;
  /** 350ms - Slightly longer transitions */
  medium3: string;
  /** 400ms - Emphasized transitions */
  medium4: string;
  /** 450ms - Long transitions */
  long1: string;
  /** 500ms - Extended transitions */
  long2: string;
  /** 550ms - Very long transitions */
  long3: string;
  /** 600ms - Extra long transitions */
  long4: string;
  /** 700ms - Extra long 1 */
  extraLong1: string;
  /** 800ms - Extra long 2 */
  extraLong2: string;
  /** 900ms - Extra long 3 */
  extraLong3: string;
  /** 1000ms - Maximum duration */
  extraLong4: string;
}

/**
 * M3 Motion Easing tokens interface
 * Defines cubic-bezier curves for animations
 */
export interface M3MotionEasing {
  /** Standard easing - for most transitions */
  standard: string;
  /** Standard decelerate - for entering elements */
  standardDecelerate: string;
  /** Standard accelerate - for exiting elements */
  standardAccelerate: string;
  /** Emphasized easing - for important transitions */
  emphasized: string;
  /** Emphasized decelerate - for important entering elements */
  emphasizedDecelerate: string;
  /** Emphasized accelerate - for important exiting elements */
  emphasizedAccelerate: string;
}

/**
 * Complete M3 Motion tokens interface
 */
export interface M3Motion {
  duration: M3MotionDuration;
  easing: M3MotionEasing;
}

/**
 * All required duration token keys
 */
export const M3_DURATION_KEYS: (keyof M3MotionDuration)[] = [
  'short1', 'short2', 'short3', 'short4',
  'medium1', 'medium2', 'medium3', 'medium4',
  'long1', 'long2', 'long3', 'long4',
  'extraLong1', 'extraLong2', 'extraLong3', 'extraLong4',
];

/**
 * All required easing token keys
 */
export const M3_EASING_KEYS: (keyof M3MotionEasing)[] = [
  'standard',
  'standardDecelerate',
  'standardAccelerate',
  'emphasized',
  'emphasizedDecelerate',
  'emphasizedAccelerate',
];

/**
 * M3 Motion duration values in milliseconds (numeric)
 * Used for validation and calculations
 */
export const M3_DURATION_VALUES_MS: Record<keyof M3MotionDuration, number> = {
  short1: 50,
  short2: 100,
  short3: 150,
  short4: 200,
  medium1: 250,
  medium2: 300,
  medium3: 350,
  medium4: 400,
  long1: 450,
  long2: 500,
  long3: 550,
  long4: 600,
  extraLong1: 700,
  extraLong2: 800,
  extraLong3: 900,
  extraLong4: 1000,
} as const;

/**
 * M3 Motion easing cubic-bezier values
 * Based on Material Design 3 specifications
 */
export const M3_EASING_VALUES: Record<keyof M3MotionEasing, string> = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  standardDecelerate: 'cubic-bezier(0, 0, 0, 1)',
  standardAccelerate: 'cubic-bezier(0.3, 0, 1, 1)',
  emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
  emphasizedDecelerate: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
  emphasizedAccelerate: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
} as const;

/**
 * Default M3 Motion Duration tokens
 */
export const M3_MOTION_DURATION: M3MotionDuration = {
  short1: '50ms',
  short2: '100ms',
  short3: '150ms',
  short4: '200ms',
  medium1: '250ms',
  medium2: '300ms',
  medium3: '350ms',
  medium4: '400ms',
  long1: '450ms',
  long2: '500ms',
  long3: '550ms',
  long4: '600ms',
  extraLong1: '700ms',
  extraLong2: '800ms',
  extraLong3: '900ms',
  extraLong4: '1000ms',
};

/**
 * Default M3 Motion Easing tokens
 */
export const M3_MOTION_EASING: M3MotionEasing = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  standardDecelerate: 'cubic-bezier(0, 0, 0, 1)',
  standardAccelerate: 'cubic-bezier(0.3, 0, 1, 1)',
  emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
  emphasizedDecelerate: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
  emphasizedAccelerate: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
};

/**
 * Complete default M3 Motion tokens
 */
export const M3_MOTION: M3Motion = {
  duration: M3_MOTION_DURATION,
  easing: M3_MOTION_EASING,
};

/**
 * Validates if a string is a valid CSS duration value in ms format
 */
export function isValidDurationValue(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  return /^\d+(\.\d+)?ms$/.test(value);
}

/**
 * Parses a duration value string to its numeric millisecond value
 * @param value - A duration value string (e.g., "300ms")
 * @returns The numeric millisecond value or null if invalid
 */
export function parseDurationValue(value: string): number | null {
  if (!isValidDurationValue(value)) return null;
  return parseFloat(value.replace('ms', ''));
}

/**
 * Validates if a duration value is within the M3 specification range (50ms - 1000ms)
 */
export function isValidM3DurationRange(value: string): boolean {
  const ms = parseDurationValue(value);
  if (ms === null) return false;
  return ms >= 50 && ms <= 1000;
}

/**
 * Validates if a string is a valid CSS cubic-bezier function
 */
export function isValidCubicBezier(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  
  // Match cubic-bezier(x1, y1, x2, y2) format
  const regex = /^cubic-bezier\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)$/;
  const match = value.match(regex);
  
  if (!match) return false;
  
  // x1 and x2 must be between 0 and 1
  const x1 = parseFloat(match[1]);
  const x2 = parseFloat(match[3]);
  
  return x1 >= 0 && x1 <= 1 && x2 >= 0 && x2 <= 1;
}

/**
 * Parses a cubic-bezier string to its control point values
 * @param value - A cubic-bezier string
 * @returns The control points or null if invalid
 */
export function parseCubicBezier(value: string): { x1: number; y1: number; x2: number; y2: number } | null {
  if (!isValidCubicBezier(value)) return null;
  
  const regex = /cubic-bezier\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/;
  const match = value.match(regex);
  
  if (!match) return null;
  
  return {
    x1: parseFloat(match[1]),
    y1: parseFloat(match[2]),
    x2: parseFloat(match[3]),
    y2: parseFloat(match[4]),
  };
}

/**
 * Validates if a duration token object has all required keys with valid values
 */
export function isValidDurationTokens(duration: M3MotionDuration): boolean {
  if (!duration) return false;
  
  return M3_DURATION_KEYS.every(key => {
    const value = duration[key];
    return isValidDurationValue(value) && isValidM3DurationRange(value);
  });
}

/**
 * Validates if an easing token object has all required keys with valid cubic-bezier values
 */
export function isValidEasingTokens(easing: M3MotionEasing): boolean {
  if (!easing) return false;
  
  return M3_EASING_KEYS.every(key => {
    const value = easing[key];
    return isValidCubicBezier(value);
  });
}

/**
 * Validates if a complete motion token object is valid
 */
export function isValidMotionTokens(motion: M3Motion): boolean {
  if (!motion || !motion.duration || !motion.easing) return false;
  return isValidDurationTokens(motion.duration) && isValidEasingTokens(motion.easing);
}

/**
 * Gets a duration token value from the default M3 motion tokens
 */
export function getDurationToken(tokenName: keyof M3MotionDuration): string {
  return M3_MOTION_DURATION[tokenName];
}

/**
 * Gets an easing token value from the default M3 motion tokens
 */
export function getEasingToken(tokenName: keyof M3MotionEasing): string {
  return M3_MOTION_EASING[tokenName];
}

/**
 * Creates custom duration tokens by merging overrides with defaults
 */
export function createDurationTokens(overrides: Partial<M3MotionDuration> = {}): M3MotionDuration {
  return {
    ...M3_MOTION_DURATION,
    ...overrides,
  };
}

/**
 * Creates custom easing tokens by merging overrides with defaults
 */
export function createEasingTokens(overrides: Partial<M3MotionEasing> = {}): M3MotionEasing {
  return {
    ...M3_MOTION_EASING,
    ...overrides,
  };
}

/**
 * Creates custom motion tokens by merging overrides with defaults
 */
export function createMotionTokens(overrides: Partial<M3Motion> = {}): M3Motion {
  return {
    duration: createDurationTokens(overrides.duration),
    easing: createEasingTokens(overrides.easing),
  };
}

/**
 * Converts motion tokens to CSS custom properties object
 */
export function motionTokensToCssVars(motion: M3Motion = M3_MOTION): Record<string, string> {
  const cssVars: Record<string, string> = {};
  
  // Duration tokens
  cssVars['--md-sys-motion-duration-short1'] = motion.duration.short1;
  cssVars['--md-sys-motion-duration-short2'] = motion.duration.short2;
  cssVars['--md-sys-motion-duration-short3'] = motion.duration.short3;
  cssVars['--md-sys-motion-duration-short4'] = motion.duration.short4;
  cssVars['--md-sys-motion-duration-medium1'] = motion.duration.medium1;
  cssVars['--md-sys-motion-duration-medium2'] = motion.duration.medium2;
  cssVars['--md-sys-motion-duration-medium3'] = motion.duration.medium3;
  cssVars['--md-sys-motion-duration-medium4'] = motion.duration.medium4;
  cssVars['--md-sys-motion-duration-long1'] = motion.duration.long1;
  cssVars['--md-sys-motion-duration-long2'] = motion.duration.long2;
  cssVars['--md-sys-motion-duration-long3'] = motion.duration.long3;
  cssVars['--md-sys-motion-duration-long4'] = motion.duration.long4;
  cssVars['--md-sys-motion-duration-extra-long1'] = motion.duration.extraLong1;
  cssVars['--md-sys-motion-duration-extra-long2'] = motion.duration.extraLong2;
  cssVars['--md-sys-motion-duration-extra-long3'] = motion.duration.extraLong3;
  cssVars['--md-sys-motion-duration-extra-long4'] = motion.duration.extraLong4;
  
  // Easing tokens
  cssVars['--md-sys-motion-easing-standard'] = motion.easing.standard;
  cssVars['--md-sys-motion-easing-standard-decelerate'] = motion.easing.standardDecelerate;
  cssVars['--md-sys-motion-easing-standard-accelerate'] = motion.easing.standardAccelerate;
  cssVars['--md-sys-motion-easing-emphasized'] = motion.easing.emphasized;
  cssVars['--md-sys-motion-easing-emphasized-decelerate'] = motion.easing.emphasizedDecelerate;
  cssVars['--md-sys-motion-easing-emphasized-accelerate'] = motion.easing.emphasizedAccelerate;
  
  return cssVars;
}

/**
 * Motion token recommendations for common M3 transitions
 * Based on Material Design 3 guidelines
 */
export const M3_TRANSITION_PRESETS = {
  // State changes (hover, focus, pressed)
  stateChange: {
    duration: 'short2',  // 100ms
    easing: 'standard',
  },
  
  // Small element transitions (icons, badges)
  smallElement: {
    duration: 'short4',  // 200ms
    easing: 'standard',
  },
  
  // Standard transitions (buttons, cards)
  standard: {
    duration: 'medium2', // 300ms
    easing: 'standard',
  },
  
  // Emphasized transitions (dialogs, navigation)
  emphasized: {
    duration: 'long2',   // 500ms
    easing: 'emphasized',
  },
  
  // Enter transitions
  enter: {
    duration: 'medium4', // 400ms
    easing: 'emphasizedDecelerate',
  },
  
  // Exit transitions
  exit: {
    duration: 'short4',  // 200ms
    easing: 'emphasizedAccelerate',
  },
  
  // Tab indicator animation
  tabIndicator: {
    duration: 'medium2', // 300ms
    easing: 'emphasized',
  },
  
  // Theme toggle animation
  themeToggle: {
    duration: 'medium2', // 300ms
    easing: 'standard',
  },
} as const;

/**
 * Gets a transition preset with resolved duration and easing values
 */
export function getTransitionPreset(preset: keyof typeof M3_TRANSITION_PRESETS): {
  duration: string;
  easing: string;
} {
  const config = M3_TRANSITION_PRESETS[preset];
  return {
    duration: M3_MOTION_DURATION[config.duration as keyof M3MotionDuration],
    easing: M3_MOTION_EASING[config.easing as keyof M3MotionEasing],
  };
}

/**
 * Creates a CSS transition string from a preset
 */
export function createTransitionString(
  property: string,
  preset: keyof typeof M3_TRANSITION_PRESETS
): string {
  const { duration, easing } = getTransitionPreset(preset);
  return `${property} ${duration} ${easing}`;
}

/**
 * Reduced motion support utilities
 * Requirements: 12.4
 */

/**
 * Gets duration value adjusted for reduced motion preference
 * Returns '0ms' if reduced motion is preferred
 */
export function getReducedMotionDuration(
  duration: string,
  prefersReducedMotion: boolean
): string {
  return prefersReducedMotion ? '0ms' : duration;
}

/**
 * Gets a transition preset adjusted for reduced motion preference
 * Returns instant transition if reduced motion is preferred
 */
export function getReducedMotionTransitionPreset(
  preset: keyof typeof M3_TRANSITION_PRESETS,
  prefersReducedMotion: boolean
): { duration: string; easing: string } {
  if (prefersReducedMotion) {
    return { duration: '0ms', easing: 'linear' };
  }
  return getTransitionPreset(preset);
}

/**
 * Creates a CSS transition string adjusted for reduced motion preference
 */
export function createReducedMotionTransitionString(
  property: string,
  preset: keyof typeof M3_TRANSITION_PRESETS,
  prefersReducedMotion: boolean
): string {
  if (prefersReducedMotion) {
    return 'none';
  }
  return createTransitionString(property, preset);
}

/**
 * Motion tokens for reduced motion mode
 * All durations set to 0ms for instant transitions
 */
export const M3_MOTION_REDUCED: M3Motion = {
  duration: {
    short1: '0ms',
    short2: '0ms',
    short3: '0ms',
    short4: '0ms',
    medium1: '0ms',
    medium2: '0ms',
    medium3: '0ms',
    medium4: '0ms',
    long1: '0ms',
    long2: '0ms',
    long3: '0ms',
    long4: '0ms',
    extraLong1: '0ms',
    extraLong2: '0ms',
    extraLong3: '0ms',
    extraLong4: '0ms',
  },
  easing: {
    standard: 'linear',
    standardDecelerate: 'linear',
    standardAccelerate: 'linear',
    emphasized: 'linear',
    emphasizedDecelerate: 'linear',
    emphasizedAccelerate: 'linear',
  },
};

/**
 * Gets motion tokens based on reduced motion preference
 */
export function getMotionTokens(prefersReducedMotion: boolean): M3Motion {
  return prefersReducedMotion ? M3_MOTION_REDUCED : M3_MOTION;
}
