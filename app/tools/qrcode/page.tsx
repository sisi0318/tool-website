"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useTranslations } from "@/hooks/use-translations"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { QRCodeSVG } from "qrcode.react"
import { Download, Copy, Check, Link, FileText, Phone, Mail, MapPin, Calendar, CreditCard, Settings, ChevronUp, ChevronDown, QrCode, Zap, Palette, Upload } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

// QR Code error correction levels
const errorCorrectionLevels = [
  { value: "L", label: "Low (7%)" },
  { value: "M", label: "Medium (15%)" },
  { value: "Q", label: "Quartile (25%)" },
  { value: "H", label: "High (30%)" },
]

// QR Code content types
type ContentType = "text" | "url" | "contact" | "phone" | "email" | "location" | "event" | "wifi" | "payment"

interface QRCodePageProps {
  params?: Record<string, string>
}

export default function QRCodePage({ params }: QRCodePageProps) {
  const t = useTranslations("qrcode")

  // 基础状态
  const [showQrSettings, setShowQrSettings] = useState(false)
  const [autoGenerate, setAutoGenerate] = useState(true)
  const [showPreview, setShowPreview] = useState(true)
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({})

  // Basic states
  const [contentType, setContentType] = useState<ContentType>("text")
  const [text, setText] = useState("")
  const [url, setUrl] = useState("https://")
  const [qrValue, setQrValue] = useState("")
  const [size, setSize] = useState(200)
  const [fgColor, setFgColor] = useState("#000000")
  const [bgColor, setBgColor] = useState("#FFFFFF")
  const [errorCorrection, setErrorCorrection] = useState("M")
  const [includeMargin, setIncludeMargin] = useState(true)
  const [logoEnabled, setLogoEnabled] = useState(false)
  const [logoSizePercent, setLogoSizePercent] = useState(25) // As percentage of QR code size
  const [logoUrl, setLogoUrl] = useState("")
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)

  // Contact form states
  const [contactName, setContactName] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactAddress, setContactAddress] = useState("")
  const [contactCompany, setContactCompany] = useState("")
  const [contactTitle, setContactTitle] = useState("")
  const [contactWebsite, setContactWebsite] = useState("")

  // Phone state
  const [phoneNumber, setPhoneNumber] = useState("")

  // Email states
  const [emailAddress, setEmailAddress] = useState("")
  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody] = useState("")

  // Location states
  const [latitude, setLatitude] = useState("")
  const [longitude, setLongitude] = useState("")
  const [locationName, setLocationName] = useState("")

  // Event states
  const [eventTitle, setEventTitle] = useState("")
  const [eventLocation, setEventLocation] = useState("")
  const [eventDescription, setEventDescription] = useState("")
  const [eventStartDate, setEventStartDate] = useState("")
  const [eventEndDate, setEventEndDate] = useState("")

  // WiFi states
  const [wifiSsid, setWifiSsid] = useState("")
  const [wifiPassword, setWifiPassword] = useState("")
  const [wifiEncryption, setWifiEncryption] = useState("WPA")
  const [wifiHidden, setWifiHidden] = useState(false)

  // Payment states
  const [paymentName, setPaymentName] = useState("")
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentCurrency, setPaymentCurrency] = useState("USD")
  const [paymentMessage, setPaymentMessage] = useState("")

  // Refs
  const qrCodeRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Generate QR code value based on content type
  useEffect(() => {
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
        value = `bitcoin:?amount=${paymentAmount}&label=${encodeURIComponent(
          paymentName,
        )}&message=${encodeURIComponent(paymentMessage)}`
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

  // Add this new useEffect after the existing QR value generation useEffect
  useEffect(() => {
    // Automatically set higher error correction when logo is enabled
    if (logoEnabled) {
      // Set to highest error correction level when logo is enabled
      setErrorCorrection("H")
    }
  }, [logoEnabled])

  // Handle logo file upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setLogoFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        setLogoDataUrl(dataUrl)
      }
      reader.readAsDataURL(file)
    }
  }

  // Download QR code as PNG
  const downloadQRCode = () => {
    if (!qrCodeRef.current) return

    const svg = qrCodeRef.current.querySelector("svg")
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    const img = new Image()

    img.onload = () => {
      canvas.width = size
      canvas.height = size
      ctx?.drawImage(img, 0, 0)
      const pngFile = canvas.toDataURL("image/png")
      const downloadLink = document.createElement("a")
      downloadLink.download = `qrcode-${new Date().getTime()}.png`
      downloadLink.href = pngFile
      downloadLink.click()
    }

    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`
  }

  // 复制到剪贴板
  const copyToClipboard = (text: string, key: string = "main") => {
    if (!text) return

    navigator.clipboard.writeText(text).then(() => {
      setCopied(prev => ({ ...prev, [key]: true }))

      setTimeout(() => {
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
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  // Get current location for the location tab
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude.toString())
          setLongitude(position.coords.longitude.toString())
        },
        (error) => {
          console.error("Error getting location:", error)
        },
      )
    }
  }

  return (
    <div className="container mx-auto px-4 py-4 max-w-6xl">
      {/* 页面标题 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center justify-center gap-2">
          <QrCode className="h-8 w-8 text-indigo-600" />
          二维码生成器
        </h1>
      </div>

      {/* 二维码设置折叠区域 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowQrSettings(!showQrSettings)}
          className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          <div className="flex items-center gap-2">
            {showQrSettings ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <Settings className="h-4 w-4" />
            <span>二维码设置</span>
            {!showQrSettings && (
              <Badge variant="secondary" className="text-xs ml-auto">
                点击查看
              </Badge>
            )}
          </div>
        </Button>

        {showQrSettings && (
          <Card className="mt-3 card-modern">
            <CardContent className="py-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <Label htmlFor="auto-generate" className="cursor-pointer text-sm">
                    手动生成
                  </Label>
                  <Switch id="auto-generate" checked={autoGenerate} onCheckedChange={setAutoGenerate} />
                  <Label htmlFor="auto-generate" className="cursor-pointer text-sm text-blue-600">
                    自动生成
                  </Label>
                </div>
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <Label htmlFor="show-preview" className="cursor-pointer text-sm">
                    隐藏预览
                  </Label>
                  <Switch id="show-preview" checked={showPreview} onCheckedChange={setShowPreview} />
                  <Label htmlFor="show-preview" className="cursor-pointer text-sm text-green-600">
                    显示预览
                  </Label>
                </div>
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <Label htmlFor="include-margin" className="cursor-pointer text-sm">
                    无边距
                  </Label>
                  <Switch id="include-margin" checked={includeMargin} onCheckedChange={setIncludeMargin} />
                  <Label htmlFor="include-margin" className="cursor-pointer text-sm text-purple-600">
                    包含边距
                  </Label>
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
                <FileText className="h-4 w-4 text-indigo-600" />
                内容类型
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={contentType} onValueChange={(value) => setContentType(value as ContentType)}>
                <TabsList className="grid grid-cols-3 mb-4 h-auto p-1">
                  <TabsTrigger value="text" className="flex items-center gap-1 text-xs py-2">
                    <FileText className="h-3 w-3" />
                    文本
                  </TabsTrigger>
                  <TabsTrigger value="url" className="flex items-center gap-1 text-xs py-2">
                    <Link className="h-3 w-3" />
                    网址
                  </TabsTrigger>
                  <TabsTrigger value="contact" className="flex items-center gap-1 text-xs py-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3 w-3"
                    >
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    联系人
                  </TabsTrigger>
                </TabsList>

                <TabsList className="grid grid-cols-3 mb-4 h-auto p-1">
                  <TabsTrigger value="phone" className="flex items-center gap-1 text-xs py-2">
                    <Phone className="h-3 w-3" />
                    电话
                  </TabsTrigger>
                  <TabsTrigger value="email" className="flex items-center gap-1 text-xs py-2">
                    <Mail className="h-3 w-3" />
                    邮件
                  </TabsTrigger>
                  <TabsTrigger value="location" className="flex items-center gap-1 text-xs py-2">
                    <MapPin className="h-3 w-3" />
                    位置
                  </TabsTrigger>
                </TabsList>

                <TabsList className="grid grid-cols-3 h-auto p-1">
                  <TabsTrigger value="event" className="flex items-center gap-1 text-xs py-2">
                    <Calendar className="h-3 w-3" />
                    事件
                  </TabsTrigger>
                  <TabsTrigger value="wifi" className="flex items-center gap-1 text-xs py-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3 w-3"
                    >
                      <path d="M5 13a10 10 0 0 1 14 0"></path>
                      <path d="M8.5 16.5a5 5 0 0 1 7 0"></path>
                      <path d="M2 8.82a15 15 0 0 1 20 0"></path>
                      <line x1="12" y1="20" x2="12" y2="20"></line>
                    </svg>
                    WiFi
                  </TabsTrigger>
                  <TabsTrigger value="payment" className="flex items-center gap-1 text-xs py-2">
                    <CreditCard className="h-3 w-3" />
                    支付
                  </TabsTrigger>
                </TabsList>

              {/* Text Content */}
              <TabsContent value="text" className="mt-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="text-input" className="text-sm font-medium">文本内容</Label>
                    <Textarea
                      id="text-input"
                      placeholder="输入要生成二维码的文本内容..."
                      value={text}
                      onChange={(e) => setText(e.target.value)}
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
                    <Label htmlFor="url-input" className="text-sm font-medium">网址链接</Label>
                    <Input
                      id="url-input"
                      placeholder="https://example.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
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
                      onChange={(e) => setContactName(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="contact-phone">{t("phone")}</Label>
                      <Input
                        id="contact-phone"
                        placeholder={t("phonePlaceholder")}
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="contact-email">{t("email")}</Label>
                      <Input
                        id="contact-email"
                        placeholder={t("emailPlaceholder")}
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="contact-address">{t("address")}</Label>
                    <Input
                      id="contact-address"
                      placeholder={t("addressPlaceholder")}
                      value={contactAddress}
                      onChange={(e) => setContactAddress(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="contact-company">{t("company")}</Label>
                      <Input
                        id="contact-company"
                        placeholder={t("companyPlaceholder")}
                        value={contactCompany}
                        onChange={(e) => setContactCompany(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="contact-title">{t("title")}</Label>
                      <Input
                        id="contact-title"
                        placeholder={t("titlePlaceholder")}
                        value={contactTitle}
                        onChange={(e) => setContactTitle(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="contact-website">{t("website")}</Label>
                    <Input
                      id="contact-website"
                      placeholder="https://example.com"
                      value={contactWebsite}
                      onChange={(e) => setContactWebsite(e.target.value)}
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
                      onChange={(e) => setPhoneNumber(e.target.value)}
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
                      onChange={(e) => setEmailAddress(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email-subject">{t("subject")}</Label>
                    <Input
                      id="email-subject"
                      placeholder={t("subjectPlaceholder")}
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email-body">{t("body")}</Label>
                    <Textarea
                      id="email-body"
                      placeholder={t("bodyPlaceholder")}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Location Content */}
              <TabsContent value="location" className="mt-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="latitude">{t("latitude")}</Label>
                      <Input
                        id="latitude"
                        placeholder="37.7749"
                        value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="longitude">{t("longitude")}</Label>
                      <Input
                        id="longitude"
                        placeholder="-122.4194"
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="location-name">{t("locationName")}</Label>
                    <Input
                      id="location-name"
                      placeholder={t("locationNamePlaceholder")}
                      value={locationName}
                      onChange={(e) => setLocationName(e.target.value)}
                    />
                  </div>
                  <Button onClick={getCurrentLocation} variant="outline" className="w-full">
                    {t("getCurrentLocation")}
                  </Button>
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
                      onChange={(e) => setEventTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="event-location">{t("eventLocation")}</Label>
                    <Input
                      id="event-location"
                      placeholder={t("eventLocationPlaceholder")}
                      value={eventLocation}
                      onChange={(e) => setEventLocation(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="event-description">{t("eventDescription")}</Label>
                    <Textarea
                      id="event-description"
                      placeholder={t("eventDescriptionPlaceholder")}
                      value={eventDescription}
                      onChange={(e) => setEventDescription(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="event-start-date">{t("startDate")}</Label>
                      <Input
                        id="event-start-date"
                        type="datetime-local"
                        value={eventStartDate}
                        onChange={(e) => setEventStartDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="event-end-date">{t("endDate")}</Label>
                      <Input
                        id="event-end-date"
                        type="datetime-local"
                        value={eventEndDate}
                        onChange={(e) => setEventEndDate(e.target.value)}
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
                      onChange={(e) => setWifiSsid(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="wifi-password">{t("password")}</Label>
                    <Input
                      id="wifi-password"
                      type="password"
                      placeholder={t("passwordPlaceholder")}
                      value={wifiPassword}
                      onChange={(e) => setWifiPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="wifi-encryption">{t("encryption")}</Label>
                    <Select value={wifiEncryption} onValueChange={setWifiEncryption}>
                      <SelectTrigger id="wifi-encryption">
                        <SelectValue placeholder={t("selectEncryption")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WPA">WPA/WPA2</SelectItem>
                        <SelectItem value="WEP">WEP</SelectItem>
                        <SelectItem value="nopass">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="wifi-hidden" checked={wifiHidden} onCheckedChange={setWifiHidden} />
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
                      onChange={(e) => setPaymentName(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="payment-amount">{t("amount")}</Label>
                      <Input
                        id="payment-amount"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="payment-currency">{t("currency")}</Label>
                      <Select value={paymentCurrency} onValueChange={setPaymentCurrency}>
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
                      onChange={(e) => setPaymentMessage(e.target.value)}
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
                <Palette className="h-4 w-4 text-purple-600" />
                样式自定义
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">

                <div>
                  <Label htmlFor="qr-size" className="flex justify-between text-sm font-medium">
                    <span>二维码尺寸</span>
                    <span className="text-indigo-600">{size}px</span>
                  </Label>
                  <Slider
                    id="qr-size"
                    min={100}
                    max={500}
                    step={10}
                    value={[size]}
                    onValueChange={(value) => setSize(value[0])}
                    className="mt-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fg-color" className="text-sm font-medium">前景色</Label>
                    <div className="flex mt-1 gap-2">
                      <Input
                        id="fg-color"
                        type="color"
                        value={fgColor}
                        onChange={(e) => setFgColor(e.target.value)}
                        className="w-12 h-10 p-1 border-2"
                      />
                      <Input
                        type="text"
                        value={fgColor}
                        onChange={(e) => setFgColor(e.target.value)}
                        className="flex-1 h-10"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="bg-color" className="text-sm font-medium">背景色</Label>
                    <div className="flex mt-1 gap-2">
                      <Input
                        id="bg-color"
                        type="color"
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        className="w-12 h-10 p-1 border-2"
                      />
                      <Input
                        type="text"
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        className="flex-1 h-10"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="error-correction" className="text-sm font-medium">容错等级</Label>
                  <Select value={errorCorrection} onValueChange={setErrorCorrection}>
                    <SelectTrigger id="error-correction" className="mt-1 h-10">
                      <SelectValue placeholder="选择容错等级" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="L">低 (7%)</SelectItem>
                      <SelectItem value="M">中 (15%)</SelectItem>
                      <SelectItem value="Q">四分之一 (25%)</SelectItem>
                      <SelectItem value="H">高 (30%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch id="logo-enabled" checked={logoEnabled} onCheckedChange={setLogoEnabled} />
                    <Label htmlFor="logo-enabled" className="text-sm font-medium">添加LOGO</Label>
                  </div>

                  {logoEnabled && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4">
                      <div>
                        <Label htmlFor="logo-size" className="flex justify-between text-sm font-medium">
                          <span>LOGO尺寸</span>
                          <span className="text-purple-600">
                            {logoSizePercent}% ({Math.round((size * logoSizePercent) / 100)}px)
                          </span>
                        </Label>
                        <Slider
                          id="logo-size"
                          min={10}
                          max={30}
                          step={1}
                          value={[logoSizePercent]}
                          onValueChange={(value) => setLogoSizePercent(value[0])}
                          className="mt-2"
                        />
                      </div>

                      <div>
                        <Label htmlFor="logo-url" className="text-sm font-medium">LOGO网址</Label>
                        <Input
                          id="logo-url"
                          placeholder="https://example.com/logo.png"
                          value={logoUrl}
                          onChange={(e) => setLogoUrl(e.target.value)}
                          className="mt-1 h-10"
                        />
                      </div>

                      <div>
                        <Label htmlFor="logo-file" className="text-sm font-medium">或上传文件</Label>
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
                            {logoFile ? logoFile.name : "选择LOGO文件"}
                          </Button>
                        </div>
                      </div>

                      {logoDataUrl && (
                        <div className="flex justify-center p-2 bg-white dark:bg-gray-700 rounded border-2 border-dashed border-gray-300">
                          <img
                            src={logoDataUrl}
                            alt="Logo preview"
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
                  <QrCode className="h-4 w-4 text-indigo-600" />
                  二维码预览
                  {autoGenerate && (
                    <Badge variant="secondary" className="text-xs">
                      <Zap className="h-3 w-3 mr-1" />
                      自动生成
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center space-y-6">
                  {/* 二维码显示区域 */}
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-8 w-full flex justify-center">
                    <div ref={qrCodeRef} className="bg-white p-4 rounded-lg shadow-sm">
                      <QRCodeSVG
                        value={qrValue || " "}
                        size={size}
                        bgColor={bgColor}
                        fgColor={fgColor}
                        level={errorCorrection as "L" | "M" | "Q" | "H"}
                        includeMargin={includeMargin}
                        imageSettings={
                          logoEnabled && (logoUrl || logoDataUrl)
                            ? {
                                src: logoDataUrl || logoUrl,
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
                      下载二维码
                    </Button>
                    
                    {!autoGenerate && (
                      <Button variant="outline" className="w-full h-10">
                        <Zap className="h-4 w-4 mr-2" />
                        手动生成
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
                <FileText className="h-4 w-4 text-green-600" />
                二维码内容
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Label className="text-sm font-medium">编码内容</Label>
                <div className="relative">
                  <Textarea 
                    value={qrValue} 
                    readOnly 
                    rows={4} 
                    className="pr-10 text-sm bg-gray-50 dark:bg-gray-800" 
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
                  <div className="text-xs text-gray-500 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                    <span className="font-medium">内容长度:</span> {qrValue.length} 字符
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
