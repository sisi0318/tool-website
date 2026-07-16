export function getModularInverse(value: number, modulus: number): number {
  if (!Number.isInteger(value) || !Number.isInteger(modulus) || modulus <= 1) {
    throw new Error("模逆参数必须是有效整数")
  }

  const normalized = ((value % modulus) + modulus) % modulus
  for (let candidate = 1; candidate < modulus; candidate += 1) {
    if ((normalized * candidate) % modulus === 1) return candidate
  }

  throw new Error(`参数 a=${value} 与 ${modulus} 不互质，无法用于仿射密码`)
}
