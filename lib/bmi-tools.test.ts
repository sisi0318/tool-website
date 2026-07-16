import { describe, expect, it } from "vitest"
import { calculateImperialBmi, calculateMetricBmi, clampFiniteNumber } from "./bmi-tools"

describe("BMI tools", () => {
  it("uses a finite fallback instead of propagating NaN", () => {
    expect(clampFiniteNumber(Number.NaN, 100, 250, 170)).toBe(170)
    expect(clampFiniteNumber(Number.POSITIVE_INFINITY, 100, 250, 170)).toBe(170)
  })

  it("calculates metric and imperial BMI", () => {
    expect(calculateMetricBmi(170, 70)).toBe(24.2)
    expect(calculateImperialBmi(5, 7, 154)).toBe(24.1)
  })
})
