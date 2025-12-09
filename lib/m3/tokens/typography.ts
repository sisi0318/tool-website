/**
 * Material You 3 Typography Token System
 * 
 * This module provides the M3 typography scale interface and definitions
 * for all 15 typography styles from display-large to label-small.
 * Configured with Google Sans / Roboto font family as per M3 specifications.
 */

/**
 * Individual typography style definition
 */
export interface TypographyStyle {
  fontFamily: string;
  fontSize: string;
  fontWeight: number;
  lineHeight: string;
  letterSpacing: string;
}

/**
 * Complete M3 Type Scale interface containing all 15 typography styles
 */
export interface M3TypeScale {
  displayLarge: TypographyStyle;
  displayMedium: TypographyStyle;
  displaySmall: TypographyStyle;
  headlineLarge: TypographyStyle;
  headlineMedium: TypographyStyle;
  headlineSmall: TypographyStyle;
  titleLarge: TypographyStyle;
  titleMedium: TypographyStyle;
  titleSmall: TypographyStyle;
  bodyLarge: TypographyStyle;
  bodyMedium: TypographyStyle;
  bodySmall: TypographyStyle;
  labelLarge: TypographyStyle;
  labelMedium: TypographyStyle;
  labelSmall: TypographyStyle;
}

/**
 * All required typography style keys in an M3 type scale
 */
export const M3_TYPOGRAPHY_KEYS: (keyof M3TypeScale)[] = [
  'displayLarge',
  'displayMedium',
  'displaySmall',
  'headlineLarge',
  'headlineMedium',
  'headlineSmall',
  'titleLarge',
  'titleMedium',
  'titleSmall',
  'bodyLarge',
  'bodyMedium',
  'bodySmall',
  'labelLarge',
  'labelMedium',
  'labelSmall',
];


/**
 * M3 Font Family definitions
 * Google Sans is the primary typeface, with Roboto as fallback
 */
export const M3_FONT_FAMILY = {
  brand: "'Google Sans', 'Roboto', sans-serif",
  plain: "'Roboto', sans-serif",
} as const;

/**
 * Default M3 Type Scale with all 15 typography styles
 * Based on Material Design 3 specifications
 */
export const M3_TYPE_SCALE: M3TypeScale = {
  // Display styles - for large, short text
  displayLarge: {
    fontFamily: M3_FONT_FAMILY.brand,
    fontSize: '57px',
    fontWeight: 400,
    lineHeight: '64px',
    letterSpacing: '-0.25px',
  },
  displayMedium: {
    fontFamily: M3_FONT_FAMILY.brand,
    fontSize: '45px',
    fontWeight: 400,
    lineHeight: '52px',
    letterSpacing: '0px',
  },
  displaySmall: {
    fontFamily: M3_FONT_FAMILY.brand,
    fontSize: '36px',
    fontWeight: 400,
    lineHeight: '44px',
    letterSpacing: '0px',
  },

  // Headline styles - for high-emphasis text
  headlineLarge: {
    fontFamily: M3_FONT_FAMILY.brand,
    fontSize: '32px',
    fontWeight: 400,
    lineHeight: '40px',
    letterSpacing: '0px',
  },
  headlineMedium: {
    fontFamily: M3_FONT_FAMILY.brand,
    fontSize: '28px',
    fontWeight: 400,
    lineHeight: '36px',
    letterSpacing: '0px',
  },
  headlineSmall: {
    fontFamily: M3_FONT_FAMILY.brand,
    fontSize: '24px',
    fontWeight: 400,
    lineHeight: '32px',
    letterSpacing: '0px',
  },

  // Title styles - for medium-emphasis text
  titleLarge: {
    fontFamily: M3_FONT_FAMILY.brand,
    fontSize: '22px',
    fontWeight: 400,
    lineHeight: '28px',
    letterSpacing: '0px',
  },
  titleMedium: {
    fontFamily: M3_FONT_FAMILY.plain,
    fontSize: '16px',
    fontWeight: 500,
    lineHeight: '24px',
    letterSpacing: '0.15px',
  },
  titleSmall: {
    fontFamily: M3_FONT_FAMILY.plain,
    fontSize: '14px',
    fontWeight: 500,
    lineHeight: '20px',
    letterSpacing: '0.1px',
  },

  // Body styles - for longer passages of text
  bodyLarge: {
    fontFamily: M3_FONT_FAMILY.plain,
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: '24px',
    letterSpacing: '0.5px',
  },
  bodyMedium: {
    fontFamily: M3_FONT_FAMILY.plain,
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: '20px',
    letterSpacing: '0.25px',
  },
  bodySmall: {
    fontFamily: M3_FONT_FAMILY.plain,
    fontSize: '12px',
    fontWeight: 400,
    lineHeight: '16px',
    letterSpacing: '0.4px',
  },

  // Label styles - for small text in components
  labelLarge: {
    fontFamily: M3_FONT_FAMILY.plain,
    fontSize: '14px',
    fontWeight: 500,
    lineHeight: '20px',
    letterSpacing: '0.1px',
  },
  labelMedium: {
    fontFamily: M3_FONT_FAMILY.plain,
    fontSize: '12px',
    fontWeight: 500,
    lineHeight: '16px',
    letterSpacing: '0.5px',
  },
  labelSmall: {
    fontFamily: M3_FONT_FAMILY.plain,
    fontSize: '11px',
    fontWeight: 500,
    lineHeight: '16px',
    letterSpacing: '0.5px',
  },
};

