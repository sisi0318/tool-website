export function clampFiniteNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, value))
}

export function calculateMetricBmi(heightCm: number, weightKg: number): number {
  if (!Number.isFinite(heightCm) || !Number.isFinite(weightKg) || heightCm <= 0 || weightKg <= 0) return 0
  const heightMeters = heightCm / 100
  return Math.round((weightKg / (heightMeters * heightMeters)) * 10) / 10
}

export function calculateImperialBmi(heightFeet: number, heightInches: number, weightPounds: number): number {
  const totalInches = heightFeet * 12 + heightInches
  if (!Number.isFinite(totalInches) || !Number.isFinite(weightPounds) || totalInches <= 0 || weightPounds <= 0) {
    return 0
  }
  return Math.round(((weightPounds * 703) / (totalInches * totalInches)) * 10) / 10
}
