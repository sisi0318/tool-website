/**
 * Material You 3 Color Token System
 * 
 * This module provides the M3 color scheme interface and a seed color generator
 * that produces a complete M3 color palette from a single seed color.
 * It also includes state layer utilities for interactive element states.
 */

/**
 * Complete M3 Color Scheme interface containing all color roles
 */
export interface M3ColorScheme {
  // Primary colors
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;

  // Secondary colors
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;

  // Tertiary colors
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;

  // Error colors
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;

  // Surface colors
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  surfaceDim: string;
  surfaceBright: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;

  // Other colors
  outline: string;
  outlineVariant: string;
  shadow: string;
  scrim: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
}

/**
 * M3 State Layer types for interactive elements
 */
export type M3StateType = 'hover' | 'focus' | 'pressed' | 'dragged';

/**
 * M3 State Layer opacity values as per Material Design 3 specification
 * - hover: 8% opacity
 * - focus: 12% opacity
 * - pressed: 12% opacity
 * - dragged: 16% opacity
 */
export const M3_STATE_LAYER_OPACITY: Record<M3StateType, number> = {
  hover: 0.08,
  focus: 0.12,
  pressed: 0.12,
  dragged: 0.16,
} as const;

/**
 * All required color keys in an M3 color scheme
 */
export const M3_COLOR_KEYS: (keyof M3ColorScheme)[] = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'error', 'onError', 'errorContainer', 'onErrorContainer',
  'surface', 'onSurface', 'surfaceVariant', 'onSurfaceVariant',
  'surfaceDim', 'surfaceBright',
  'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer',
  'surfaceContainerHigh', 'surfaceContainerHighest',
  'outline', 'outlineVariant', 'shadow', 'scrim',
  'inverseSurface', 'inverseOnSurface', 'inversePrimary'
];


/**
 * Validates if a string is a valid hex color
 */
export function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Converts hex color to RGB values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
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
 * Converts RGB values to hex color
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    return clamped.toString(16).padStart(2, '0');
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Converts RGB to HSL
 */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Converts HSL to RGB
 */
export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360;
  s /= 100;
  l /= 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Generates a tonal palette from a base color
 * Returns colors at different tone levels (0-100)
 * Extended tone values for M3 surface containers
 */
