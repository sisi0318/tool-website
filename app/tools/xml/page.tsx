"use client"

import { useState } from "react"
import { FileCode2 } from "lucide-react"

import { UtilityWorkbench } from "@/components/tools/utility-workbench"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTranslations } from "@/hooks/use-translations"
import { processXml, type XmlOperation } from "@/lib/xml-tools"

const SAMPLE = '<?xml version="1.0"?>\n<catalog><book id="1"><title>Tool Website</title><author>Codex</author></book></catalog>'

export default function XmlToolsPage() {
  const t = useTranslations("xmlTools")
  const [input, setInput] = useState("")
  const [output, setOutput] = useState("")
  const [operation, setOperation] = useState<XmlOperation>("format")
  const [xpath, setXpath] = useState("//book/title")
  const [error, setError] = useState("")

  const run = () => {
    try {
      setOutput(processXml(input, operation, xpath))
      setError("")
    } catch (cause) {
      setOutput("")
      setError(cause instanceof Error ? cause.message : t("failed"))
    }
  }

  const operations: Array<{ value: XmlOperation; label: string }> = [
    { value: "format", label: t("format") },
    { value: "minify", label: t("minify") },
    { value: "to-json", label: t("toJson") },
    { value: "from-json", label: t("fromJson") },
    { value: "xpath", label: t("xpath") },
    { value: "validate", label: t("validate") },
  ]

  return (
    <UtilityWorkbench
      title={t("title")}
      description={t("description")}
      icon={<FileCode2 className="h-6 w-6" />}
      input={input}
      output={output}
      operation={operation}
      operations={operations}
      onInputChange={setInput}
      onOperationChange={(value) => { setOperation(value as XmlOperation); setOutput("") }}
      onRun={run}
      onClear={() => { setInput(""); setOutput(""); setError("") }}
      onSample={() => { setInput(SAMPLE); setOperation("format") }}
      error={error}
      inputPlaceholder={operation === "from-json" ? t("jsonPlaceholder") : t("xmlPlaceholder")}
      controls={operation === "xpath" && (
        <div>
          <Label htmlFor="xml-xpath">{t("xpathExpression")}</Label>
          <Input id="xml-xpath" value={xpath} onChange={(event) => setXpath(event.target.value)} className="mt-2 min-h-11 font-mono" />
        </div>
      )}
    />
  )
}
