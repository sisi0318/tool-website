import { ShieldCheck } from "lucide-react"

import { registerNode } from "../canvas/registry"
import { inspectCryptoMaterial } from "../certificate-tools"
import type { ToolAdapter } from "./types"

export const certificateAdapter: ToolAdapter = {
  type: "certificate",
  category: "crypto",
  label: "Certificate / Key Inspector",
  description: "Inspect X.509 certificates, CSRs, PEM keys, JWK, and JWKS",
  icon: ShieldCheck,
  config: [{ id: "input", name: "Certificate, PEM, or JWK", dataType: "string", defaultValue: "", multiline: true, hasInput: true }],
  outputs: [
    { id: "result", name: "Inspection", dataType: "json" },
    { id: "kind", name: "Material type", dataType: "string" },
    { id: "fingerprint", name: "SHA-256 fingerprint", dataType: "string" },
  ],
  async execute(inputs, config) {
    const result = await inspectCryptoMaterial(String(inputs.input ?? config.input ?? ""))
    return { result, kind: result.kind, fingerprint: "fingerprintSha256" in result ? result.fingerprintSha256 ?? "" : "" }
  },
}

export function registerCertificateAdapter(): void {
  registerNode(certificateAdapter)
}
