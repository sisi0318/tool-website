import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { DeviceFingerprint, FingerprintSignal } from "@/lib/device-fingerprint"
import { DeviceFingerprintPanel } from "./device-fingerprint-panel"

const readySignal = (digest: string, note = "Ready"): FingerprintSignal => ({
  status: "ready",
  digest,
  note,
  raw: JSON.stringify({ digest }),
})

const fingerprint: DeviceFingerprint = {
  version: 2,
  id: "a".repeat(64),
  collectedAt: "2026-07-11T12:00:00.000Z",
  readySignals: 5,
  totalSignals: 5,
  signals: {
    canvas: { ...readySignal("canvas-digest"), previewUrl: "data:image/png;base64,AA==" },
    webGL: readySignal("webgl-digest"),
    audio: readySignal("audio-digest"),
    fonts: { ...readySignal("fonts-digest"), values: ["Arial", "Consolas"] },
    navigator: readySignal("navigator-digest"),
  },
}

describe("DeviceFingerprintPanel", () => {
  it("shows the composite id and compact signal summaries", () => {
    render(<DeviceFingerprintPanel fingerprint={fingerprint} copied={{}} showDetails={false} onCopy={() => undefined} />)

    expect(screen.getByTestId("fingerprint-summary")).toHaveTextContent("5/5 信号")
    expect(screen.getByTestId("fingerprint-signal-audio")).toHaveTextContent("audio-digest")
    expect(screen.getByAltText("Canvas 指纹渲染预览")).toBeInTheDocument()
    expect(screen.queryByText("查看原始详情")).not.toBeInTheDocument()
  })

  it("copies the full digest instead of the displayed abbreviation", () => {
    const onCopy = vi.fn()
    render(<DeviceFingerprintPanel fingerprint={fingerprint} copied={{}} showDetails onCopy={onCopy} />)

    fireEvent.click(screen.getByRole("button", { name: "复制综合指纹" }))
    fireEvent.click(screen.getByRole("button", { name: "复制Canvas摘要" }))

    expect(onCopy).toHaveBeenNthCalledWith(1, fingerprint.id, "compositeFingerprint")
    expect(onCopy).toHaveBeenNthCalledWith(2, "canvas-digest", "canvasFingerprint")
    expect(screen.getAllByText("查看原始详情")).toHaveLength(5)
  })
})
