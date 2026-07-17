"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Calculator, Info, RotateCcw } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { calculateImperialBmi, calculateMetricBmi, clampFiniteNumber } from "@/lib/bmi-tools"
import { useTranslations } from "@/hooks/use-translations"

type BmiCategoryKey = "underweight" | "normal" | "overweight" | "obese1" | "obese2" | "obese3"

interface BmiCategory {
  key: BmiCategoryKey
  maximum: number
  range: string
  tone: string
  containerTone: string
}

const BMI_CATEGORIES: readonly BmiCategory[] = [
  {
    key: "underweight",
    maximum: 18.5,
    range: "< 18.5",
    tone: "bg-[var(--md-sys-color-secondary)]",
    containerTone: "bg-[var(--md-sys-color-secondary-container)]",
  },
  {
    key: "normal",
    maximum: 25,
    range: "18.5–24.9",
    tone: "bg-[var(--md-sys-color-tertiary)]",
    containerTone: "bg-[var(--md-sys-color-tertiary-container)]",
  },
  {
    key: "overweight",
    maximum: 30,
    range: "25.0–29.9",
    tone: "bg-[var(--md-sys-color-primary)]",
    containerTone: "bg-[var(--md-sys-color-primary-container)]",
  },
  {
    key: "obese1",
    maximum: 35,
    range: "30.0–34.9",
    tone: "bg-[var(--md-sys-color-error)]/55",
    containerTone: "bg-[var(--md-sys-color-error-container)]/55",
  },
  {
    key: "obese2",
    maximum: 40,
    range: "35.0–39.9",
    tone: "bg-[var(--md-sys-color-error)]/75",
    containerTone: "bg-[var(--md-sys-color-error-container)]/75",
  },
  {
    key: "obese3",
    maximum: Number.POSITIVE_INFINITY,
    range: "≥ 40.0",
    tone: "bg-[var(--md-sys-color-error)]",
    containerTone: "bg-[var(--md-sys-color-error-container)]",
  },
]

function getBmiCategory(bmi: number): BmiCategory {
  return BMI_CATEGORIES.find((category) => bmi < category.maximum) ?? BMI_CATEGORIES.at(-1)!
}

