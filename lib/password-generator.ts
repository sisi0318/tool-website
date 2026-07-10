export interface PasswordOptions {
  length: number
  lowercase: boolean
  uppercase: boolean
  numbers: boolean
  symbols: boolean
  excludeAmbiguous: boolean
}

export interface PassphraseOptions {
  wordCount: number
  separator: string
  capitalize: boolean
  includeNumber: boolean
}

export type PasswordStrength = "weak" | "fair" | "good" | "strong"

const LOWERCASE = "abcdefghijklmnopqrstuvwxyz"
const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
const NUMBERS = "0123456789"
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.?"
const AMBIGUOUS = new Set("Il1O0o|`'\"".split(""))

const ADJECTIVES = [
  "amber", "bold", "calm", "clear", "cool", "coral", "crisp", "deep",
  "eager", "fair", "fast", "fresh", "gentle", "gold", "grand", "green",
  "happy", "keen", "kind", "light", "lively", "lucky", "merry", "mild",
  "navy", "quiet", "rapid", "safe", "silver", "smart", "swift", "warm",
] as const

const NOUNS = [
  "anchor", "apple", "badger", "beacon", "birch", "breeze", "brook", "cedar",
  "cloud", "comet", "coral", "dawn", "falcon", "field", "forest", "harbor",
  "island", "lake", "maple", "meadow", "moon", "oak", "ocean", "panda",
  "pebble", "pine", "river", "sparrow", "star", "stone", "sun", "willow",
] as const

const VERBS = [
  "builds", "carries", "climbs", "drifts", "flows", "gathers", "glows", "guides",
  "jumps", "keeps", "lands", "leads", "moves", "opens", "paints", "rests",
  "rises", "runs", "sails", "shines", "sings", "skips", "soars", "spins",
  "stands", "travels", "turns", "walks", "wanders", "warms", "watches", "waves",
] as const

function secureRandomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0) throw new Error("INVALID_RANDOM_RANGE")
  if (typeof crypto === "undefined" || !crypto.getRandomValues) throw new Error("SECURE_RANDOM_UNAVAILABLE")

  const range = 0x1_0000_0000
  const limit = Math.floor(range / max) * max
  const buffer = new Uint32Array(1)
  do {
    crypto.getRandomValues(buffer)
  } while (buffer[0] >= limit)
  return buffer[0] % max
}

function pick(source: string): string {
  return source[secureRandomInt(source.length)]
}

function shuffle(value: string[]): string[] {
  for (let index = value.length - 1; index > 0; index -= 1) {
    const target = secureRandomInt(index + 1)
    ;[value[index], value[target]] = [value[target], value[index]]
  }
  return value
}

function filterAmbiguous(source: string, enabled: boolean): string {
  return enabled ? [...source].filter((character) => !AMBIGUOUS.has(character)).join("") : source
}

export function getPasswordPoolSize(options: PasswordOptions): number {
  return [
    options.lowercase ? filterAmbiguous(LOWERCASE, options.excludeAmbiguous) : "",
    options.uppercase ? filterAmbiguous(UPPERCASE, options.excludeAmbiguous) : "",
    options.numbers ? filterAmbiguous(NUMBERS, options.excludeAmbiguous) : "",
    options.symbols ? filterAmbiguous(SYMBOLS, options.excludeAmbiguous) : "",
  ].join("").length
}

export function generatePassword(options: PasswordOptions): string {
  const groups = [
    options.lowercase ? filterAmbiguous(LOWERCASE, options.excludeAmbiguous) : "",
    options.uppercase ? filterAmbiguous(UPPERCASE, options.excludeAmbiguous) : "",
    options.numbers ? filterAmbiguous(NUMBERS, options.excludeAmbiguous) : "",
    options.symbols ? filterAmbiguous(SYMBOLS, options.excludeAmbiguous) : "",
  ].filter(Boolean)

  if (groups.length === 0) throw new Error("NO_CHARACTER_SET")
  if (!Number.isInteger(options.length) || options.length < groups.length || options.length > 256) {
    throw new Error("INVALID_PASSWORD_LENGTH")
  }

  const pool = groups.join("")
  const characters = groups.map(pick)
  while (characters.length < options.length) characters.push(pick(pool))
  return shuffle(characters).join("")
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function generatePassphrase(options: PassphraseOptions): string {
  if (!Number.isInteger(options.wordCount) || options.wordCount < 3 || options.wordCount > 12) {
    throw new Error("INVALID_WORD_COUNT")
  }

  const words = Array.from({ length: options.wordCount }, () => {
    const adjective = ADJECTIVES[secureRandomInt(ADJECTIVES.length)]
    const noun = capitalize(NOUNS[secureRandomInt(NOUNS.length)])
    const verb = capitalize(VERBS[secureRandomInt(VERBS.length)])
    const compound = `${adjective}${noun}${verb}`
    return options.capitalize ? capitalize(compound) : compound
  })

  const phrase = words.join(options.separator)
  return options.includeNumber ? `${phrase}${secureRandomInt(100).toString().padStart(2, "0")}` : phrase
}

export function calculatePasswordEntropy(length: number, poolSize: number): number {
  if (length <= 0 || poolSize <= 1) return 0
  return length * Math.log2(poolSize)
}

export function calculatePassphraseEntropy(wordCount: number, includeNumber: boolean): number {
  const combinationsPerWord = ADJECTIVES.length * NOUNS.length * VERBS.length
  return wordCount * Math.log2(combinationsPerWord) + (includeNumber ? Math.log2(100) : 0)
}

export function getPasswordStrength(entropy: number): PasswordStrength {
  if (entropy < 40) return "weak"
  if (entropy < 60) return "fair"
  if (entropy < 80) return "good"
  return "strong"
}
