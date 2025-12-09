/**
 * **Feature: material-you-3-expressive-redesign, Property 6: Motion Token Validity**
 * **Validates: Requirements 5.1, 5.2**
 * 
 * Property: For any M3 motion duration token, the value SHALL be within the range of 50ms to 1000ms.
 * For any M3 easing token, the value SHALL be a valid CSS cubic-bezier function.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  M3Motion,
  M3MotionDuration,
  M3MotionEasing,
  M3_MOTION,
  M3_MOTION_DURATION,
  M3_MOTION_EASING,
  M3_DURATION_KEYS,
  M3_EASING_KEYS,
  M3_DURATION_VALUES_MS,
  M3_EASING_VALUES,
  isValidDurationValue,
  isValidCubicBezier,
  isValidM3DurationRange,
  isValidDurationTokens,
  isValidEasingTokens,
  isValidMotionTokens,
  parseDurationValue,
  parseCubicBezier,
  getDurationToken,
  getEasingToken,
  createMotionTokens,
  motionTokensToCssVars,
  getTransitionPreset,
  M3_TRANSITION_PRESETS,
} from './motion';

// Configure fast-check to run minimum 100 iterations
fc.configureGlobal({ numRuns: 100 });

/**
 * Arbitrary for generating valid duration token keys
 */
const durationKeyArb = fc.constantFrom(...M3_DURATION_KEYS);

/**
 * Arbitrary for generating valid easing token keys
 */
const easingKeyArb = fc.constantFrom(...M3_EASING_KEYS);

/**
 * Arbitrary for generating valid duration values within M3 range (50-1000ms)
 */
const validDurationArb = fc.integer({ min: 50, max: 1000 }).map(n => `${n}ms`);

/**
 * Arbitrary for generating duration values outside M3 range
 */
const invalidRangeDurationArb = fc.oneof(
  fc.integer({ min: 0, max: 49 }).map(n => `${n}ms`),
  fc.integer({ min: 1001, max: 10000 }).map(n => `${n}ms`)
);

/**
 * Arbitrary for generating invalid duration format values
 */
const invalidFormatDurationArb = fc.oneof(
  fc.constant(''),
  fc.constant('invalid'),
  fc.constant('300'),          // missing ms
  fc.constant('300s'),         // wrong unit
  fc.constant('-300ms'),       // negative value
  fc.constant('ms'),           // missing number
  fc.constant('300 ms'),       // space in value
);

/**
 * Arbitrary for generating valid cubic-bezier values
 * x1 and x2 must be between 0 and 1, y1 and y2 can be any number
 */
const validCubicBezierArb = fc.tuple(
  fc.double({ min: 0, max: 1, noNaN: true }),      // x1
  fc.double({ min: -2, max: 2, noNaN: true }),    // y1
  fc.double({ min: 0, max: 1, noNaN: true }),      // x2
  fc.double({ min: -2, max: 2, noNaN: true })     // y2
).map(([x1, y1, x2, y2]) => 
  `cubic-bezier(${x1.toFixed(2)}, ${y1.toFixed(2)}, ${x2.toFixed(2)}, ${y2.toFixed(2)})`
);

/**
 * Arbitrary for generating invalid cubic-bezier values
 */
const invalidCubicBezierArb = fc.oneof(
  fc.constant(''),
  fc.constant('invalid'),
  fc.constant('ease'),                    // named easing (not cubic-bezier)
  fc.constant('linear'),                  // named easing
  fc.constant('cubic-bezier()'),          // empty params
  fc.constant('cubic-bezier(0.5)'),       // missing params
  fc.constant('cubic-bezier(1.5, 0, 0, 1)'),  // x1 > 1
  fc.constant('cubic-bezier(-0.5, 0, 0, 1)'), // x1 < 0
  fc.constant('cubic-bezier(0, 0, 1.5, 1)'),  // x2 > 1
  fc.constant('cubic-bezier(0, 0, -0.5, 1)'), // x2 < 0
);

