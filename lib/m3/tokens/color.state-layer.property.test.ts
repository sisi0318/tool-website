/**
 * **Feature: material-you-3-expressive-redesign, Property 2: State Layer Opacity Consistency**
 * **Validates: Requirements 1.4**
 *
 * Property: For any interactive element state (hover, focus, pressed, dragged),
 * the state layer opacity SHALL match the M3 specification values:
 * hover=0.08, focus=0.12, pressed=0.12, dragged=0.16.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  M3_STATE_LAYER_OPACITY,
  M3StateType,
  getStateLayerOpacity,
  applyStateLayer,
  isValidHexColor,
} from './color';

// Configure fast-check to run minimum 100 iterations
fc.configureGlobal({ numRuns: 100 });

/**
 * M3 specification values for state layer opacity
 */
const M3_SPEC_OPACITY: Record<M3StateType, number> = {
  hover: 0.08,
  focus: 0.12,
  pressed: 0.12,
  dragged: 0.16,
};

/**
 * All valid M3 state types
 */
const ALL_STATE_TYPES: M3StateType[] = ['hover', 'focus', 'pressed', 'dragged'];

/**
 * Arbitrary for generating valid M3 state types
 */
const stateTypeArb = fc.constantFrom<M3StateType>(...ALL_STATE_TYPES);

/**
 * Arbitrary for generating valid hex colors
 */
const validHexColorArb = fc
  .tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  )
  .map(([r, g, b]) => {
    const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  });

describe('Property 2: State Layer Opacity Consistency', () => {
  it('should return M3 specification opacity values for any state type', () => {
    fc.assert(
      fc.property(stateTypeArb, (state) => {
        const opacity = getStateLayerOpacity(state);
        expect(opacity).toBe(M3_SPEC_OPACITY[state]);
      })
    );
  });

  it('should have hover state opacity equal to 0.08', () => {
    expect(M3_STATE_LAYER_OPACITY.hover).toBe(0.08);
    expect(getStateLayerOpacity('hover')).toBe(0.08);
  });

  it('should have focus state opacity equal to 0.12', () => {
    expect(M3_STATE_LAYER_OPACITY.focus).toBe(0.12);
    expect(getStateLayerOpacity('focus')).toBe(0.12);
  });

  it('should have pressed state opacity equal to 0.12', () => {
    expect(M3_STATE_LAYER_OPACITY.pressed).toBe(0.12);
    expect(getStateLayerOpacity('pressed')).toBe(0.12);
  });

  it('should have dragged state opacity equal to 0.16', () => {
    expect(M3_STATE_LAYER_OPACITY.dragged).toBe(0.16);
    expect(getStateLayerOpacity('dragged')).toBe(0.16);
  });

  it('should apply state layer and produce valid hex color for any base color, state color, and state type', () => {
    fc.assert(
      fc.property(
        validHexColorArb,
        validHexColorArb,
        stateTypeArb,
        (baseColor, stateColor, state) => {
          const result = applyStateLayer(baseColor, stateColor, state);
          expect(isValidHexColor(result)).toBe(true);
        }
      )
    );
  });

  it('should have exactly 4 state types defined', () => {
    expect(Object.keys(M3_STATE_LAYER_OPACITY).length).toBe(4);
  });

  it('should have all opacity values between 0 and 1', () => {
    fc.assert(
      fc.property(stateTypeArb, (state) => {
        const opacity = getStateLayerOpacity(state);
        expect(opacity).toBeGreaterThanOrEqual(0);
        expect(opacity).toBeLessThanOrEqual(1);
      })
    );
  });
});
