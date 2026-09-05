// Normalization: https://www.unicode.org/reports/tr15/
// Lone UTF-16 surrogates have no valid UTF-8 encoding: https://www.unicode.org/faq/utf_bom.html
export const UNICODE_LIMITS = { units: 100_000, codePoints: 20_000 } as const
export const NORMALIZATION_FORMS = ["NFC", "NFD", "NFKC", "NFKD"] as const
export type NormalizationForm = typeof NORMALIZATION_FORMS[number]
export type UnicodeOperation = "inspect" | NormalizationForm
export type UnicodeFlag = "whitespace" | "control" | "format" | "ignorable" | "bidi" | "mark" | "variation" | "joiner" | "surrogate"
export interface UnicodeCharacter {
  index: number; character: string; codePoint: string; decimal: number; escape: string; utf16Offset: number; utf16: string[]; utf8: string | null; grapheme: number | null; category: string; label: string; flags: UnicodeFlag[]
}
export interface UnicodeReport {
  codePoints: number; utf16Units: number; utf8Bytes: number | null; graphemes: number | null; flagged: number; wellFormed: boolean; normalized: Record<NormalizationForm, boolean>; characters: UnicodeCharacter[]
}
export class UnicodeError extends Error {
  constructor(public code: "inputLimit" | "pointLimit" | "invalidOperation" | "illFormed") { super(code); this.name = "UnicodeError" }
}
const categories = ["Letter", "Mark", "Number", "Punctuation", "Symbol", "Separator", "Control", "Format", "Surrogate", "Private_Use", "Unassigned"].map((category) => [category, new RegExp(`\\p{${category}}`, "u")] as const)
const flagPatterns: Array<[UnicodeFlag, RegExp]> = [["whitespace", new RegExp("\\p{White_Space}", "u")], ["control", new RegExp("\\p{Control}", "u")], ["format", new RegExp("\\p{Format}", "u")], ["ignorable", new RegExp("\\p{Default_Ignorable_Code_Point}", "u")], ["bidi", new RegExp("\\p{Bidi_Control}", "u")], ["mark", new RegExp("\\p{Mark}", "u")], ["variation", new RegExp("\\p{Variation_Selector}", "u")]]
const labels: Record<number, string> = { 0: "NUL", 9: "TAB", 10: "LF", 11: "VT", 12: "FF", 13: "CR", 27: "ESC", 32: "SPACE", 127: "DEL", 133: "NEL", 160: "NBSP", 173: "SOFT HYPHEN", 847: "CGJ", 1564: "ALM", 5760: "OGHAM SPACE MARK", 6158: "MVS", 8192: "EN QUAD", 8193: "EM QUAD", 8194: "EN SPACE", 8195: "EM SPACE", 8196: "THREE-PER-EM SPACE", 8197: "FOUR-PER-EM SPACE", 8198: "SIX-PER-EM SPACE", 8199: "FIGURE SPACE", 8200: "PUNCTUATION SPACE", 8201: "THIN SPACE", 8202: "HAIR SPACE", 8203: "ZWSP", 8204: "ZWNJ", 8205: "ZWJ", 8206: "LRM", 8207: "RLM", 8232: "LINE SEPARATOR", 8233: "PARAGRAPH SEPARATOR", 8234: "LRE", 8235: "RLE", 8236: "PDF", 8237: "LRO", 8238: "RLO", 8239: "NARROW NBSP", 8287: "MEDIUM MATHEMATICAL SPACE", 8288: "WORD JOINER", 8294: "LRI", 8295: "RLI", 8296: "FSI", 8297: "PDI", 12288: "IDEOGRAPHIC SPACE", 65279: "BOM / ZWNBSP", 65533: "REPLACEMENT CHARACTER" }
const hex = (value: number, width = 4) => value.toString(16).toUpperCase().padStart(width, "0")

export function inspectUnicode(input: string): UnicodeReport {
  if (input.length > UNICODE_LIMITS.units) throw new UnicodeError("inputLimit")
  const points = Array.from(input)
  if (points.length > UNICODE_LIMITS.codePoints) throw new UnicodeError("pointLimit")
  const boundaries: number[] = []
  if (typeof Intl.Segmenter === "function") for (const segment of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(input)) boundaries.push(segment.index)
  let offset = 0, grapheme = 0, byteCount = 0, wellFormed = true
  const encoder = new TextEncoder()
  const characters = points.map((character, index): UnicodeCharacter => {
    const decimal = character.codePointAt(0)!
    const surrogate = decimal >= 0xd800 && decimal <= 0xdfff
    const flags = flagPatterns.filter(([, pattern]) => pattern.test(character)).map(([flag]) => flag)
    if (decimal === 0x200c || decimal === 0x200d) flags.push("joiner")
    if (surrogate) { flags.push("surrogate"); wellFormed = false }
    const bytes = surrogate ? null : encoder.encode(character)
    byteCount += bytes?.length ?? 0
    while (grapheme + 1 < boundaries.length && offset >= boundaries[grapheme + 1]) grapheme++
    const entry: UnicodeCharacter = {
      index, character, decimal, codePoint: "U+" + hex(decimal), escape: decimal <= 0xffff ? "\\u" + hex(decimal) : "\\u{" + hex(decimal) + "}", utf16Offset: offset,
      utf16: character.split("").map((unit) => hex(unit.charCodeAt(0))), utf8: bytes ? Array.from(bytes, (byte) => hex(byte, 2)).join(" ") : null,
      grapheme: boundaries.length ? grapheme : null, category: categories.find(([, pattern]) => pattern.test(character))?.[0] ?? "Unassigned", label: labels[decimal] ?? (decimal >= 0xfe00 && decimal <= 0xfe0f ? `VS${decimal - 0xfe00 + 1}` : decimal >= 0xe0100 && decimal <= 0xe01ef ? `VS${decimal - 0xe0100 + 17}` : ""), flags,
    }
    offset += character.length
    return entry
  })
  return { codePoints: points.length, utf16Units: input.length, utf8Bytes: wellFormed ? byteCount : null, graphemes: typeof Intl.Segmenter === "function" ? boundaries.length : null, flagged: characters.filter((entry) => entry.flags.length > 0).length, wellFormed, normalized: Object.fromEntries(NORMALIZATION_FORMS.map((form) => [form, input.normalize(form) === input])) as Record<NormalizationForm, boolean>, characters }
}

export function processUnicode(input: string, operation: UnicodeOperation = "inspect"): { output: string; report: UnicodeReport; changed: boolean } {
  if (operation !== "inspect" && !NORMALIZATION_FORMS.includes(operation)) throw new UnicodeError("invalidOperation")
  if (input.length > UNICODE_LIMITS.units) throw new UnicodeError("inputLimit")
  if (Array.from(input).length > UNICODE_LIMITS.codePoints) throw new UnicodeError("pointLimit")
  if (operation !== "inspect" && Array.from(input).some((character) => { const point = character.codePointAt(0)!; return point >= 0xd800 && point <= 0xdfff })) throw new UnicodeError("illFormed")
  const text = operation === "inspect" ? input : input.normalize(operation)
  const report = inspectUnicode(text)
  return { output: operation === "inspect" ? JSON.stringify(report, null, 2) : text, report, changed: text !== input }
}