export default function BMICalculator() {
  const t = useTranslations("bmi")
  const [activeTab, setActiveTab] = useState("metric")
  const [heightCm, setHeightCm] = useState(170)
  const [weightKg, setWeightKg] = useState(70)
  const [heightFt, setHeightFt] = useState(5)
  const [heightIn, setHeightIn] = useState(7)
  const [weightLbs, setWeightLbs] = useState(154)

  const bmi =
    activeTab === "metric"
      ? calculateMetricBmi(heightCm, weightKg)
      : calculateImperialBmi(heightFt, heightIn, weightLbs)
  const category = getBmiCategory(bmi)

  const resetValues = () => {
    setActiveTab("metric")
    setHeightCm(170)
    setWeightKg(70)
    setHeightFt(5)
    setHeightIn(7)
    setWeightLbs(154)
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-4 sm:py-8">
      <div className="mb-6 space-y-2 text-center sm:mb-8">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold text-[var(--md-sys-color-on-surface)] sm:text-3xl">
          <Calculator className="h-7 w-7 sm:h-8 sm:w-8" />
          {t("title")}
        </h1>
        <p className="text-sm text-[var(--md-sys-color-on-surface-variant)] sm:text-base">
          {t("description")}
        </p>
      </div>

      <Alert className="mb-6 border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
        <AlertTriangle className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
        <AlertDescription className="text-[var(--md-sys-color-on-surface-variant)]">
          <strong className="text-[var(--md-sys-color-on-surface)]">{t("disclaimerTitle")}: </strong>
          {t("disclaimer")}
        </AlertDescription>
      </Alert>

      <Card className="card-elevated mb-6">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>{t("bodyData")}</CardTitle>
          <Button variant="ghost" size="sm" onClick={resetValues}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {t("reset")}
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6 grid w-full grid-cols-2">
              <TabsTrigger value="metric">{t("metric")} (cm/kg)</TabsTrigger>
              <TabsTrigger value="imperial">{t("imperial")} (ft/lb)</TabsTrigger>
            </TabsList>

            <TabsContent value="metric" className="space-y-6">
              <MeasurementControl
                id="height-cm"
                label={`${t("height")} (cm)`}
                ariaLabel={t("heightCmAria")}
                value={heightCm}
                min={100}
                max={250}
                step={1}
                unit="cm"
                onValueChange={setHeightCm}
              />
              <MeasurementControl
                id="weight-kg"
                label={`${t("weight")} (kg)`}
                ariaLabel={t("weightKgAria")}
                value={weightKg}
                min={30}
                max={300}
                step={0.5}
                unit="kg"
                onValueChange={setWeightKg}
              />
            </TabsContent>

            <TabsContent value="imperial" className="space-y-6">
              <div>
                <Label className="mb-3 block">{t("height")}</Label>
                <div className="grid gap-5 sm:grid-cols-2">
                  <MeasurementControl
                    id="height-feet"
                    label={t("feet")}
                    ariaLabel={t("heightFeetAria")}
                    value={heightFt}
                    min={3}
                    max={8}
                    step={1}
                    unit="ft"
                    onValueChange={setHeightFt}
                  />
                  <MeasurementControl
                    id="height-inches"
                    label={t("inches")}
                    ariaLabel={t("heightInchesAria")}
                    value={heightIn}
                    min={0}
                    max={11}
                    step={1}
                    unit="in"
                    onValueChange={setHeightIn}
                  />
                </div>
              </div>
              <MeasurementControl
                id="weight-pounds"
                label={`${t("weight")} (lb)`}
                ariaLabel={t("weightPoundsAria")}
                value={weightLbs}
                min={66}
                max={660}
                step={1}
                unit="lb"
                onValueChange={setWeightLbs}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="card-elevated">
        <CardHeader>
          <CardTitle>{t("resultTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6 text-center" aria-live="polite">
            <div className="mb-2 text-5xl font-bold text-[var(--md-sys-color-on-surface)]">{bmi}</div>
            <div className="mb-1 text-xl font-medium text-[var(--md-sys-color-primary)]">
              {t(category.key)}
            </div>
            <div className="text-[var(--md-sys-color-on-surface-variant)]">
              {t(`categoryDescriptions.${category.key}`)}
            </div>
          </div>

          <div className="mb-6">
            <div className="relative mb-3 flex h-8 overflow-hidden rounded-full">
              {BMI_CATEGORIES.map((item) => (
                <div
                  key={item.key}
                  className={`flex-1 ${item.tone}`}
                  title={`${t(item.key)} (${item.range})`}
                />
              ))}
              {bmi > 0 && (
                <div
                  className="absolute top-0 h-8 w-2 -translate-x-1/2 rounded-sm border-2 border-[var(--md-sys-color-on-surface)] bg-[var(--md-sys-color-surface)]"
                  style={{ left: `${Math.min(Math.max(((bmi - 15) / 35) * 100, 0), 100)}%` }}
                  aria-hidden="true"
                />
              )}
            </div>
            <div className="flex justify-between px-1 text-xs text-[var(--md-sys-color-on-surface-variant)]">
              {["15", "18.5", "25", "30", "35", "40", "50"].map((value) => (
                <span key={value}>{value}</span>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BMI_CATEGORIES.map((item) => (
              <div
                key={item.key}
                className={`flex items-center rounded-xl p-3 ${item.containerTone}`}
              >
                <span className={`mr-3 h-4 w-4 shrink-0 rounded-full ${item.tone}`} />
                <span>
                  <span className="block text-sm font-medium text-[var(--md-sys-color-on-surface)]">
                    {t(item.key)}
                  </span>
                  <span className="block text-xs text-[var(--md-sys-color-on-surface-variant)]">
                    {item.range}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Alert className="mt-6 border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
        <Info className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
        <AlertDescription>
          <strong>{t("howToRead")}</strong>
          <ul className="ml-4 mt-2 space-y-1 text-sm text-[var(--md-sys-color-on-surface-variant)]">
            <li>• {t("formula")}</li>
            <li>• {t("adultUse")}</li>
            <li>• {t("screeningNote")}</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  )
}

interface MeasurementControlProps {
  id: string
  label: string
  ariaLabel: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onValueChange: (value: number) => void
}

function MeasurementControl({
  id,
  label,
  ariaLabel,
  value,
  min,
  max,
  step,
  unit,
  onValueChange,
}: MeasurementControlProps) {
  const [draft, setDraft] = useState(value.toString())

  useEffect(() => {
    setDraft(value.toString())
  }, [value])

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <span className="shrink-0 font-medium">{value} {unit}</span>
      </div>
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <Slider
          min={min}
          max={max}
          step={step}
          value={[value]}
          onValueChange={(values) => onValueChange(values[0])}
          className="min-w-0 flex-1"
          aria-label={ariaLabel}
        />
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(event) => {
            const nextDraft = event.target.value
            setDraft(nextDraft)
            const parsed = Number(nextDraft)
            if (Number.isFinite(parsed) && parsed >= min && parsed <= max) onValueChange(parsed)
          }}
          onBlur={() => {
            const parsed = Number(draft)
            const nextValue = clampFiniteNumber(parsed, min, max, value)
            onValueChange(nextValue)
            setDraft(nextValue.toString())
          }}
          className="w-20 shrink-0 sm:w-24"
          aria-label={ariaLabel}
        />
      </div>
    </div>
  )
}
