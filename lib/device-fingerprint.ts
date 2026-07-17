export const DEVICE_FINGERPRINT_VERSION = 2

export type FingerprintSignalStatus = "ready" | "limited" | "unsupported" | "blocked" | "error"

export interface FingerprintSignal {
  status: FingerprintSignalStatus
  digest: string | null
  note: string
  noteValue?: number
  raw?: string
  previewUrl?: string
}

export interface FontFingerprintSignal extends FingerprintSignal {
  values: string[]
}

export interface DeviceFingerprint {
  version: number
  id: string
  collectedAt: string
  readySignals: number
  totalSignals: number
  signals: {
    canvas: FingerprintSignal
    webGL: FingerprintSignal
    audio: FingerprintSignal
    fonts: FontFingerprintSignal
    navigator: FingerprintSignal
  }
}

const FONT_CANDIDATES = [
  "Arial",
  "Arial Black",
  "Arial Narrow",
  "Calibri",
  "Cambria",
  "Cambria Math",
  "Comic Sans MS",
  "Consolas",
  "Courier",
  "Courier New",
  "Georgia",
  "Helvetica",
  "Impact",
  "Lucida Console",
  "Lucida Sans Unicode",
  "Microsoft Sans Serif",
  "Palatino Linotype",
  "Segoe UI",
  "Tahoma",
  "Times",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
] as const

function normalizeStableValue(value: unknown): unknown {
  if (value === undefined || typeof value === "function" || typeof value === "symbol") return null
  if (typeof value === "number" && !Number.isFinite(value)) return String(value)
  if (Array.isArray(value)) return value.map(normalizeStableValue)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeStableValue(entry)]),
    )
  }
  return value
}

export function stableSerialize(value: unknown): string {
  return JSON.stringify(normalizeStableValue(value))
}

