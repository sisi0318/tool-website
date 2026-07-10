"use client"

import { useState } from "react"
import { FileUp, ShieldCheck } from "lucide-react"

import { UtilityWorkbench } from "@/components/tools/utility-workbench"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/hooks/use-translations"
import { inspectCryptoMaterial } from "@/lib/certificate-tools"
import { bytesToBase64 } from "@/lib/compression"

const SAMPLE = JSON.stringify({ kty: "EC", crv: "P-256", kid: "signing-key", use: "sig", alg: "ES256", x: "f83OJ3D2xF4", y: "x_FEzRu9m36" }, null, 2)

export default function CertificatePage() {
  const t = useTranslations("certificateTools")
  const [input, setInput] = useState("")
  const [output, setOutput] = useState("")
  const [error, setError] = useState("")
  const [running, setRunning] = useState(false)

  const run = async () => {
    setRunning(true)
    try {
      setOutput(JSON.stringify(await inspectCryptoMaterial(input), null, 2))
      setError("")
    } catch (cause) {
      setOutput("")
      setError(cause instanceof Error ? cause.message : t("failed"))
    } finally {
      setRunning(false)
    }
  }

  const loadFile = async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const isText = /(?:pem|crt|cer|csr|key|json|jwk|txt)$/i.test(file.name)
    setInput(isText ? new TextDecoder().decode(bytes) : bytesToBase64(bytes))
    setOutput("")
  }

  return (
    <UtilityWorkbench
      title={t("title")}
      description={t("description")}
      icon={<ShieldCheck className="h-6 w-6" />}
      input={input}
      output={output}
      operation="inspect"
      operations={[{ value: "inspect", label: t("inspect") }]}
      onInputChange={setInput}
      onOperationChange={() => undefined}
      onRun={run}
      onClear={() => { setInput(""); setOutput(""); setError("") }}
      onSample={() => { setInput(SAMPLE); setOutput(""); setError("") }}
      running={running}
      error={error}
      inputPlaceholder={t("placeholder")}
      controls={(
        <Button type="button" variant="outline" asChild className="min-h-11 gap-2">
          <label><FileUp className="h-4 w-4" />{t("chooseFile")}<input type="file" className="sr-only" onChange={(event) => event.target.files?.[0] && void loadFile(event.target.files[0])} /></label>
        </Button>
      )}
      footer={<p className="text-xs leading-5 text-[var(--md-sys-color-on-surface-variant)]">{t("privacyNote")}</p>}
    />
  )
}
