/**
 * Material You 3 Expressive Design System
 * 
 * Main entry point for M3 design tokens and theme utilities.
 */

// Theme exports
export * from './theme';

// Color token exports
export {
  type M3ColorScheme,
  type M3StateType,
  M3_STATE_LAYER_OPACITY,
  M3_COLOR_KEYS,
  isValidHexColor,
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  generateColorScheme,
  generateDarkColorScheme,
  getStateLayerOpacity,
  applyStateLayer,
  applyStateLayerWithOpacity,
  getStateLayerRgba,
} from './tokens/color';

// Typography token exports
export {
  type TypographyStyle,
  type M3TypeScale,
  M3_TYPOGRAPHY_KEYS,
  M3_FONT_FAMILY,
  M3_TYPE_SCALE,
  isValidTypographyStyle,
  isValidTypeScale,
  getTypographyStyle,
  createTypeScale,
  typographyStyleToCss,
  calculateRelativeLuminance,
  calculateContrastRatio,
  WCAG_AA_CONTRAST,
  WCAG_AAA_CONTRAST,
  meetsWCAGAA,
  meetsWCAGAAA,
  isLargeText,
  checkColorContrastAA,
  getWCAGComplianceLevel,
} from './tokens/typography';

// Shape token exports
export * from './tokens/shape';

// Motion token exports
export * from './tokens/motion';

// Performance utilities exports
export * from './performance';