export async function sha256Hex(input: string, subtle: SubtleCrypto | undefined = globalThis.crypto?.subtle): Promise<string> {
  if (!subtle) throw new Error("Web Crypto SHA-256 is unavailable")
  const encoded = new TextEncoder().encode(input)
  const digest = await subtle.digest("SHA-256", encoded)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function buildCompositeFingerprint(
  signals: Record<string, Pick<FingerprintSignal, "status" | "digest">>,
): Promise<string> {
  const normalized = Object.fromEntries(
    Object.entries(signals).map(([key, signal]) => [
      key,
      signal.digest ? { status: signal.status, digest: signal.digest } : { status: signal.status },
    ]),
  )

  return sha256Hex(stableSerialize({ version: DEVICE_FINGERPRINT_VERSION, signals: normalized }))
}

function unavailableSignal(status: Exclude<FingerprintSignalStatus, "ready">, note: string): FingerprintSignal {
  return { status, digest: null, note }
}

async function withSignalTimeout<T extends FingerprintSignal>(
  task: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      task,
      new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => resolve(fallback), timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

async function collectCanvasSignal(): Promise<FingerprintSignal> {
  try {
    const canvas = document.createElement("canvas")
    canvas.width = 280
    canvas.height = 80
    const context = canvas.getContext("2d")
    if (!context) return unavailableSignal("unsupported", "canvasNoContext")

    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
    gradient.addColorStop(0, "#2563eb")
    gradient.addColorStop(0.52, "#16a34a")
    gradient.addColorStop(1, "#f97316")
    context.fillStyle = gradient
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.globalAlpha = 0.82
    context.fillStyle = "#fff"
    context.font = "16px Arial"
    context.textBaseline = "alphabetic"
    context.fillText("Device fingerprint · Aa09", 12, 30)
    context.globalCompositeOperation = "multiply"
    context.fillStyle = "rgba(255, 210, 0, .85)"
    context.beginPath()
    context.arc(222, 45, 25, 0, Math.PI * 2)
    context.fill()
    context.strokeStyle = "rgba(90, 20, 180, .9)"
    context.lineWidth = 3
    context.strokeRect(8.5, 42.5, 150, 24)

    const previewUrl = canvas.toDataURL("image/png")
    if (!previewUrl || previewUrl === "data:,") {
      return unavailableSignal("blocked", "canvasBlocked")
    }

    return {
      status: "ready",
      digest: await sha256Hex(previewUrl),
      note: "canvasRendered",
      raw: JSON.stringify({ width: canvas.width, height: canvas.height, encodedBytes: previewUrl.length }, null, 2),
      previewUrl,
    }
  } catch (error) {
    const blocked = error instanceof DOMException && error.name === "SecurityError"
    return unavailableSignal(blocked ? "blocked" : "error", blocked ? "canvasReadBlocked" : "canvasFailed")
  }
}

async function collectWebGLSignal(): Promise<FingerprintSignal> {
  try {
    const canvas = document.createElement("canvas")
    const gl = (canvas.getContext("webgl", { preserveDrawingBuffer: true }) ||
      canvas.getContext("experimental-webgl", { preserveDrawingBuffer: true })) as WebGLRenderingContext | null
    if (!gl) return unavailableSignal("unsupported", "webglDisabled")

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info") as
      | { UNMASKED_VENDOR_WEBGL: number; UNMASKED_RENDERER_WEBGL: number }
      | null
    const attributes = gl.getContextAttributes()
    const details = {
      vendor: gl.getParameter(gl.VENDOR),
      renderer: gl.getParameter(gl.RENDERER),
      unmaskedVendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : null,
      unmaskedRenderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : null,
      version: gl.getParameter(gl.VERSION),
      shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      redBits: gl.getParameter(gl.RED_BITS),
      greenBits: gl.getParameter(gl.GREEN_BITS),
      blueBits: gl.getParameter(gl.BLUE_BITS),
      alphaBits: gl.getParameter(gl.ALPHA_BITS),
      antialias: attributes?.antialias ?? null,
      extensions: (gl.getSupportedExtensions() ?? []).slice().sort(),
    }
    const serialized = stableSerialize(details)
    gl.getExtension("WEBGL_lose_context")?.loseContext()

    return {
      status: "ready",
      digest: await sha256Hex(serialized),
      note: debugInfo ? "webglFull" : "webglRendererHidden",
      raw: JSON.stringify(details, null, 2),
    }
  } catch {
    return unavailableSignal("error", "webglFailed")
  }
}

async function collectAudioSignal(): Promise<FingerprintSignal> {
  try {
    const audioWindow = window as typeof window & {
      webkitOfflineAudioContext?: typeof OfflineAudioContext
    }
    const OfflineContext = window.OfflineAudioContext || audioWindow.webkitOfflineAudioContext
    if (!OfflineContext) return unavailableSignal("unsupported", "audioUnavailable")

    const context = new OfflineContext(1, 44100, 44100)
    const oscillator = context.createOscillator()
    const compressor = context.createDynamicsCompressor()
    oscillator.type = "triangle"
    oscillator.frequency.setValueAtTime(10000, 0)
    compressor.threshold.setValueAtTime(-50, 0)
    compressor.knee.setValueAtTime(40, 0)
    compressor.ratio.setValueAtTime(12, 0)
    compressor.attack.setValueAtTime(0, 0)
    compressor.release.setValueAtTime(0.25, 0)
    oscillator.connect(compressor)
    compressor.connect(context.destination)
    oscillator.start(0)
    oscillator.stop(1)

    const rendered = await context.startRendering()
    const samples = rendered.getChannelData(0)
    const windowSamples: number[] = []
    let checksum = 0
    for (let index = 4500; index < 5000; index += 4) {
      const sample = samples[index] ?? 0
      checksum += Math.abs(sample)
      windowSamples.push(Number(sample.toFixed(7)))
    }

    const raw = stableSerialize({ checksum: Number(checksum.toFixed(8)), samples: windowSamples })
    const limited = checksum < 0.000001
    return {
      status: limited ? "limited" : "ready",
      digest: await sha256Hex(raw),
      note: limited ? "audioLimited" : "audioReady",
      raw: JSON.stringify({ checksum: Number(checksum.toFixed(8)), sampleCount: windowSamples.length }, null, 2),
    }
  } catch {
    return unavailableSignal("blocked", "audioBlocked")
  }
}

async function collectFontSignal(): Promise<FontFingerprintSignal> {
  const baseFonts = ["monospace", "sans-serif", "serif"] as const
  const detected: string[] = []
  const container = document.createElement("div")
  container.setAttribute("aria-hidden", "true")
  container.style.cssText = "position:fixed;left:-10000px;top:-10000px;visibility:hidden;white-space:nowrap;pointer-events:none"

  try {
    if (!document.body) {
      return { ...unavailableSignal("error", "fontsPageNotReady"), values: [] }
    }
    document.body.appendChild(container)
    const probe = document.createElement("span")
    probe.textContent = "mmmmmmmmmmlliWW@#Device"
    probe.style.fontSize = "72px"
    container.appendChild(probe)

    const baselines = new Map<string, { width: number; height: number }>()
    for (const baseFont of baseFonts) {
      probe.style.fontFamily = baseFont
      baselines.set(baseFont, { width: probe.offsetWidth, height: probe.offsetHeight })
    }

    for (const font of FONT_CANDIDATES) {
      const available = baseFonts.some((baseFont) => {
        probe.style.fontFamily = `'${font}', ${baseFont}`
        const baseline = baselines.get(baseFont)!
        return probe.offsetWidth !== baseline.width || probe.offsetHeight !== baseline.height
      })
      if (available) detected.push(font)
    }

    const serialized = stableSerialize(detected)
    return {
      status: detected.length > 0 ? "ready" : "limited",
      digest: await sha256Hex(serialized),
      note: detected.length > 0 ? "fontsDetected" : "fontsLimited",
      noteValue: detected.length,
      raw: JSON.stringify(detected, null, 2),
      values: detected,
    }
  } catch {
    return { ...unavailableSignal("error", "fontsFailed"), values: [] }
  } finally {
    container.remove()
  }
}

async function collectNavigatorSignal(): Promise<FingerprintSignal> {
  try {
    const nav = navigator as Navigator & {
      deviceMemory?: number
      pdfViewerEnabled?: boolean
      userAgentData?: { brands?: Array<{ brand: string; version: string }>; mobile?: boolean; platform?: string }
    }
    const details = {
      userAgent: nav.userAgent,
      platform: nav.userAgentData?.platform || nav.platform,
      brands: nav.userAgentData?.brands?.slice().sort((left, right) => left.brand.localeCompare(right.brand)) ?? [],
      mobile: nav.userAgentData?.mobile ?? /Mobi|Android/i.test(nav.userAgent),
      vendor: nav.vendor,
      language: nav.language,
      languages: Array.from(nav.languages ?? []),
      cookieEnabled: nav.cookieEnabled,
      doNotTrack: nav.doNotTrack,
      hardwareConcurrency: nav.hardwareConcurrency,
      deviceMemory: nav.deviceMemory ?? null,
      maxTouchPoints: nav.maxTouchPoints,
      pdfViewerEnabled: nav.pdfViewerEnabled ?? null,
      plugins: Array.from(nav.plugins ?? [], (plugin) => plugin.name).sort(),
      mimeTypes: Array.from(nav.mimeTypes ?? [], (mimeType) => mimeType.type).sort(),
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        colorDepth: window.screen.colorDepth,
        pixelDepth: window.screen.pixelDepth,
        devicePixelRatio: window.devicePixelRatio || 1,
      },
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }
    const serialized = stableSerialize(details)
    return {
      status: "ready",
      digest: await sha256Hex(serialized),
      note: "navigatorSummary",
      raw: JSON.stringify(details, null, 2),
    }
  } catch {
    return unavailableSignal("error", "navigatorFailed")
  }
}

export async function collectDeviceFingerprint(): Promise<DeviceFingerprint> {
  const [canvas, webGL, audio, fonts, navigatorSignal] = await Promise.all([
    withSignalTimeout(collectCanvasSignal(), 2000, unavailableSignal("blocked", "canvasTimeout")),
    withSignalTimeout(collectWebGLSignal(), 2000, unavailableSignal("blocked", "webglTimeout")),
    withSignalTimeout(collectAudioSignal(), 2500, unavailableSignal("blocked", "audioTimeout")),
    withSignalTimeout(
      collectFontSignal(),
      2000,
      { ...unavailableSignal("blocked", "fontsTimeout"), values: [] },
    ),
    withSignalTimeout(collectNavigatorSignal(), 2000, unavailableSignal("blocked", "navigatorTimeout")),
  ])
  const signals = { canvas, webGL, audio, fonts, navigator: navigatorSignal }
  const readySignals = Object.values(signals).filter((signal) => Boolean(signal.digest)).length
  let id = "unavailable"
  try {
    id = await buildCompositeFingerprint({
      canvas,
      webGL,
      audio,
      fonts,
      navigator: navigatorSignal,
    })
  } catch {
    // Individual signal results remain useful when Web Crypto is unavailable.
  }

  return {
    version: DEVICE_FINGERPRINT_VERSION,
    id,
    collectedAt: new Date().toISOString(),
    readySignals,
    totalSignals: Object.keys(signals).length,
    signals,
  }
}