describe('Property 6: Motion Token Validity', () => {
  describe('Duration Token Values', () => {
    it('should have all 16 required duration tokens defined', () => {
      expect(M3_DURATION_KEYS.length).toBe(16);
      
      for (const key of M3_DURATION_KEYS) {
        expect(M3_MOTION_DURATION).toHaveProperty(key);
        expect(M3_MOTION_DURATION[key]).toBeDefined();
      }
    });

    it('should have duration values within M3 range (50ms - 1000ms) for all tokens', () => {
      for (const key of M3_DURATION_KEYS) {
        const value = M3_MOTION_DURATION[key];
        const ms = parseDurationValue(value);
        
        expect(ms).not.toBeNull();
        expect(ms).toBeGreaterThanOrEqual(50);
        expect(ms).toBeLessThanOrEqual(1000);
      }
    });

    it('should have correct duration values per M3 specification', () => {
      expect(parseDurationValue(M3_MOTION_DURATION.short1)).toBe(50);
      expect(parseDurationValue(M3_MOTION_DURATION.short2)).toBe(100);
      expect(parseDurationValue(M3_MOTION_DURATION.short3)).toBe(150);
      expect(parseDurationValue(M3_MOTION_DURATION.short4)).toBe(200);
      expect(parseDurationValue(M3_MOTION_DURATION.medium1)).toBe(250);
      expect(parseDurationValue(M3_MOTION_DURATION.medium2)).toBe(300);
      expect(parseDurationValue(M3_MOTION_DURATION.medium3)).toBe(350);
      expect(parseDurationValue(M3_MOTION_DURATION.medium4)).toBe(400);
      expect(parseDurationValue(M3_MOTION_DURATION.long1)).toBe(450);
      expect(parseDurationValue(M3_MOTION_DURATION.long2)).toBe(500);
      expect(parseDurationValue(M3_MOTION_DURATION.long3)).toBe(550);
      expect(parseDurationValue(M3_MOTION_DURATION.long4)).toBe(600);
      expect(parseDurationValue(M3_MOTION_DURATION.extraLong1)).toBe(700);
      expect(parseDurationValue(M3_MOTION_DURATION.extraLong2)).toBe(800);
      expect(parseDurationValue(M3_MOTION_DURATION.extraLong3)).toBe(900);
      expect(parseDurationValue(M3_MOTION_DURATION.extraLong4)).toBe(1000);
    });

    it('should validate all default duration tokens', () => {
      expect(isValidDurationTokens(M3_MOTION_DURATION)).toBe(true);
    });
  });

  describe('Duration Value Validation', () => {
    it('should accept any valid ms value within M3 range', () => {
      fc.assert(
        fc.property(validDurationArb, (duration) => {
          expect(isValidDurationValue(duration)).toBe(true);
          expect(isValidM3DurationRange(duration)).toBe(true);
        })
      );
    });

    it('should reject duration values outside M3 range (50-1000ms)', () => {
      fc.assert(
        fc.property(invalidRangeDurationArb, (duration) => {
          expect(isValidDurationValue(duration)).toBe(true);  // Format is valid
          expect(isValidM3DurationRange(duration)).toBe(false); // Range is invalid
        })
      );
    });

    it('should reject invalid duration format values', () => {
      fc.assert(
        fc.property(invalidFormatDurationArb, (duration) => {
          expect(isValidDurationValue(duration)).toBe(false);
        })
      );
    });

    it('should correctly parse duration values to numeric milliseconds', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }),
          (ms) => {
            const msValue = `${ms}ms`;
            expect(parseDurationValue(msValue)).toBe(ms);
          }
        )
      );
    });

    it('should return null for invalid duration values when parsing', () => {
      fc.assert(
        fc.property(invalidFormatDurationArb, (duration) => {
          expect(parseDurationValue(duration)).toBeNull();
        })
      );
    });
  });

  describe('Easing Token Values', () => {
    it('should have all 6 required easing tokens defined', () => {
      expect(M3_EASING_KEYS.length).toBe(6);
      
      for (const key of M3_EASING_KEYS) {
        expect(M3_MOTION_EASING).toHaveProperty(key);
        expect(M3_MOTION_EASING[key]).toBeDefined();
      }
    });

    it('should have valid cubic-bezier values for all easing tokens', () => {
      for (const key of M3_EASING_KEYS) {
        const value = M3_MOTION_EASING[key];
        expect(isValidCubicBezier(value)).toBe(true);
      }
    });

    it('should have correct easing values per M3 specification', () => {
      expect(M3_MOTION_EASING.standard).toBe('cubic-bezier(0.2, 0, 0, 1)');
      expect(M3_MOTION_EASING.standardDecelerate).toBe('cubic-bezier(0, 0, 0, 1)');
      expect(M3_MOTION_EASING.standardAccelerate).toBe('cubic-bezier(0.3, 0, 1, 1)');
      expect(M3_MOTION_EASING.emphasized).toBe('cubic-bezier(0.2, 0, 0, 1)');
      expect(M3_MOTION_EASING.emphasizedDecelerate).toBe('cubic-bezier(0.05, 0.7, 0.1, 1)');
      expect(M3_MOTION_EASING.emphasizedAccelerate).toBe('cubic-bezier(0.3, 0, 0.8, 0.15)');
    });

    it('should validate all default easing tokens', () => {
      expect(isValidEasingTokens(M3_MOTION_EASING)).toBe(true);
    });
  });

  describe('Cubic-Bezier Validation', () => {
    it('should accept valid cubic-bezier values', () => {
      fc.assert(
        fc.property(validCubicBezierArb, (bezier) => {
          expect(isValidCubicBezier(bezier)).toBe(true);
        })
      );
    });

    it('should reject invalid cubic-bezier values', () => {
      fc.assert(
        fc.property(invalidCubicBezierArb, (bezier) => {
          expect(isValidCubicBezier(bezier)).toBe(false);
        })
      );
    });

    it('should correctly parse cubic-bezier control points', () => {
      // Use integer-based generation to avoid scientific notation edge cases
      // Divide by 100 to get values in the desired range with 2 decimal precision
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }).map(n => n / 100),      // x1: 0-1
          fc.integer({ min: -200, max: 200 }).map(n => n / 100),   // y1: -2 to 2
          fc.integer({ min: 0, max: 100 }).map(n => n / 100),      // x2: 0-1
          fc.integer({ min: -200, max: 200 }).map(n => n / 100),   // y2: -2 to 2
          (x1, y1, x2, y2) => {
            const bezier = `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
            const parsed = parseCubicBezier(bezier);
            
            expect(parsed).not.toBeNull();
            expect(parsed!.x1).toBeCloseTo(x1, 5);
            expect(parsed!.y1).toBeCloseTo(y1, 5);
            expect(parsed!.x2).toBeCloseTo(x2, 5);
            expect(parsed!.y2).toBeCloseTo(y2, 5);
          }
        )
      );
    });

    it('should return null for invalid cubic-bezier values when parsing', () => {
      fc.assert(
        fc.property(invalidCubicBezierArb, (bezier) => {
          expect(parseCubicBezier(bezier)).toBeNull();
        })
      );
    });
  });

  describe('Complete Motion Token Validation', () => {
    it('should validate the complete default motion token set', () => {
      expect(isValidMotionTokens(M3_MOTION)).toBe(true);
    });

    it('should have duration values in ascending order within each category', () => {
      // Short durations
      expect(M3_DURATION_VALUES_MS.short1).toBeLessThan(M3_DURATION_VALUES_MS.short2);
      expect(M3_DURATION_VALUES_MS.short2).toBeLessThan(M3_DURATION_VALUES_MS.short3);
      expect(M3_DURATION_VALUES_MS.short3).toBeLessThan(M3_DURATION_VALUES_MS.short4);
      
      // Medium durations
      expect(M3_DURATION_VALUES_MS.medium1).toBeLessThan(M3_DURATION_VALUES_MS.medium2);
      expect(M3_DURATION_VALUES_MS.medium2).toBeLessThan(M3_DURATION_VALUES_MS.medium3);
      expect(M3_DURATION_VALUES_MS.medium3).toBeLessThan(M3_DURATION_VALUES_MS.medium4);
      
      // Long durations
      expect(M3_DURATION_VALUES_MS.long1).toBeLessThan(M3_DURATION_VALUES_MS.long2);
      expect(M3_DURATION_VALUES_MS.long2).toBeLessThan(M3_DURATION_VALUES_MS.long3);
      expect(M3_DURATION_VALUES_MS.long3).toBeLessThan(M3_DURATION_VALUES_MS.long4);
      
      // Extra long durations
      expect(M3_DURATION_VALUES_MS.extraLong1).toBeLessThan(M3_DURATION_VALUES_MS.extraLong2);
      expect(M3_DURATION_VALUES_MS.extraLong2).toBeLessThan(M3_DURATION_VALUES_MS.extraLong3);
      expect(M3_DURATION_VALUES_MS.extraLong3).toBeLessThan(M3_DURATION_VALUES_MS.extraLong4);
    });

    it('should have category boundaries in correct order', () => {
      expect(M3_DURATION_VALUES_MS.short4).toBeLessThan(M3_DURATION_VALUES_MS.medium1);
      expect(M3_DURATION_VALUES_MS.medium4).toBeLessThan(M3_DURATION_VALUES_MS.long1);
      expect(M3_DURATION_VALUES_MS.long4).toBeLessThan(M3_DURATION_VALUES_MS.extraLong1);
    });
  });

  describe('Motion Token Utilities', () => {
    it('should get correct duration token values', () => {
      fc.assert(
        fc.property(durationKeyArb, (key) => {
          const value = getDurationToken(key);
          expect(value).toBe(M3_MOTION_DURATION[key]);
        })
      );
    });

    it('should get correct easing token values', () => {
      fc.assert(
        fc.property(easingKeyArb, (key) => {
          const value = getEasingToken(key);
          expect(value).toBe(M3_MOTION_EASING[key]);
        })
      );
    });

    it('should create motion tokens with defaults when no overrides provided', () => {
      const tokens = createMotionTokens();
      
      for (const key of M3_DURATION_KEYS) {
        expect(tokens.duration[key]).toBe(M3_MOTION_DURATION[key]);
      }
      
      for (const key of M3_EASING_KEYS) {
        expect(tokens.easing[key]).toBe(M3_MOTION_EASING[key]);
      }
    });

    it('should convert motion tokens to CSS custom properties', () => {
      const cssVars = motionTokensToCssVars();
      
      // Check duration vars
      expect(cssVars['--md-sys-motion-duration-short1']).toBe('50ms');
      expect(cssVars['--md-sys-motion-duration-medium2']).toBe('300ms');
      expect(cssVars['--md-sys-motion-duration-long2']).toBe('500ms');
      
      // Check easing vars
      expect(cssVars['--md-sys-motion-easing-standard']).toBe('cubic-bezier(0.2, 0, 0, 1)');
      expect(cssVars['--md-sys-motion-easing-emphasized']).toBe('cubic-bezier(0.2, 0, 0, 1)');
    });
  });

  describe('Transition Presets', () => {
    it('should provide valid transition presets for all preset types', () => {
      const presetKeys = Object.keys(M3_TRANSITION_PRESETS) as (keyof typeof M3_TRANSITION_PRESETS)[];
      
      for (const preset of presetKeys) {
        const { duration, easing } = getTransitionPreset(preset);
        
        expect(isValidDurationValue(duration)).toBe(true);
        expect(isValidCubicBezier(easing)).toBe(true);
      }
    });

    it('should use standard duration (300ms) for standard transitions', () => {
      // Requirement 5.1: standard (300ms)
      const { duration } = getTransitionPreset('standard');
      expect(parseDurationValue(duration)).toBe(300);
    });

    it('should use emphasized duration (500ms) for emphasized transitions', () => {
      // Requirement 5.1: emphasized (500ms)
      const { duration } = getTransitionPreset('emphasized');
      expect(parseDurationValue(duration)).toBe(500);
    });

    it('should use emphasized-decelerate duration (400ms) for enter transitions', () => {
      // Requirement 5.1: emphasized-decelerate (400ms)
      const { duration } = getTransitionPreset('enter');
      expect(parseDurationValue(duration)).toBe(400);
    });
  });
});