/**
 * Validates if a typography style has all required properties with valid values
 */
export function isValidTypographyStyle(style: TypographyStyle): boolean {
  if (!style) return false;
  
  const hasFontFamily = typeof style.fontFamily === 'string' && style.fontFamily.length > 0;
  const hasFontSize = typeof style.fontSize === 'string' && /^\d+(\.\d+)?(px|rem|em)$/.test(style.fontSize);
  const hasFontWeight = typeof style.fontWeight === 'number' && style.fontWeight >= 100 && style.fontWeight <= 900;
  const hasLineHeight = typeof style.lineHeight === 'string' && /^\d+(\.\d+)?(px|rem|em|%)$/.test(style.lineHeight);
  const hasLetterSpacing = typeof style.letterSpacing === 'string' && /^-?\d+(\.\d+)?(px|rem|em)$/.test(style.letterSpacing);
  
  return hasFontFamily && hasFontSize && hasFontWeight && hasLineHeight && hasLetterSpacing;
}

/**
 * Validates if a type scale has all 15 required typography styles with valid values
 */
export function isValidTypeScale(typeScale: M3TypeScale): boolean {
  if (!typeScale) return false;
  
  return M3_TYPOGRAPHY_KEYS.every(key => {
    const style = typeScale[key];
    return style && isValidTypographyStyle(style);
  });
}

/**
 * Gets a typography style from the default M3 type scale
 */
export function getTypographyStyle(styleName: keyof M3TypeScale): TypographyStyle {
  return M3_TYPE_SCALE[styleName];
}

/**
 * Creates a custom type scale by merging overrides with the default M3 type scale
 */
export function createTypeScale(overrides: Partial<M3TypeScale> = {}): M3TypeScale {
  return {
    ...M3_TYPE_SCALE,
    ...overrides,
  };
}

/**
 * Converts a typography style to CSS properties object
 */
export function typographyStyleToCss(style: TypographyStyle): Record<string, string> {
  return {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: String(style.fontWeight),
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
  };
}


// ============================================================================
// Contrast Ratio Utilities for WCAG Compliance
// ============================================================================

/**
 * Converts a hex color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Validates if a string is a valid hex color
 */
export function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Calculates the relative luminance of a color
 * Based on WCAG 2.1 formula: https://www.w3.org/WAI/GL/wiki/Relative_luminance
 * 
 * @param hex - A valid hex color string (e.g., "#FFFFFF")
 * @returns The relative luminance value (0-1)
 */
export function calculateRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  
  // Convert to sRGB
  const rsRGB = r / 255;
  const gsRGB = g / 255;
  const bsRGB = b / 255;
  
  // Apply gamma correction
  const rLinear = rsRGB <= 0.03928 
    ? rsRGB / 12.92 
    : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const gLinear = gsRGB <= 0.03928 
    ? gsRGB / 12.92 
    : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const bLinear = bsRGB <= 0.03928 
    ? bsRGB / 12.92 
    : Math.pow((bsRGB + 0.055) / 1.055, 2.4);
  
  // Calculate luminance using ITU-R BT.709 coefficients
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Calculates the contrast ratio between two colors
 * Based on WCAG 2.1 formula: https://www.w3.org/WAI/GL/wiki/Contrast_ratio
 * 
 * @param foreground - The foreground (text) color in hex format
 * @param background - The background color in hex format
 * @returns The contrast ratio (1-21)
 * @throws Error if either color is not a valid hex color
 */
