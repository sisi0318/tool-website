export interface TextStatistics {
  characters: number
  charactersNoSpaces: number
  words: number
  sentences: number
  paragraphs: number
  lines: number
  chineseCharacters: number
  englishWords: number
  numbers: number
  punctuation: number
  spaces: number
  readingTime: number
  speakingTime: number
}

export interface WordFrequency {
  word: string
  count: number
}

export interface WordFrequencyResult {
  items: WordFrequency[]
  analyzedCharacters: number
  truncated: boolean
}

export const MAX_FREQUENCY_ANALYSIS_CHARACTERS = 50_000

const WHITESPACE = /\s/u
const PUNCTUATION = new Set(
  Array.from(`.,!?;:'"()[]{}<>，。！？；：""''（）【】《》、`),
)

function isChineseCharacter(character: string): boolean {
  return character >= "\u4e00" && character <= "\u9fa5"
}

function isEnglishLetter(character: string): boolean {
  const code = character.charCodeAt(0)
  return (
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122)
  )
}

function isAsciiNumber(character: string): boolean {
  const code = character.charCodeAt(0)
  return code >= 48 && code <= 57
}

export function calculateTextStatistics(text: string): TextStatistics {
  if (!text) {
    return {
      characters: 0,
      charactersNoSpaces: 0,
      words: 0,
      sentences: 0,
      paragraphs: 0,
      lines: 0,
      chineseCharacters: 0,
      englishWords: 0,
      numbers: 0,
      punctuation: 0,
      spaces: 0,
      readingTime: 0,
      speakingTime: 0,
    }
  }

  let spaces = 0
  let chineseCharacters = 0
  let englishWords = 0
  let numbers = 0
  let punctuation = 0
  let sentences = 0
  let insideEnglishWord = false
  let insideSentenceDelimiter = false

  for (const character of text) {
    if (WHITESPACE.test(character)) spaces++
    if (isChineseCharacter(character)) chineseCharacters++
    if (isAsciiNumber(character)) numbers++
    if (PUNCTUATION.has(character)) punctuation++

    if (isEnglishLetter(character)) {
      if (!insideEnglishWord) englishWords++
      insideEnglishWord = true
    } else {
      insideEnglishWord = false
    }

    const isSentenceDelimiter = ".!?。！？".includes(character)
    if (isSentenceDelimiter && !insideSentenceDelimiter) sentences++
    insideSentenceDelimiter = isSentenceDelimiter
  }

  const splitLines = text.split("\n")
  let paragraphs = 0
  let insideParagraph = false
  for (const line of splitLines) {
    if (line.trim()) {
      if (!insideParagraph) paragraphs++
      insideParagraph = true
    } else {
      insideParagraph = false
    }
  }

  if (sentences === 0 && text.trim()) {
    sentences = 1
  }

  const words = englishWords + chineseCharacters

  return {
    characters: text.length,
    charactersNoSpaces: text.length - spaces,
    words,
    sentences,
    paragraphs,
    lines: splitLines.length,
    chineseCharacters,
    englishWords,
    numbers,
    punctuation,
    spaces,
    readingTime: Math.ceil((chineseCharacters / 200) + (englishWords / 250)),
    speakingTime: Math.ceil((chineseCharacters / 150) + (englishWords / 150)),
  }
}

function incrementFrequency(frequencies: Map<string, number>, word: string): void {
  frequencies.set(word, (frequencies.get(word) ?? 0) + 1)
}

function selectTopFrequencies(
  frequencies: Map<string, number>,
  limit: number,
): WordFrequency[] {
  const top: WordFrequency[] = []

  for (const [word, count] of frequencies) {
    if (count < 2) continue

    const insertAt = top.findIndex((entry) => (
      count > entry.count ||
      (count === entry.count && word.localeCompare(entry.word) < 0)
    ))

    if (insertAt === -1) {
      if (top.length < limit) top.push({ word, count })
    } else {
      top.splice(insertAt, 0, { word, count })
      if (top.length > limit) top.pop()
    }
  }

  return top
}

export function calculateWordFrequency(
  text: string,
  limit = 10,
  maxCharacters = MAX_FREQUENCY_ANALYSIS_CHARACTERS,
): WordFrequencyResult {
  if (!text.trim() || limit <= 0 || maxCharacters <= 0) {
    return {
      items: [],
      analyzedCharacters: 0,
      truncated: text.length > 0,
    }
  }

  const sample = text.slice(0, maxCharacters)
  const frequencies = new Map<string, number>()
  let index = 0

  while (index < sample.length) {
    const character = sample[index]

    if (isChineseCharacter(character)) {
      let end = index + 1
      while (end < sample.length && isChineseCharacter(sample[end])) end++

      for (let start = index; start < end; start++) {
        for (let length = 2; length <= 4 && start + length <= end; length++) {
          incrementFrequency(frequencies, sample.slice(start, start + length))
        }
      }

      index = end
      continue
    }

    if (isEnglishLetter(character)) {
      let end = index + 1
      while (end < sample.length && isEnglishLetter(sample[end])) end++
      const word = sample.slice(index, end).toLowerCase()
      if (word.length >= 2) incrementFrequency(frequencies, word)
      index = end
      continue
    }

    index++
  }

  return {
    items: selectTopFrequencies(frequencies, limit),
    analyzedCharacters: sample.length,
    truncated: sample.length < text.length,
  }
}
