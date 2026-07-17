"use client"

import { copyTextToClipboard as writeClipboardText } from "@/lib/clipboard"

import type React from "react"

import { useState, useRef, useEffect, useCallback, useReducer } from "react"
import { useTranslations } from "@/hooks/use-translations"
import { useObjectUrl } from "@/hooks/use-object-url"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { QRCodeSVG } from "qrcode.react"
import { Download, Copy, Check, Link, FileText, Phone, Mail, MapPin, Calendar, CreditCard, Settings, ChevronUp, ChevronDown, QrCode, Zap, Palette, Upload, UserRound, Wifi } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  createObjectUrl,
  downloadBlob,
  revokeObjectUrl,
} from "@/lib/object-url"
import { buildPaymentQrValue } from "@/lib/qrcode-tools"

// QR Code content types
type ContentType = "text" | "url" | "contact" | "phone" | "email" | "location" | "event" | "wifi" | "payment"
type ErrorCorrectionLevel = "L" | "M" | "Q" | "H"

const errorCorrectionLevels: Array<{ value: ErrorCorrectionLevel; labelKey: string }> = [
  { value: "L", labelKey: "errorCorrectionLow" },
  { value: "M", labelKey: "errorCorrectionMedium" },
  { value: "Q", labelKey: "errorCorrectionQuartile" },
  { value: "H", labelKey: "errorCorrectionHigh" },
]

const contentTypeOptions = [
  { value: "text", labelKey: "text", Icon: FileText },
  { value: "url", labelKey: "url", Icon: Link },
  { value: "contact", labelKey: "contact", Icon: UserRound },
  { value: "phone", labelKey: "phone", Icon: Phone },
  { value: "email", labelKey: "email", Icon: Mail },
  { value: "location", labelKey: "location", Icon: MapPin },
  { value: "event", labelKey: "event", Icon: Calendar },
  { value: "wifi", labelKey: "wifi", Icon: Wifi },
  { value: "payment", labelKey: "payment", Icon: CreditCard },
] as const

interface QrUiState {
  autoGenerate: boolean
  locationError: string
  logoError: string
  showPreview: boolean
  showQrSettings: boolean
}

interface QrContentState {
  contactAddress: string
  contactCompany: string
  contactEmail: string
  contactName: string
  contactPhone: string
  contactTitle: string
  contactWebsite: string
  contentType: ContentType
  emailAddress: string
  emailBody: string
  emailSubject: string
  eventDescription: string
  eventEndDate: string
  eventLocation: string
  eventStartDate: string
  eventTitle: string
  latitude: string
  locationName: string
  longitude: string
  paymentAmount: string
  paymentCurrency: string
  paymentMessage: string
  paymentName: string
  phoneNumber: string
  text: string
  url: string
  wifiEncryption: string
  wifiHidden: boolean
  wifiPassword: string
  wifiSsid: string
}

interface QrAppearanceState {
  bgColor: string
  errorCorrection: ErrorCorrectionLevel
  fgColor: string
  includeMargin: boolean
  logoEnabled: boolean
  logoFile: File | null
  logoSizePercent: number
  logoUrl: string
  size: number
}

type SetFieldAction<State> = {
  [Field in keyof State]: { field: Field; value: State[Field] }
}[keyof State]

const uiReducer = (state: QrUiState, action: SetFieldAction<QrUiState>): QrUiState => ({
  ...state,
  [action.field]: action.value,
})

const contentReducer = (state: QrContentState, action: SetFieldAction<QrContentState>): QrContentState => ({
  ...state,
  [action.field]: action.value,
})

const appearanceReducer = (
  state: QrAppearanceState,
  action: SetFieldAction<QrAppearanceState>,
): QrAppearanceState => ({
  ...state,
  [action.field]: action.value,
})

const INITIAL_UI_STATE: QrUiState = {
  autoGenerate: true,
  locationError: "",
  logoError: "",
  showPreview: true,
  showQrSettings: false,
}

