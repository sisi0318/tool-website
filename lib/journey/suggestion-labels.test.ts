import { beforeAll, describe, expect, it } from "vitest"

import { registerAllAdapters } from "../adapters"
import type { DataType } from "../canvas/types"
import { en } from "../translations/en"
import { zhJourneySuggestions } from "../translations/zh-namespaces/journeySuggestions"

const zh = { journeySuggestions: zhJourneySuggestions }
import { CURATED_MATRIX, suggestNext } from "./suggest"

beforeAll(() => {
  registerAllAdapters()
})

const file = (name: string, type: string) => new File(["x"], name, { type })

/** 覆盖 suggestNext 里按文件类型、按文本特征直接追加的那些建议 */
const SAMPLES: Array<[unknown, DataType]> = [
  [file("report.pdf", "application/pdf"), "bytes"],
  [file("photo.png", "image/png"), "bytes"],
  [file("app.sqlite", "application/vnd.sqlite3"), "bytes"],
  [file("data.cbor", "application/cbor"), "bytes"],
  [file("rows.csv", "text/csv"), "bytes"],
  [file("bundle.zip", "application/zip"), "bytes"],
  [file("log.gz", "application/gzip"), "bytes"],
  [file("blob.bin", "application/octet-stream"), "bytes"],
  ["https://example.com/search?q=tools", "string"],
  ["first line\nsecond line", "string"],
  ["non breaking", "string"],
  ['{"level":"info"}\n{"level":"warn"}', "string"],
]

function translated(dictionary: unknown, key: string) {
  return (dictionary as { journeySuggestions: Record<string, string> }).journeySuggestions[key]
}

describe("journey suggestion labels", () => {
  it("has a name in both languages for every suggestion and keeps no stale ones", () => {
    const keys = new Set<string>()
    for (const entry of [...Object.values(CURATED_MATRIX.byDetection).flat(), ...CURATED_MATRIX.imageBytes, ...CURATED_MATRIX.genericBytes]) keys.add(entry.key)
    for (const [value, type] of SAMPLES) {
      for (const suggestion of suggestNext(value, type, 50)) if (suggestion.labelKey) keys.add(suggestion.labelKey)
    }

    for (const key of keys) {
      expect(translated(zh, key), `zh journeySuggestions.${key}`).toBeTruthy()
      expect(translated(en, key), `en journeySuggestions.${key}`).toBeTruthy()
    }
    expect([...keys].sort()).toEqual(Object.keys((zh as unknown as { journeySuggestions: object }).journeySuggestions).sort())
  })

  it("leaves type-compatible fallbacks without a phrase so they show the tool name", () => {
    const fallback = suggestNext("plain words", "string", 50).find((suggestion) => suggestion.reason === "compatible")
    expect(fallback).toBeDefined()
    expect(fallback?.labelKey).toBeUndefined()
  })
})
