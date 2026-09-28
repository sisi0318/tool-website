import { describe, expect, it } from "vitest"
import { MISSING_FILE_ERROR } from "@/lib/canvas/node-errors"
import { nodeStatusText } from "./NodeStatusMessage"

describe("nodeStatusText", () => {
  it("translates the missing-file code and leaves other adapter messages as they are", () => {
    const t = (key: string) => `canvas.${key}`
    expect(nodeStatusText(MISSING_FILE_ERROR, t)).toBe("canvas.nodeMissingFile")
    expect(nodeStatusText("Invalid JSON", t)).toBe("Invalid JSON")
  })
})
