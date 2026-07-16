import { base64ToBytes, bytesToHex } from "./compression"

export interface CryptoMaterialInspection {
  kind: string
  summary: Record<string, unknown>
  fingerprintSha256?: string
  warnings: string[]
}

interface PemBlock {
  label: string
  pem: string
  bytes: Uint8Array
  encrypted: boolean
}

const PRIVATE_JWK_FIELDS = new Set(["d", "p", "q", "dp", "dq", "qi", "oth", "k"])

async function loadX509() {
  await import("reflect-metadata")
  return import("@peculiar/x509")
}

function extractPemBlocks(input: string): PemBlock[] {
  const blocks: PemBlock[] = []
  const expression = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/g
  for (const match of input.matchAll(expression)) {
    const label = match[1]
    const bodyLines = match[2].split(/\r?\n/).map((line) => line.trim())
    const body: string[] = []
    let readingHeaders = true
    let sawHeader = false
    for (const line of bodyLines) {
      if (!line) {
        if (sawHeader) readingHeaders = false
        continue
      }
      if (readingHeaders && /^(?:Proc-Type|DEK-Info):\s*/i.test(line)) {
        sawHeader = true
        continue
      }
      readingHeaders = false
      body.push(line)
    }
    blocks.push({
      label,
      pem: match[0],
      bytes: base64ToBytes(body.join("")),
      encrypted: label.includes("ENCRYPTED") || /Proc-Type:\s*4,ENCRYPTED/i.test(match[2]),
    })
  }
  return blocks
}

function base64UrlByteLength(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined
  return Math.floor((value.length * 6) / 8)
}

function summarizeJwk(jwk: Record<string, unknown>) {
  const privateFields = [...PRIVATE_JWK_FIELDS].filter((field) => field in jwk)
  const modulusBytes = base64UrlByteLength(jwk.n)
  return {
    kty: jwk.kty ?? "unknown",
    kid: jwk.kid ?? null,
    use: jwk.use ?? null,
    alg: jwk.alg ?? null,
    keyOps: jwk.key_ops ?? null,
    curve: jwk.crv ?? null,
    ...(modulusBytes ? { keySizeBits: modulusBytes * 8 } : {}),
    hasPrivateMaterial: privateFields.length > 0,
    privateFields,
  }
}

function assertValidJwk(jwk: Record<string, unknown>): void {
  const kty = jwk.kty
  if (typeof kty !== "string" || !["RSA", "EC", "OKP", "oct"].includes(kty)) {
    throw new Error("JWK must include a supported kty value: RSA, EC, OKP, or oct")
  }

  const requiredFields: Record<string, string[]> = {
    RSA: ["n", "e"],
    EC: ["crv", "x", "y"],
    OKP: ["crv", "x"],
    oct: ["k"],
  }
  const missing = requiredFields[kty].filter((field) => typeof jwk[field] !== "string" || !jwk[field])
  if (missing.length > 0) throw new Error(`JWK ${kty} key is missing required field(s): ${missing.join(", ")}`)
}

function algorithmSummary(algorithm: Algorithm | undefined): Record<string, unknown> | null {
  if (!algorithm) return null
  const value = algorithm as Algorithm & { hash?: Algorithm; namedCurve?: string; length?: number }
  return {
    name: value.name,
    ...(value.hash?.name ? { hash: value.hash.name } : {}),
    ...(value.namedCurve ? { namedCurve: value.namedCurve } : {}),
    ...(value.length ? { length: value.length } : {}),
  }
}

async function sha256(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const source = bytes instanceof ArrayBuffer ? bytes : Uint8Array.from(bytes).buffer
  const digest = await globalThis.crypto.subtle.digest("SHA-256", source)
  return bytesToHex(new Uint8Array(digest)).match(/.{2}/g)?.join(":").toUpperCase() ?? ""
}

async function inspectCertificate(raw: string | BufferSource): Promise<CryptoMaterialInspection> {
  const { X509Certificate } = await loadX509()
  const certificate = new X509Certificate(raw)
  const now = Date.now()
  const validity = now < certificate.notBefore.getTime() ? "not-yet-valid" : now > certificate.notAfter.getTime() ? "expired" : "valid"
  return {
    kind: "X.509 certificate",
    fingerprintSha256: await sha256(certificate.rawData),
    warnings: [],
    summary: {
      subject: certificate.subject,
      issuer: certificate.issuer,
      serialNumber: certificate.serialNumber,
      notBefore: certificate.notBefore.toISOString(),
      notAfter: certificate.notAfter.toISOString(),
      validity,
      signatureAlgorithm: algorithmSummary(certificate.signatureAlgorithm),
      publicKeyAlgorithm: algorithmSummary(certificate.publicKey.algorithm),
      extensions: certificate.extensions.map((extension) => ({ oid: extension.type, critical: extension.critical })),
    },
  }
}