const INITIAL_CONTENT_STATE: QrContentState = {
  contactAddress: "",
  contactCompany: "",
  contactEmail: "",
  contactName: "",
  contactPhone: "",
  contactTitle: "",
  contactWebsite: "",
  contentType: "text",
  emailAddress: "",
  emailBody: "",
  emailSubject: "",
  eventDescription: "",
  eventEndDate: "",
  eventLocation: "",
  eventStartDate: "",
  eventTitle: "",
  latitude: "",
  locationName: "",
  longitude: "",
  paymentAmount: "",
  paymentCurrency: "USD",
  paymentMessage: "",
  paymentName: "",
  phoneNumber: "",
  text: "",
  url: "https://",
  wifiEncryption: "WPA",
  wifiHidden: false,
  wifiPassword: "",
  wifiSsid: "",
}

const INITIAL_APPEARANCE_STATE: QrAppearanceState = {
  bgColor: "#FFFFFF",
  errorCorrection: "M",
  fgColor: "#000000",
  includeMargin: true,
  logoEnabled: false,
  logoFile: null,
  logoSizePercent: 25,
  logoUrl: "",
  size: 200,
}

export default function QRCodePage() {
  const t = useTranslations("qrcode")
  const [uiState, dispatchUi] = useReducer(uiReducer, INITIAL_UI_STATE)
  const [contentState, dispatchContent] = useReducer(contentReducer, INITIAL_CONTENT_STATE)
  const [appearance, dispatchAppearance] = useReducer(appearanceReducer, INITIAL_APPEARANCE_STATE)
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({})
  const [qrValue, setQrValue] = useState("")
  const previousErrorCorrectionRef = useRef<ErrorCorrectionLevel>("M")
  const logoPreviewUrl = useObjectUrl(appearance.logoFile)

  const { autoGenerate, locationError, logoError, showPreview, showQrSettings } = uiState
  const {
    contactAddress,
    contactCompany,
    contactEmail,
    contactName,
    contactPhone,
    contactTitle,
    contactWebsite,
    contentType,
    emailAddress,
    emailBody,
    emailSubject,
    eventDescription,
    eventEndDate,
    eventLocation,
    eventStartDate,
    eventTitle,
    latitude,
    locationName,
    longitude,
    paymentAmount,
    paymentCurrency,
    paymentMessage,
    paymentName,
    phoneNumber,
    text,
    url,
    wifiEncryption,
    wifiHidden,
    wifiPassword,
    wifiSsid,
  } = contentState
  const {
    bgColor,
    errorCorrection,
    fgColor,
    includeMargin,
    logoEnabled,
    logoFile,
    logoSizePercent,
    logoUrl,
    size,
  } = appearance

  // Refs
  const qrCodeRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const copyTimeoutRef = useRef<number | null>(null)

  // Generate QR code value based on content type
  const generateQrValue = useCallback(() => {
    let value = ""

    switch (contentType) {
      case "text":
        value = text
        break
      case "url":
        value = url
        break
      case "contact":
        // Generate vCard format
        value = `BEGIN:VCARD
VERSION:3.0
N:${contactName}
ORG:${contactCompany}
TITLE:${contactTitle}
TEL:${contactPhone}
EMAIL:${contactEmail}
ADR:${contactAddress}
URL:${contactWebsite}
END:VCARD`
        break
      case "phone":
        value = `tel:${phoneNumber}`
        break
      case "email":
        value = `mailto:${emailAddress}${emailSubject ? `?subject=${encodeURIComponent(emailSubject)}` : ""}${
          emailBody ? `${emailSubject ? "&" : "?"}body=${encodeURIComponent(emailBody)}` : ""
        }`
        break
      case "location":
        value = `geo:${latitude},${longitude}${locationName ? `?q=${encodeURIComponent(locationName)}` : ""}`
        break
      case "event":
        // Format dates for iCalendar
        const formatDate = (dateString: string) => {
          if (!dateString) return ""
          const date = new Date(dateString)
          return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
        }

        const startDate = formatDate(eventStartDate)
        const endDate = formatDate(eventEndDate)

        if (startDate) {
          value = `BEGIN:VEVENT
SUMMARY:${eventTitle}
LOCATION:${eventLocation}
DESCRIPTION:${eventDescription}
DTSTART:${startDate}
DTEND:${endDate || startDate}
END:VEVENT`
        }
        break
      case "wifi":
        value = `WIFI:S:${wifiSsid};T:${wifiEncryption};P:${wifiPassword};H:${wifiHidden ? "true" : "false"};`
        break
      case "payment":
        value = buildPaymentQrValue({
          recipient: paymentName,
          amount: paymentAmount,
          currency: paymentCurrency,
          message: paymentMessage,
        })
        break
      default:
        value = text
    }

    setQrValue(value)
  }, [
    contentType,
    text,
    url,
    contactName,
    contactPhone,
    contactEmail,
    contactAddress,
    contactCompany,
    contactTitle,
    contactWebsite,
    phoneNumber,
    emailAddress,
    emailSubject,
    emailBody,
    latitude,
    longitude,
    locationName,
    eventTitle,
    eventLocation,
    eventDescription,
    eventStartDate,
    eventEndDate,
    wifiSsid,
    wifiPassword,
    wifiEncryption,
    wifiHidden,
    paymentName,
    paymentAmount,
    paymentCurrency,
    paymentMessage,
  ])

  useEffect(() => {
    if (autoGenerate) generateQrValue()
  }, [autoGenerate, generateQrValue])

  const handleLogoEnabledChange = (enabled: boolean) => {
    if (enabled) {
      previousErrorCorrectionRef.current = errorCorrection
      dispatchAppearance({ field: "errorCorrection", value: "H" })
    } else {
      dispatchAppearance({ field: "errorCorrection", value: previousErrorCorrectionRef.current })
    }
    dispatchAppearance({ field: "logoEnabled", value: enabled })
  }

  // Handle logo file upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    if (!file.type.startsWith("image/")) {
      dispatchUi({ field: "logoError", value: t("logoImageRequired") })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      dispatchUi({ field: "logoError", value: t("logoTooLarge") })
      return
    }

    dispatchUi({ field: "logoError", value: "" })
    dispatchAppearance({ field: "logoFile", value: file })
  }

  // Download QR code as PNG
  const downloadQRCode = () => {
    if (!qrCodeRef.current) return

    const svg = qrCodeRef.current.querySelector("svg")
    if (!svg) return

    const svgClone = svg.cloneNode(true) as SVGSVGElement
    svgClone.querySelectorAll("image").forEach((image) => image.remove())
    const svgData = new XMLSerializer().serializeToString(svgClone)
    const svgBlobUrl = createObjectUrl(new Blob([svgData], { type: "image/svg+xml;charset=utf-8" }))
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    const img = new Image()

    img.onload = () => {
      revokeObjectUrl(svgBlobUrl)
      canvas.width = size
      canvas.height = size
      if (!ctx) return
      ctx.drawImage(img, 0, 0, size, size)

      const finishDownload = () => {
        canvas.toBlob((blob) => {
          if (!blob) return
          downloadBlob(blob, `qrcode-${Date.now()}.png`)
        }, "image/png")
      }

      const logoSource = logoEnabled ? (logoPreviewUrl || logoUrl) : ""
      if (!logoSource) {
        finishDownload()
        return
      }

      const logo = new Image()
      if (!logoSource.startsWith("data:")) logo.crossOrigin = "anonymous"
      logo.onload = () => {
        const logoSize = Math.round((size * logoSizePercent) / 100)
        const offset = Math.round((size - logoSize) / 2)
        ctx.drawImage(logo, offset, offset, logoSize, logoSize)
        finishDownload()
      }
      logo.onerror = finishDownload
      logo.src = logoSource
    }
    img.onerror = () => revokeObjectUrl(svgBlobUrl)

    img.src = svgBlobUrl
  }

  // 复制到剪贴板
  const copyToClipboard = (text: string, key: string = "main") => {
    if (!text) return

    void writeClipboardText(text).then((success) => {
      if (!success) return
      setCopied(prev => ({ ...prev, [key]: true }))

      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopied(prev => ({ ...prev, [key]: false }))
      }, 2000)
    })
  }

  // Copy QR code value to clipboard
  const copyQrValue = () => {
    copyToClipboard(qrValue, "qrvalue")
  }

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  // Get current location for the location tab
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      dispatchUi({ field: "locationError", value: t("geolocationUnavailable") })
      return
    }

    dispatchUi({ field: "locationError", value: "" })
    navigator.geolocation.getCurrentPosition(
      (position) => {
        dispatchContent({ field: "latitude", value: position.coords.latitude.toString() })
        dispatchContent({ field: "longitude", value: position.coords.longitude.toString() })
      },
      () => {
        dispatchUi({ field: "locationError", value: t("geolocationFailed") })
      },
    )
  }

  return (
    <div className="container mx-auto max-w-6xl px-3 py-4 sm:px-4">
      {/* 页面标题 */}
      <div className="text-center mb-8">
        <h1 className="mb-4 flex items-center justify-center gap-2 text-2xl font-bold text-[var(--md-sys-color-on-surface)] sm:text-3xl">
          <QrCode className="h-8 w-8 text-[var(--md-sys-color-primary)]" />
          {t("title")}
        </h1>
      </div>

      {/* 二维码设置折叠区域 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => dispatchUi({ field: "showQrSettings", value: !showQrSettings })}
          className="w-full text-sm text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
        >
          <div className="flex items-center gap-2">
            {showQrSettings ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <Settings className="h-4 w-4" />
            <span>{t("settings")}</span>
            {!showQrSettings && (
              <Badge variant="secondary" className="text-xs ml-auto">
                {t("clickToView")}
              </Badge>
            )}
          </div>
        </Button>

        {showQrSettings && (
          <Card className="mt-3 card-modern">
            <CardContent className="py-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-3">
                  <Label htmlFor="auto-generate" className="cursor-pointer text-sm">
                    {t("autoGenerate")}
                  </Label>
                  <Switch id="auto-generate" checked={autoGenerate} onCheckedChange={(value) => dispatchUi({ field: "autoGenerate", value })} />
                </div>
                <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-3">
                  <Label htmlFor="show-preview" className="cursor-pointer text-sm">
                    {t("showPreview")}
                  </Label>
                  <Switch id="show-preview" checked={showPreview} onCheckedChange={(value) => dispatchUi({ field: "showPreview", value })} />
                </div>
                <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-3">
                  <Label htmlFor="include-margin" className="cursor-pointer text-sm">
                    {t("includeMargin")}
                  </Label>
                  <Switch id="include-margin" checked={includeMargin} onCheckedChange={(value) => dispatchAppearance({ field: "includeMargin", value })} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left column - QR Code content input */}
        <div className="space-y-6">
          {/* 内容类型选择 */}
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
                {t("contentType")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={contentType} onValueChange={(value) => dispatchContent({ field: "contentType", value: value as ContentType })}>
                <TabsList className="mb-4 grid h-auto grid-cols-3 gap-1 p-1">
                  {contentTypeOptions.map(({ value, labelKey, Icon }) => (
                    <TabsTrigger key={value} value={value} className="flex min-h-10 min-w-0 items-center justify-center gap-1 px-1 py-2 text-xs">
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{t(labelKey)}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>

              {/* Text Content */}
              <TabsContent value="text" className="mt-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="text-input" className="text-sm font-medium">{t("textContent")}</Label>
                    <Textarea
                      id="text-input"
                      placeholder={t("textPlaceholder")}
                      value={text}
                      onChange={(e) => dispatchContent({ field: "text", value: e.target.value })}
                      rows={6}
                      className="mt-1"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* URL Content */}
              <TabsContent value="url" className="mt-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="url-input" className="text-sm font-medium">{t("urlContent")}</Label>
                    <Input
                      id="url-input"
                      placeholder="https://example.com"
                      value={url}
                      onChange={(e) => dispatchContent({ field: "url", value: e.target.value })}
                      className="mt-1 h-10"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Contact Content */}
              <TabsContent value="contact" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="contact-name">{t("name")}</Label>
                    <Input
                      id="contact-name"
                      placeholder={t("namePlaceholder")}
                      value={contactName}
                      onChange={(e) => dispatchContent({ field: "contactName", value: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="contact-phone">{t("phone")}</Label>
                      <Input
                        id="contact-phone"
                        placeholder={t("phonePlaceholder")}
                        value={contactPhone}
                        onChange={(e) => dispatchContent({ field: "contactPhone", value: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="contact-email">{t("email")}</Label>
                      <Input
                        id="contact-email"
                        placeholder={t("emailPlaceholder")}
                        value={contactEmail}
                        onChange={(e) => dispatchContent({ field: "contactEmail", value: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="contact-address">{t("address")}</Label>
                    <Input
                      id="contact-address"
                      placeholder={t("addressPlaceholder")}
                      value={contactAddress}
                      onChange={(e) => dispatchContent({ field: "contactAddress", value: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="contact-company">{t("company")}</Label>
                      <Input
                        id="contact-company"
                        placeholder={t("companyPlaceholder")}
                        value={contactCompany}
                        onChange={(e) => dispatchContent({ field: "contactCompany", value: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="contact-title">{t("jobTitle")}</Label>
                      <Input
                        id="contact-title"
                        placeholder={t("titlePlaceholder")}
                        value={contactTitle}
                        onChange={(e) => dispatchContent({ field: "contactTitle", value: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="contact-website">{t("website")}</Label>
                    <Input
                      id="contact-website"
                      placeholder="https://example.com"
                      value={contactWebsite}
                      onChange={(e) => dispatchContent({ field: "contactWebsite", value: e.target.value })}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Phone Content */}
              <TabsContent value="phone" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="phone-number">{t("phoneNumber")}</Label>
                    <Input
                      id="phone-number"
                      placeholder="+1234567890"
                      value={phoneNumber}
                      onChange={(e) => dispatchContent({ field: "phoneNumber", value: e.target.value })}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Email Content */}
              <TabsContent value="email" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email-address">{t("emailAddress")}</Label>
                    <Input
                      id="email-address"
                      placeholder="example@example.com"
                      value={emailAddress}
                      onChange={(e) => dispatchContent({ field: "emailAddress", value: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email-subject">{t("subject")}</Label>
                    <Input
                      id="email-subject"
                      placeholder={t("subjectPlaceholder")}
                      value={emailSubject}
                      onChange={(e) => dispatchContent({ field: "emailSubject", value: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email-body">{t("body")}</Label>
                    <Textarea
                      id="email-body"
                      placeholder={t("bodyPlaceholder")}
                      value={emailBody}
                      onChange={(e) => dispatchContent({ field: "emailBody", value: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Location Content */}
              <TabsContent value="location" className="mt-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="latitude">{t("latitude")}</Label>
                      <Input
                        id="latitude"
                        placeholder="37.7749"
                        value={latitude}
                        onChange={(e) => dispatchContent({ field: "latitude", value: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="longitude">{t("longitude")}</Label>
                      <Input
                        id="longitude"
                        placeholder="-122.4194"
                        value={longitude}
                        onChange={(e) => dispatchContent({ field: "longitude", value: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="location-name">{t("locationName")}</Label>
                    <Input
                      id="location-name"
                      placeholder={t("locationNamePlaceholder")}
                      value={locationName}
                      onChange={(e) => dispatchContent({ field: "locationName", value: e.target.value })}
                    />
                  </div>
                  <Button onClick={getCurrentLocation} variant="outline" className="w-full">
                    {t("getCurrentLocation")}
                  </Button>
                  {locationError && (
                    <p className="rounded-xl bg-[var(--md-sys-color-error-container)] px-3 py-2 text-sm text-[var(--md-sys-color-on-error-container)]">
                      {locationError}
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* Event Content */}
              <TabsContent value="event" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="event-title">{t("eventTitle")}</Label>
                    <Input
                      id="event-title"
                      placeholder={t("eventTitlePlaceholder")}
                      value={eventTitle}
                      onChange={(e) => dispatchContent({ field: "eventTitle", value: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="event-location">{t("eventLocation")}</Label>
                    <Input
                      id="event-location"
                      placeholder={t("eventLocationPlaceholder")}
                      value={eventLocation}
                      onChange={(e) => dispatchContent({ field: "eventLocation", value: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="event-description">{t("eventDescription")}</Label>
                    <Textarea
                      id="event-description"
                      placeholder={t("eventDescriptionPlaceholder")}
                      value={eventDescription}
                      onChange={(e) => dispatchContent({ field: "eventDescription", value: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="event-start-date">{t("startDate")}</Label>
                      <Input
                        id="event-start-date"
                        type="datetime-local"
                        value={eventStartDate}
                        onChange={(e) => dispatchContent({ field: "eventStartDate", value: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="event-end-date">{t("endDate")}</Label>
                      <Input
                        id="event-end-date"
                        type="datetime-local"
                        value={eventEndDate}
                        onChange={(e) => dispatchContent({ field: "eventEndDate", value: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* WiFi Content */}
              <TabsContent value="wifi" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="wifi-ssid">{t("networkName")}</Label>
                    <Input
                      id="wifi-ssid"
                      placeholder={t("networkNamePlaceholder")}
                      value={wifiSsid}
                      onChange={(e) => dispatchContent({ field: "wifiSsid", value: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="wifi-password">{t("password")}</Label>
                    <Input
                      id="wifi-password"
                      type="password"
                      placeholder={t("passwordPlaceholder")}
                      value={wifiPassword}
                      onChange={(e) => dispatchContent({ field: "wifiPassword", value: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="wifi-encryption">{t("encryption")}</Label>
                    <Select value={wifiEncryption} onValueChange={(value) => dispatchContent({ field: "wifiEncryption", value })}>
                      <SelectTrigger id="wifi-encryption">
                        <SelectValue placeholder={t("selectEncryption")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WPA">WPA/WPA2</SelectItem>
                        <SelectItem value="WEP">WEP</SelectItem>
                        <SelectItem value="nopass">{t("noEncryption")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="wifi-hidden" checked={wifiHidden} onCheckedChange={(value) => dispatchContent({ field: "wifiHidden", value })} />
                    <Label htmlFor="wifi-hidden">{t("hiddenNetwork")}</Label>
                  </div>
                </div>
              </TabsContent>

              {/* Payment Content */}
              <TabsContent value="payment" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="payment-name">{t("recipientName")}</Label>
                    <Input
                      id="payment-name"
                      placeholder={t("recipientNamePlaceholder")}
                      value={paymentName}
                      onChange={(e) => dispatchContent({ field: "paymentName", value: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="payment-amount">{t("amount")}</Label>
                      <Input
                        id="payment-amount"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={paymentAmount}
                        onChange={(e) => dispatchContent({ field: "paymentAmount", value: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="payment-currency">{t("currency")}</Label>
                      <Select value={paymentCurrency} onValueChange={(value) => dispatchContent({ field: "paymentCurrency", value })}>
                        <SelectTrigger id="payment-currency">
                          <SelectValue placeholder={t("selectCurrency")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                          <SelectItem value="JPY">JPY</SelectItem>
                          <SelectItem value="CNY">CNY</SelectItem>
                          <SelectItem value="BTC">BTC</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="payment-message">{t("message")}</Label>
                    <Input
                      id="payment-message"
                      placeholder={t("messagePlaceholder")}
                      value={paymentMessage}
                      onChange={(e) => dispatchContent({ field: "paymentMessage", value: e.target.value })}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            </CardContent>
          </Card>

          {/* QR Code Customization */}
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4 text-[var(--md-sys-color-tertiary)]" />
                {t("customization")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">

                <div>
                  <Label htmlFor="qr-size" className="flex justify-between text-sm font-medium">
                    <span>{t("qrSize")}</span>
                    <span className="text-[var(--md-sys-color-primary)]">{size}px</span>
                  </Label>
                  <Slider
                    id="qr-size"
                    min={100}
                    max={500}
                    step={10}
                    value={[size]}
                    onValueChange={(value) => dispatchAppearance({ field: "size", value: value[0] })}
                    className="mt-2"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="fg-color" className="text-sm font-medium">{t("foregroundColor")}</Label>
                    <div className="flex mt-1 gap-2">
                      <Input
                        id="fg-color"
                        type="color"
                        value={fgColor}
                        onChange={(e) => dispatchAppearance({ field: "fgColor", value: e.target.value })}
                        className="w-12 h-10 p-1 border-2"
                      />
                      <Input
                        type="text"
                        value={fgColor}
                        onChange={(e) => dispatchAppearance({ field: "fgColor", value: e.target.value })}
                        className="flex-1 h-10"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="bg-color" className="text-sm font-medium">{t("backgroundColor")}</Label>
                    <div className="flex mt-1 gap-2">
                      <Input
                        id="bg-color"
                        type="color"
                        value={bgColor}
                        onChange={(e) => dispatchAppearance({ field: "bgColor", value: e.target.value })}
                        className="w-12 h-10 p-1 border-2"
                      />
                      <Input
                        type="text"
                        value={bgColor}
                        onChange={(e) => dispatchAppearance({ field: "bgColor", value: e.target.value })}
                        className="flex-1 h-10"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="error-correction" className="text-sm font-medium">{t("errorCorrection")}</Label>
                  <Select value={errorCorrection} onValueChange={(value) => dispatchAppearance({ field: "errorCorrection", value: value as ErrorCorrectionLevel })} disabled={logoEnabled}>
                    <SelectTrigger id="error-correction" className="mt-1 h-10">
                      <SelectValue placeholder={t("selectErrorCorrection")} />
                    </SelectTrigger>
                    <SelectContent>
                      {errorCorrectionLevels.map((level) => (
                        <SelectItem key={level.value} value={level.value}>{t(level.labelKey)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {logoEnabled && (
                    <p className="mt-1 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                      {t("logoErrorCorrectionHint")}
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch id="logo-enabled" checked={logoEnabled} onCheckedChange={handleLogoEnabledChange} />
                    <Label htmlFor="logo-enabled" className="text-sm font-medium">{t("includeLogo")}</Label>
                  </div>

                  {logoEnabled && (
                    <div className="space-y-4 rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-4">
                      <div>
                        <Label htmlFor="logo-size" className="flex justify-between text-sm font-medium">
                          <span>{t("logoSize")}</span>
                          <span className="text-[var(--md-sys-color-tertiary)]">
                            {logoSizePercent}% ({Math.round((size * logoSizePercent) / 100)}px)
                          </span>
                        </Label>
                        <Slider
                          id="logo-size"
                          min={10}
                          max={30}
                          step={1}
                          value={[logoSizePercent]}
                          onValueChange={(value) => dispatchAppearance({ field: "logoSizePercent", value: value[0] })}
                          className="mt-2"
                        />
                      </div>

                      <div>
                        <Label htmlFor="logo-url" className="text-sm font-medium">{t("logoUrl")}</Label>
                        <Input
                          id="logo-url"
                          placeholder="https://example.com/logo.png"
                          value={logoUrl}
                          onChange={(e) => dispatchAppearance({ field: "logoUrl", value: e.target.value })}
                          className="mt-1 h-10"
                        />
                      </div>

                      <div>
                        <Label htmlFor="logo-file" className="text-sm font-medium">{t("orUploadLogo")}</Label>
                        <div className="flex items-center mt-1">
                          <Input
                            id="logo-file"
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            onChange={handleLogoUpload}
                            className="hidden"
                          />
                          <Button
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full justify-center h-10"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {logoFile ? logoFile.name : t("chooseLogo")}
                          </Button>
                        </div>
                        {logoError && (
                          <p className="mt-2 rounded-xl bg-[var(--md-sys-color-error-container)] px-3 py-2 text-sm text-[var(--md-sys-color-on-error-container)]">
                            {logoError}
                          </p>
                        )}
                      </div>

                      {logoPreviewUrl && (
                        <div className="flex justify-center rounded border-2 border-dashed border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-lowest)] p-2">
                          <img
                            src={logoPreviewUrl}
                            alt={t("logoPreview")}
                            className="max-h-16 object-contain"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column - QR Code preview */}
        <div className="space-y-6">
          {showPreview && (
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
                  {t("preview")}
                  {autoGenerate && (
                    <Badge variant="secondary" className="text-xs">
                      <Zap className="h-3 w-3 mr-1" />
                      {t("autoGenerate")}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center space-y-6">
                  {/* 二维码显示区域 */}
                  <div className="flex w-full overflow-auto rounded-2xl bg-[var(--md-sys-color-surface-container-low)] p-4 sm:p-8">
                    <div
                      ref={qrCodeRef}
                      className="mx-auto w-max rounded-lg p-4 shadow-sm"
                      style={{ backgroundColor: bgColor }}
                    >
                      <QRCodeSVG
                        value={qrValue || " "}
                        size={size}
                        bgColor={bgColor}
                        fgColor={fgColor}
                        level={errorCorrection}
                        includeMargin={includeMargin}
                        imageSettings={
                          logoEnabled && (logoUrl || logoPreviewUrl)
                            ? {
                                src: logoPreviewUrl || logoUrl,
                                x: undefined,
                                y: undefined,
                                height: Math.round((size * logoSizePercent) / 100),
                                width: Math.round((size * logoSizePercent) / 100),
                                excavate: true,
                              }
                            : undefined
                        }
                      />
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="w-full space-y-3">
                    <Button onClick={downloadQRCode} className="w-full h-12" size="lg">
                      <Download className="h-4 w-4 mr-2" />
                      {t("downloadQRCode")}
                    </Button>
                    
                    {!autoGenerate && (
                      <Button variant="outline" className="w-full h-10" onClick={generateQrValue}>
                        <Zap className="h-4 w-4 mr-2" />
                        {t("manualGenerate")}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 二维码内容 */}
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--md-sys-color-success)]" />
                {t("qrCodeValue")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Label className="text-sm font-medium">{t("encodedContent")}</Label>
                <div className="relative">
                  <Textarea 
                    value={qrValue} 
                    readOnly 
                    rows={4} 
                    className="bg-[var(--md-sys-color-surface-container-low)] pr-10 text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-2"
                    onClick={copyQrValue}
                  >
                    {copied.qrvalue ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                
                {qrValue && (
                  <div className="rounded bg-[var(--md-sys-color-secondary-container)] p-2 text-xs text-[var(--md-sys-color-on-secondary-container)]">
                    {t("contentLength").replace("{count}", String(qrValue.length))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
