"use client"

import { useState } from "react"
import { Braces, CheckCircle2, XCircle } from "lucide-react"

import { UtilityWorkbench } from "@/components/tools/utility-workbench"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useTranslations } from "@/hooks/use-translations"
import { processJsonSchema, type JsonSchemaOperation } from "@/lib/json-schema-tools"

const SAMPLE_DATA = JSON.stringify({ id: 7, email: "dev@example.com", active: true, tags: ["tools", "local"] }, null, 2)
const SAMPLE_SCHEMA = JSON.stringify({
  type: "object",
  properties: { id: { type: "integer" }, email: { type: "string", format: "email" }, active: { type: "boolean" }, tags: { type: "array", items: { type: "string" } } },
  required: ["id", "email"],
}, null, 2)

export default function JsonSchemaPage() {
  const t = useTranslations("jsonSchemaTools")
  const [input, setInput] = useState("")
  const [schema, setSchema] = useState("")
  const [output, setOutput] = useState("")
  const [operation, setOperation] = useState<JsonSchemaOperation>("validate")
  const [valid, setValid] = useState<boolean | null>(null)
  const [error, setError] = useState("")

  const run = () => {
    try {
      const result = processJsonSchema(input, operation, schema)
      setValid(result.valid)
      setOutput(JSON.stringify(operation === "infer" ? result.schema : { valid: result.valid, errors: result.errors }, null, 2))
      setError("")
    } catch (cause) {
      setOutput("")
      setValid(false)
      setError(cause instanceof Error ? cause.message : t("failed"))
    }
  }

  return (
    <UtilityWorkbench
      title={t("title")}
      description={t("description")}
      icon={<Braces className="h-6 w-6" />}
      input={input}
      output={output}
      operation={operation}
      operations={[{ value: "validate", label: t("validate") }, { value: "infer", label: t("infer") }]}
      onInputChange={setInput}
      onOperationChange={(value) => { setOperation(value as JsonSchemaOperation); setOutput(""); setValid(null) }}
      onRun={run}
      onClear={() => { setInput(""); setSchema(""); setOutput(""); setValid(null); setError("") }}
      onSample={() => { setInput(SAMPLE_DATA); setSchema(SAMPLE_SCHEMA); setOutput(""); setValid(null) }}
      error={error}
      inputLabel={t("jsonData")}
      inputPlaceholder={t("dataPlaceholder")}
      controls={operation === "validate" ? (
        <div>
          <Label htmlFor="json-schema-input">{t("schema")}</Label>
          <Textarea id="json-schema-input" value={schema} onChange={(event) => setSchema(event.target.value)} placeholder={t("schemaPlaceholder")} spellCheck={false} className="mt-2 min-h-48 resize-y rounded-2xl font-mono text-sm leading-6" />
        </div>
      ) : undefined}
      footer={valid !== null && (
        <div className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium ${valid ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-red-500/10 text-red-700 dark:text-red-300"}`}>
          {valid ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
          {operation === "infer" ? t("schemaGenerated") : valid ? t("valid") : t("invalid")}
        </div>
      )}
    />
  )
}