function generateTonalPalette(baseHex: string): Record<number, string> {
  const rgb = hexToRgb(baseHex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  
  const tones: Record<number, string> = {};
  // Extended tone values for M3 surface containers
  const toneValues = [0, 4, 6, 10, 12, 17, 20, 22, 24, 30, 40, 50, 60, 70, 80, 87, 90, 92, 94, 95, 96, 98, 99, 100];
  
  for (const tone of toneValues) {
    const { r, g, b } = hslToRgb(hsl.h, hsl.s, tone);
    tones[tone] = rgbToHex(r, g, b);
  }
  
  return tones;
}

/**
 * Shifts hue by a given amount (in degrees)
 */
function shiftHue(hex: string, degrees: number): string {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const newHue = (hsl.h + degrees + 360) % 360;
  const { r, g, b } = hslToRgb(newHue, hsl.s, hsl.l);
  return rgbToHex(r, g, b);
}


/**
 * Generates a complete M3 color scheme from a seed color
 * 
 * @param seedColor - A valid hex color string (e.g., "#6750A4")
 * @returns A complete M3ColorScheme object with all color roles
 * @throws Error if seedColor is not a valid hex color
 */
export function generateColorScheme(seedColor: string): M3ColorScheme {
  if (!isValidHexColor(seedColor)) {
    throw new Error(`Invalid seed color: ${seedColor}. Must be a valid hex color (e.g., "#6750A4")`);
  }

  // Generate tonal palettes for each color role
  const primaryPalette = generateTonalPalette(seedColor);
  const secondaryPalette = generateTonalPalette(shiftHue(seedColor, 30));
  const tertiaryPalette = generateTonalPalette(shiftHue(seedColor, 60));
  const errorPalette = generateTonalPalette('#B3261E'); // M3 standard error color
  const neutralPalette = generateTonalPalette(desaturate(seedColor, 0.9));
  const neutralVariantPalette = generateTonalPalette(desaturate(seedColor, 0.7));

  return {
    // Primary colors
    primary: primaryPalette[40],
    onPrimary: primaryPalette[100],
    primaryContainer: primaryPalette[90],
    onPrimaryContainer: primaryPalette[10],

    // Secondary colors
    secondary: secondaryPalette[40],
    onSecondary: secondaryPalette[100],
    secondaryContainer: secondaryPalette[90],
    onSecondaryContainer: secondaryPalette[10],

    // Tertiary colors
    tertiary: tertiaryPalette[40],
    onTertiary: tertiaryPalette[100],
    tertiaryContainer: tertiaryPalette[90],
    onTertiaryContainer: tertiaryPalette[10],

    // Error colors
    error: errorPalette[40],
    onError: errorPalette[100],
    errorContainer: errorPalette[90],
    onErrorContainer: errorPalette[10],

    // Surface colors
    surface: neutralPalette[99],
    onSurface: neutralPalette[10],
    surfaceVariant: neutralVariantPalette[90],
    onSurfaceVariant: neutralVariantPalette[30],
    surfaceDim: neutralPalette[87],
    surfaceBright: neutralPalette[98],
    surfaceContainerLowest: neutralPalette[100],
    surfaceContainerLow: neutralPalette[96],
    surfaceContainer: neutralPalette[94],
    surfaceContainerHigh: neutralPalette[92],
    surfaceContainerHighest: neutralPalette[90],

    // Other colors
    outline: neutralVariantPalette[50],
    outlineVariant: neutralVariantPalette[80],
    shadow: '#000000',
    scrim: '#000000',
    inverseSurface: neutralPalette[20],
    inverseOnSurface: neutralPalette[95],
    inversePrimary: primaryPalette[80],
  };
}

/**
 * Desaturates a color by a given factor (0-1)
 */
function desaturate(hex: string, factor: number): string {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const newSaturation = hsl.s * (1 - factor);
  const { r, g, b } = hslToRgb(hsl.h, newSaturation, hsl.l);
  return rgbToHex(r, g, b);
}

/**
 * Generates a dark mode M3 color scheme from a seed color
 * 
 * @param seedColor - A valid hex color string (e.g., "#6750A4")
 * @returns A complete M3ColorScheme object with dark mode color roles
 * @throws Error if seedColor is not a valid hex color
 */
export function generateDarkColorScheme(seedColor: string): M3ColorScheme {
  if (!isValidHexColor(seedColor)) {
    throw new Error(`Invalid seed color: ${seedColor}. Must be a valid hex color (e.g., "#6750A4")`);
  }

  // Generate tonal palettes for each color role
  const primaryPalette = generateTonalPalette(seedColor);
  const secondaryPalette = generateTonalPalette(shiftHue(seedColor, 30));
  const tertiaryPalette = generateTonalPalette(shiftHue(seedColor, 60));
  const errorPalette = generateTonalPalette('#B3261E');
  const neutralPalette = generateTonalPalette(desaturate(seedColor, 0.9));
  const neutralVariantPalette = generateTonalPalette(desaturate(seedColor, 0.7));

  return {
    // Primary colors (inverted tones for dark mode)
    primary: primaryPalette[80],
    onPrimary: primaryPalette[20],
    primaryContainer: primaryPalette[30],
    onPrimaryContainer: primaryPalette[90],

    // Secondary colors
    secondary: secondaryPalette[80],
    onSecondary: secondaryPalette[20],
    secondaryContainer: secondaryPalette[30],
    onSecondaryContainer: secondaryPalette[90],

    // Tertiary colors
    tertiary: tertiaryPalette[80],
    onTertiary: tertiaryPalette[20],
    tertiaryContainer: tertiaryPalette[30],
    onTertiaryContainer: tertiaryPalette[90],

    // Error colors
    error: errorPalette[80],
    onError: errorPalette[20],
    errorContainer: errorPalette[30],
    onErrorContainer: errorPalette[90],

    // Surface colors (dark mode uses tonal elevation)
    surface: neutralPalette[10],
    onSurface: neutralPalette[90],
    surfaceVariant: neutralVariantPalette[30],
    onSurfaceVariant: neutralVariantPalette[80],
    surfaceDim: neutralPalette[6],
    surfaceBright: neutralPalette[24],
    surfaceContainerLowest: neutralPalette[4],
    surfaceContainerLow: neutralPalette[10],
    surfaceContainer: neutralPalette[12],
    surfaceContainerHigh: neutralPalette[17],
    surfaceContainerHighest: neutralPalette[22],

    // Other colors
    outline: neutralVariantPalette[60],
    outlineVariant: neutralVariantPalette[30],
    shadow: '#000000',
    scrim: '#000000',
    inverseSurface: neutralPalette[90],
    inverseOnSurface: neutralPalette[20],
    inversePrimary: primaryPalette[40],
  };
}



/**
 * Gets the state layer opacity for a given state type
 * 
 * @param state - The state type (hover, focus, pressed, dragged)
 * @returns The opacity value for the state layer
 */
export function getStateLayerOpacity(state: M3StateType): number {
  return M3_STATE_LAYER_OPACITY[state];
}

/**
 * Applies a state layer color overlay to a base color
 * State layers are semi-transparent overlays that indicate interactive states
 * 
 * @param baseColor - The base color in hex format (e.g., "#FFFFFF")
 * @param stateColor - The state layer color in hex format (typically the content color)
 * @param state - The state type (hover, focus, pressed, dragged)
 * @returns The resulting color after applying the state layer as a hex string
 * @throws Error if either color is not a valid hex color
 */
export function applyStateLayer(
  baseColor: string,
  stateColor: string,
  state: M3StateType
): string {
  if (!isValidHexColor(baseColor)) {
    throw new Error(`Invalid base color: ${baseColor}`);
  }
  if (!isValidHexColor(stateColor)) {
    throw new Error(`Invalid state color: ${stateColor}`);
  }

  const opacity = M3_STATE_LAYER_OPACITY[state];
  return blendColors(baseColor, stateColor, opacity);
}

/**
 * Applies a state layer with a custom opacity value
 * 
 * @param baseColor - The base color in hex format
 * @param stateColor - The state layer color in hex format
 * @param opacity - The opacity value (0-1)
 * @returns The resulting color after applying the state layer as a hex string
 */
export function applyStateLayerWithOpacity(
  baseColor: string,
  stateColor: string,
  opacity: number
): string {
  if (!isValidHexColor(baseColor)) {
    throw new Error(`Invalid base color: ${baseColor}`);
  }
  if (!isValidHexColor(stateColor)) {
    throw new Error(`Invalid state color: ${stateColor}`);
  }
  if (opacity < 0 || opacity > 1) {
    throw new Error(`Invalid opacity: ${opacity}. Must be between 0 and 1`);
  }

  return blendColors(baseColor, stateColor, opacity);
}

/**
 * Blends two colors together with a given opacity
 * Uses the standard alpha compositing formula: result = base * (1 - alpha) + overlay * alpha
 * 
 * @param baseHex - The base color in hex format
 * @param overlayHex - The overlay color in hex format
 * @param alpha - The opacity of the overlay (0-1)
 * @returns The blended color as a hex string
 */
function blendColors(baseHex: string, overlayHex: string, alpha: number): string {
  const base = hexToRgb(baseHex);
  const overlay = hexToRgb(overlayHex);

  const r = Math.round(base.r * (1 - alpha) + overlay.r * alpha);
  const g = Math.round(base.g * (1 - alpha) + overlay.g * alpha);
  const b = Math.round(base.b * (1 - alpha) + overlay.b * alpha);

  return rgbToHex(r, g, b);
}

/**
 * Generates a CSS rgba string for a state layer
 * Useful for applying state layers via CSS
 * 
 * @param stateColor - The state layer color in hex format
 * @param state - The state type (hover, focus, pressed, dragged)
 * @returns A CSS rgba string (e.g., "rgba(103, 80, 164, 0.08)")
 */
export function getStateLayerRgba(stateColor: string, state: M3StateType): string {
  if (!isValidHexColor(stateColor)) {
    throw new Error(`Invalid state color: ${stateColor}`);
  }

  const rgb = hexToRgb(stateColor);
  const opacity = M3_STATE_LAYER_OPACITY[state];
  
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}
