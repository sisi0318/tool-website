import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { readLocalStorage, removeLocalStorage, writeLocalStorage } from "./safe-storage"

describe("safe-storage", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("reads and writes values", () => {
    expect(writeLocalStorage("k", "v")).toBe(true)
    expect(readLocalStorage("k")).toBe("v")
  })

  it("returns null for missing keys", () => {
    expect(readLocalStorage("missing")).toBeNull()
  })

  it("removes values", () => {
    writeLocalStorage("k", "v")
    expect(removeLocalStorage("k")).toBe(true)
    expect(readLocalStorage("k")).toBeNull()
  })

  it("returns null when reading throws (blocked storage)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError")
    })
    expect(readLocalStorage("k")).toBeNull()
  })

  it("returns false when writing throws (quota exceeded)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError")
    })
    expect(writeLocalStorage("k", "v")).toBe(false)
  })

  it("returns false when removal throws", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("SecurityError")
    })
    expect(removeLocalStorage("k")).toBe(false)
  })
})
