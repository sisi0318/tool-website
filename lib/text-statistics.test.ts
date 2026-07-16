import { describe, expect, it } from "vitest"

import {
  calculateTextStatistics,
  calculateWordFrequency,
} from "./text-statistics"

describe("calculateTextStatistics", () => {
  it("counts mixed Chinese and English text in one pass", () => {
    const result = calculateTextStatistics("你好 world 123！\n\nSecond line.")

    expect(result.chineseCharacters).toBe(2)
    expect(result.englishWords).toBe(3)
    expect(result.words).toBe(5)
    expect(result.numbers).toBe(3)
    expect(result.sentences).toBe(2)
    expect(result.paragraphs).toBe(2)
    expect(result.lines).toBe(3)
  })

  it("returns zeroed statistics for empty text", () => {
    expect(calculateTextStatistics("")).toMatchObject({
      characters: 0,
      words: 0,
      lines: 0,
      paragraphs: 0,
    })
  })

  it("treats text without terminal punctuation as one sentence", () => {
    expect(calculateTextStatistics("plain text").sentences).toBe(1)
  })
})

describe("calculateWordFrequency", () => {
  it("counts repeated English words and Chinese n-grams", () => {
    const result = calculateWordFrequency(
      "hello hello world 世界你好世界你好",
      10,
    )

    expect(result.items).toContainEqual({ word: "hello", count: 2 })
    expect(result.items.some((entry) => entry.word === "世界" && entry.count >= 2)).toBe(true)
  })

  it("caps frequency analysis for very large text", () => {
    const result = calculateWordFrequency("repeat ".repeat(100), 10, 20)

    expect(result.truncated).toBe(true)
    expect(result.analyzedCharacters).toBe(20)
  })

  it("keeps only the requested number of top entries", () => {
    const result = calculateWordFrequency(
      "alpha alpha beta beta gamma gamma",
      2,
    )

    expect(result.items).toHaveLength(2)
  })
})
