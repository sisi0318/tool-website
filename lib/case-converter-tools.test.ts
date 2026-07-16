import { describe, expect, it } from "vitest"
import { toUnicodeSentenceCase, toUnicodeTitleCase } from "./case-converter-tools"

describe("case converter tools", () => {
  it("title-cases Unicode letters", () => {
    expect(toUnicodeTitleCase("éCOLE déjà ПРИВЕТ мир")).toBe("École Déjà Привет Мир")
  })

  it("recognizes Unicode sentence punctuation and letters", () => {
    expect(toUnicodeSentenceCase("éCOLE. ПРИВЕТ！ déjà")).toBe("École. Привет！ Déjà")
  })
})
