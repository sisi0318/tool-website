/**
 * Material You 3 Expressive Shape Token System
 * 
 * This module provides the M3 Expressive shape tokens interface and definitions
 * for corner radius values used throughout the design system.
 * M3 Expressive uses larger corner radii compared to standard M3 for a more
 * friendly and modern appearance.
 */

/**
 * M3 Expressive Shape tokens interface
 * Defines corner radius values for different component sizes
 */
export interface M3ExpressiveShape {
  /** Extra small corner radius - 4px */
  extraSmall: string;
  /** Small corner radius - 8px */
  small: string;
  /** Medium corner radius - 16px */
  medium: string;
  /** Large corner radius - 24px */
  large: string;
  /** Extra large corner radius - 28px */
  extraLarge: string;
  /** Full/pill shape - 9999px */
  full: string;
}

/**
 * All required shape token keys in an M3 Expressive shape system
 */
export const M3_SHAPE_KEYS: (keyof M3ExpressiveShape)[] = [
  'extraSmall',
  'small',
  'medium',
  'large',
  'extraLarge',
  'full',
];

/**
 * M3 Expressive shape token values in pixels (numeric)
 * Used for validation and calculations
 */
export const M3_SHAPE_VALUES_PX: Record<keyof M3ExpressiveShape, number> = {
  extraSmall: 4,
  small: 8,
  medium: 16,
  large: 24,
  extraLarge: 28,
  full: 9999,
} as const;

/**
 * Default M3 Expressive Shape tokens
 * Based on Material Design 3 Expressive specifications
 */
export const M3_EXPRESSIVE_SHAPE: M3ExpressiveShape = {
  extraSmall: '4px',
  small: '8px',
  medium: '16px',
  large: '24px',
  extraLarge: '28px',
  full: '9999px',
};

/**
 * Validates if a string is a valid CSS border-radius value in px format
 */
export function isValidShapeValue(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  return /^\d+(\.\d+)?px$/.test(value);
}

/**
 * Parses a shape value string to its numeric pixel value
 * @param value - A shape value string (e.g., "16px")
 * @returns The numeric pixel value or null if invalid
 */
export function parseShapeValue(value: string): number | null {
  if (!isValidShapeValue(value)) return null;
  return parseFloat(value.replace('px', ''));
}

/**
 * Validates if a shape token object has all required keys with valid values
 */
export function isValidShapeTokens(shape: M3ExpressiveShape): boolean {
  if (!shape) return false;
  
  return M3_SHAPE_KEYS.every(key => {
    const value = shape[key];
    if (!isValidShapeValue(value)) return false;
    
    // Verify the value matches the expected M3 specification
    const expectedPx = M3_SHAPE_VALUES_PX[key];
    const actualPx = parseShapeValue(value);
    return actualPx === expectedPx;
  });
}

/**
 * Validates if a shape value matches the M3 Expressive specification
 * @param key - The shape token key
 * @param value - The shape value to validate
 * @returns True if the value matches the M3 specification
 */
export function isValidM3ShapeValue(key: keyof M3ExpressiveShape, value: string): boolean {
  if (!isValidShapeValue(value)) return false;
  
  const expectedPx = M3_SHAPE_VALUES_PX[key];
  const actualPx = parseShapeValue(value);
  return actualPx === expectedPx;
}

/**
 * Gets a shape token value from the default M3 Expressive shape tokens
 */
export function getShapeToken(tokenName: keyof M3ExpressiveShape): string {
  return M3_EXPRESSIVE_SHAPE[tokenName];
}

/**
 * Creates a custom shape token set by merging overrides with defaults
 * Note: This should only be used for testing or special cases,
 * as M3 Expressive has specific shape values that should be maintained
 */
export function createShapeTokens(overrides: Partial<M3ExpressiveShape> = {}): M3ExpressiveShape {
  return {
    ...M3_EXPRESSIVE_SHAPE,
    ...overrides,
  };
}

/**
 * Converts shape tokens to CSS custom properties object
 */
export function shapeTokensToCssVars(shape: M3ExpressiveShape = M3_EXPRESSIVE_SHAPE): Record<string, string> {
  return {
    '--md-sys-shape-corner-extra-small': shape.extraSmall,
    '--md-sys-shape-corner-small': shape.small,
    '--md-sys-shape-corner-medium': shape.medium,
    '--md-sys-shape-corner-large': shape.large,
    '--md-sys-shape-corner-extra-large': shape.extraLarge,
    '--md-sys-shape-corner-full': shape.full,
  };
}

/**
 * Shape token recommendations for common M3 components
 * Based on Material Design 3 Expressive guidelines
 */
export const M3_COMPONENT_SHAPES = {
  // Buttons
  buttonStandard: 'medium',    // 16px - standard buttons
  buttonFab: 'full',           // pill shape - FABs
  buttonSmall: 'small',        // 8px - small buttons
  
  // Cards
  cardElevated: 'large',       // 24px - elevated cards
  cardFilled: 'large',         // 24px - filled cards
  cardOutlined: 'large',       // 24px - outlined cards
  cardExpressive: 'extraLarge', // 28px - expressive cards
  
  // Inputs
  inputFilled: 'extraSmall',   // 4px top corners only
  inputOutlined: 'extraSmall', // 4px - outlined inputs
  
  // Chips
  chip: 'small',               // 8px - chips
  
  // Dialogs
  dialog: 'extraLarge',        // 28px - dialogs
  
  // Navigation
  navigationIndicator: 'full', // pill shape - nav indicators
  
  // Menus
  menu: 'extraSmall',          // 4px - menus
  
  // Sheets
  bottomSheet: 'extraLarge',   // 28px top corners - bottom sheets
} as const;

/**
 * Gets the recommended shape token for a component type
 */
export function getComponentShape(component: keyof typeof M3_COMPONENT_SHAPES): string {
  const shapeKey = M3_COMPONENT_SHAPES[component] as keyof M3ExpressiveShape;
  return M3_EXPRESSIVE_SHAPE[shapeKey];
}