async function inspectPemBlock(block: PemBlock): Promise<CryptoMaterialInspection> {
  if (block.label === "CERTIFICATE") return inspectCertificate(block.pem)
  if (block.label === "CERTIFICATE REQUEST" || block.label === "NEW CERTIFICATE REQUEST") {
    const { Pkcs10CertificateRequest } = await loadX509()
    const request = new Pkcs10CertificateRequest(block.pem)
    return {
      kind: "PKCS#10 certificate request",
      fingerprintSha256: await sha256(request.rawData),
      warnings: [],
      summary: {
        subject: request.subject,
        signatureAlgorithm: algorithmSummary(request.signatureAlgorithm),
        publicKeyAlgorithm: algorithmSummary(request.publicKey.algorithm),
        attributes: request.attributes.length,
        extensions: request.extensions.map((extension) => ({ oid: extension.type, critical: extension.critical })),
      },
    }
  }
  if (block.label === "PUBLIC KEY") {
    const { PublicKey } = await loadX509()
    const publicKey = new PublicKey(block.pem)
    return {
      kind: "Public key",
      fingerprintSha256: await sha256(publicKey.rawData),
      warnings: [],
      summary: { format: "SubjectPublicKeyInfo", algorithm: algorithmSummary(publicKey.algorithm), byteLength: block.bytes.byteLength },
    }
  }
  if (block.label.includes("PRIVATE KEY")) {
    return {
      kind: "Private key container",
      warnings: ["Private key contents are intentionally not decoded or displayed."],
      summary: { format: block.label, encrypted: block.encrypted, byteLength: block.bytes.byteLength },
    }
  }
  return {
    kind: "PEM block",
    fingerprintSha256: await sha256(block.bytes),
    warnings: ["This PEM label is not decoded; only container metadata is shown."],
    summary: { format: block.label, byteLength: block.bytes.byteLength },
  }
}

export async function inspectCryptoMaterial(input: string): Promise<CryptoMaterialInspection | { kind: "PEM bundle"; items: CryptoMaterialInspection[]; warnings: string[] }> {
  const trimmed = input.trim()
  if (!trimmed) throw new Error("Certificate, PEM, or JWK input is required")

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let parsed: unknown
    try { parsed = JSON.parse(trimmed) } catch (cause) { throw new Error(cause instanceof Error ? cause.message : "Invalid JSON") }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JWK input must be a JSON object")
    const object = parsed as Record<string, unknown>
    const keys = Array.isArray(object.keys) ? object.keys : [object]
    const summaries = keys.map((key) => {
      if (!key || typeof key !== "object" || Array.isArray(key)) throw new Error("Invalid JWK entry")
      const jwk = key as Record<string, unknown>
      assertValidJwk(jwk)
      return summarizeJwk(jwk)
    })
    const hasPrivate = summaries.some((summary) => summary.hasPrivateMaterial)
    return {
      kind: Array.isArray(object.keys) ? "JSON Web Key Set" : "JSON Web Key",
      warnings: hasPrivate ? ["Private key parameters were detected but their values are intentionally hidden."] : [],
      summary: Array.isArray(object.keys) ? { keyCount: summaries.length, keys: summaries } : summaries[0],
    }
  }

  const blocks = extractPemBlocks(trimmed)
  if (blocks.length > 1) {
    return { kind: "PEM bundle", items: await Promise.all(blocks.map(inspectPemBlock)), warnings: [] }
  }
  if (blocks.length === 1) return inspectPemBlock(blocks[0])

  if (/^[A-Za-z0-9+/=_-]+$/.test(trimmed.replace(/\s+/g, ""))) {
    try { return await inspectCertificate(trimmed.replace(/\s+/g, "")) } catch { /* fall through */ }
  }
  throw new Error("Unsupported input. Paste an X.509 certificate, CSR, PEM key, JWK, or JWKS.")
}
