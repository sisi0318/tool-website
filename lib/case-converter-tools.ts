const WORD_START = /(^|[^\p{L}\p{N}])([\p{L}\p{N}])/gu
const SENTENCE_START = /(^|[.!?。！？]\s*)([\p{L}\p{N}])/gu

export function toUnicodeTitleCase(value: string): string {
  return value.toLocaleLowerCase().replace(
    WORD_START,
    (_match, prefix: string, character: string) => `${prefix}${character.toLocaleUpperCase()}`,
  )
}

export function toUnicodeSentenceCase(value: string): string {
  return value.toLocaleLowerCase().replace(
    SENTENCE_START,
    (_match, prefix: string, character: string) => `${prefix}${character.toLocaleUpperCase()}`,
  )
}
