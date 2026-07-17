"use client"

import { useState } from "react"
import { Network } from "lucide-react"

import { UtilityWorkbench } from "@/components/tools/utility-workbench"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTranslations } from "@/hooks/use-translations"
import { calculateSubnet, type SubnetResult } from "@/lib/subnet-tools"

export default function SubnetPage() {
  const t = useTranslations("subnetTools")
  const [input, setInput] = useState("")
  const [probe, setProbe] = useState("")
  const [output, setOutput] = useState("")
  const [result, setResult] = useState<SubnetResult | null>(null)
  const [error, setError] = useState("")

  const run = () => {
    try {
      const next = calculateSubnet(input, probe)
      setResult(next)
      setOutput(JSON.stringify(next, null, 2))
      setError("")
    } catch {
      setResult(null)
      setOutput("")
      setError(t("failed"))
    }
  }

  return (
    <UtilityWorkbench
      title={t("title")}
      description={t("description")}
      icon={<Network className="h-6 w-6" />}
      input={input}
      output={output}
      operation="calculate"
      operations={[{ value: "calculate", label: t("calculate") }]}
      onInputChange={setInput}
      onOperationChange={() => undefined}
      onRun={run}
      onClear={() => { setInput(""); setProbe(""); setOutput(""); setResult(null); setError("") }}
      onSample={() => { setInput("192.168.10.42/24"); setProbe("192.168.10.200"); setOutput(""); setResult(null) }}
      error={error}
      inputLabel={t("cidr")}
      inputPlaceholder="192.168.1.10/24 or 2001:db8::1/64"
      controls={(
        <div>
          <Label htmlFor="subnet-probe">{t("probe")}</Label>
          <Input id="subnet-probe" value={probe} onChange={(event) => setProbe(event.target.value)} placeholder={t("probePlaceholder")} className="mt-2 min-h-11 font-mono" />
        </div>
      )}
      footer={result && (
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          {[
            [t("network"), result.network], [t("range"), `${result.firstAddress} — ${result.lastAddress}`],
            [t("addresses"), result.totalAddresses], [t("netmask"), result.netmask],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-3">
              <span className="block text-xs text-[var(--md-sys-color-on-surface-variant)]">{label}</span>
              <strong className="mt-1 block break-all font-mono">{value}</strong>
            </div>
          ))}
          {result.contains !== undefined && <div className={`rounded-xl p-3 font-medium sm:col-span-2 ${result.contains ? "bg-[var(--md-sys-color-success-container)] text-[var(--md-sys-color-on-success-container)]" : "bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)]"}`}>{result.contains ? t("inside") : t("outside")}</div>}
        </div>
      )}
    />
  )
}