export function calculateContrastRatio(foreground: string, background: string): number {
  if (!isValidHexColor(foreground)) {
    throw new Error(`Invalid foreground color: ${foreground}`);
  }
  if (!isValidHexColor(background)) {
    throw new Error(`Invalid background color: ${background}`);
  }
  
  const luminance1 = calculateRelativeLuminance(foreground);
  const luminance2 = calculateRelativeLuminance(background);
  
  // Ensure lighter color is in numerator
  const lighter = Math.max(luminance1, luminance2);
  const darker = Math.min(luminance1, luminance2);
  
  // WCAG contrast ratio formula: (L1 + 0.05) / (L2 + 0.05)
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * WCAG 2.1 AA minimum contrast ratios
 */
export const WCAG_AA_CONTRAST = {
  normalText: 4.5,  // Minimum for normal text (< 18px or < 14px bold)
  largeText: 3.0,   // Minimum for large text (>= 18px or >= 14px bold)
} as const;

/**
 * WCAG 2.1 AAA minimum contrast ratios (enhanced)
 */
export const WCAG_AAA_CONTRAST = {
  normalText: 7.0,  // Enhanced minimum for normal text
  largeText: 4.5,   // Enhanced minimum for large text
} as const;

/**
 * Checks if a contrast ratio meets WCAG 2.1 AA standards
 * 
 * @param ratio - The contrast ratio to check
 * @param isLargeText - Whether the text is considered "large" (>= 18px or >= 14px bold)
 * @returns True if the ratio meets WCAG AA standards
 */
export function meetsWCAGAA(ratio: number, isLargeText: boolean = false): boolean {
  const minimumRatio = isLargeText ? WCAG_AA_CONTRAST.largeText : WCAG_AA_CONTRAST.normalText;
  return ratio >= minimumRatio;
}

/**
 * Checks if a contrast ratio meets WCAG 2.1 AAA standards (enhanced)
 * 
 * @param ratio - The contrast ratio to check
 * @param isLargeText - Whether the text is considered "large" (>= 18px or >= 14px bold)
 * @returns True if the ratio meets WCAG AAA standards
 */
export function meetsWCAGAAA(ratio: number, isLargeText: boolean = false): boolean {
  const minimumRatio = isLargeText ? WCAG_AAA_CONTRAST.largeText : WCAG_AAA_CONTRAST.normalText;
  return ratio >= minimumRatio;
}

/**
 * Determines if text is considered "large" for WCAG purposes
 * Large text is defined as >= 18px (or >= 14px if bold)
 * 
 * @param fontSize - The font size in pixels
 * @param fontWeight - The font weight (bold is >= 700)
 * @returns True if the text is considered large
 */
export function isLargeText(fontSize: number, fontWeight: number = 400): boolean {
  const isBold = fontWeight >= 700;
  return fontSize >= 18 || (isBold && fontSize >= 14);
}

/**
 * Checks if a foreground/background color combination meets WCAG AA standards
 * 
 * @param foreground - The foreground (text) color in hex format
 * @param background - The background color in hex format
 * @param isLargeText - Whether the text is considered "large"
 * @returns True if the combination meets WCAG AA standards
 */
export function checkColorContrastAA(
  foreground: string, 
  background: string, 
  isLargeText: boolean = false
): boolean {
  const ratio = calculateContrastRatio(foreground, background);
  return meetsWCAGAA(ratio, isLargeText);
}

/**
 * Gets the WCAG compliance level for a contrast ratio
 * 
 * @param ratio - The contrast ratio to check
 * @param isLargeText - Whether the text is considered "large"
 * @returns The compliance level: 'AAA', 'AA', or 'fail'
 */
export function getWCAGComplianceLevel(
  ratio: number, 
  isLargeText: boolean = false
): 'AAA' | 'AA' | 'fail' {
  if (meetsWCAGAAA(ratio, isLargeText)) {
    return 'AAA';
  }
  if (meetsWCAGAA(ratio, isLargeText)) {
    return 'AA';
  }
  return 'fail';
}
