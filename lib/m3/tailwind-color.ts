/**
 * An M3 colour token as a Tailwind colour, for tailwind.config.ts.
 *
 * The tokens are CSS variables holding hex colours, so Tailwind cannot fold an opacity
 * into them the way it does for its own palette. Declared as plain strings, a class such
 * as `bg-md-primary/90` compiled to no rule at all, with no warning: about two hundred
 * classes across the site were silently doing nothing.
 *
 * Declared as a function, Tailwind passes in the opacity it wants:
 * - none, or one of its own `--tw-*-opacity` variables: the class has no modifier.
 *   Answer with the bare variable, exactly as before.
 * - anything else (`/90`, `/[0.08]`): mix the token with transparent.
 *
 * A browser without color-mix() drops the mixed declaration, which is what every browser
 * did with these classes until now.
 *
 * An arbitrary value never reaches this function: `bg-[var(--md-sys-color-primary)]/90`
 * still compiles to nothing. Write `bg-md-primary/90`. The test beside this file fails if
 * the arbitrary form comes back.
 */
export function resolveTokenColor(name: string, opacityValue?: string): string {
  const color = `var(--md-sys-color-${name})`
  if (opacityValue === undefined || opacityValue.startsWith("var(--tw-")) return color

  const alpha = Number(opacityValue)
  const share = Number.isFinite(alpha)
    ? `${Math.round(alpha * 1000) / 10}%`
    : `calc(${opacityValue} * 100%)`
  return `color-mix(in srgb, ${color} ${share}, transparent)`
}

/** The value to put in the Tailwind theme: `"md-primary": tokenColor("primary")` */
export function tokenColor(name: string): string {
  const resolve = ({ opacityValue }: { opacityValue?: string } = {}) => resolveTokenColor(name, opacityValue)
  // Tailwind accepts a function here at runtime; its types only describe strings
  return resolve as unknown as string
}
