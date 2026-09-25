"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import {
  Copy, Plus, Trash2, Key, Clock, Shield,
  Link2, Eye, EyeOff, RefreshCw
} from "lucide-react"
import { CircularProgress } from "@/components/ui/circular-progress"
import { ToastAction } from "@/components/ui/toast"
import { useToolActivity } from "@/components/tool-activity"
import { createClientId } from "@/lib/client-id"
import { copyTextToClipboard } from "@/lib/clipboard"
import { readLocalStorage, removeLocalStorage, writeLocalStorage } from "@/lib/safe-storage"
import {
  generateTotp,
  getTotpTimeRemaining,
  normalizeBase32Secret,
  parseOtpauthUri,
  TOTP_ALGORITHMS,
  type OtpauthParseError,
  type TotpAlgorithm,
} from "@/lib/totp-tools"
import { useTranslations } from "@/hooks/use-translations"

interface TOTPAccount {
  id: string
  name: string
  issuer: string
  secret: string
  digits: number
  period: number
  /** 旧数据没有这个字段，按 SHA1 处理 */
  algorithm?: TotpAlgorithm
}

const TOTP_DIGITS = [6, 7, 8] as const
const selectClassName = "h-10 w-full rounded-lg border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface)] px-3 text-sm text-[var(--md-sys-color-on-surface)]"

export default function TOTPPage() {
  const { toast } = useToast()
  const t = useTranslations("totp")
  const isToolActive = useToolActivity()
  const [accounts, setAccounts] = useState<TOTPAccount[]>([])
  const [codes, setCodes] = useState<Record<string, string>>({})
  const [timeLeft, setTimeLeft] = useState<Record<string, number>>({})
  const lastCountersRef = useRef<Record<string, number>>({})
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  
  // 添加账户表单
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState("")
  const [newIssuer, setNewIssuer] = useState("")
  const [newSecret, setNewSecret] = useState("")
  const [newAlgorithm, setNewAlgorithm] = useState<TotpAlgorithm>("SHA1")
  const [newDigits, setNewDigits] = useState<number>(6)
  const [newPeriod, setNewPeriod] = useState("30")
  const [addError, setAddError] = useState("")
  const [importUri, setImportUri] = useState("")
  const [importError, setImportError] = useState("")
  const [isStorageLoaded, setIsStorageLoaded] = useState(false)

  // 生成所有账户的验证码
  const generateAllCodes = useCallback(async (accountList: TOTPAccount[], timestamp?: number) => {
    const newCodes: Record<string, string> = {}
    for (const account of accountList) {
      try {
        newCodes[account.id] = await generateTotp(account.secret, account.period, account.digits, timestamp, account.algorithm ?? "SHA1")
      } catch {
        newCodes[account.id] = '------'
      }
    }
    setCodes(newCodes)
  }, [])

  // 定时更新验证码
  useEffect(() => {
    if (!isToolActive) return
    if (accounts.length === 0) {
      setTimeLeft({})
      lastCountersRef.current = {}
      return
    }
    
    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000)
      const nextTimeLeft: Record<string, number> = {}
      const nextCounters: Record<string, number> = {}
      let shouldRegenerate = false

      for (const account of accounts) {
        const period = Number.isInteger(account.period) && account.period > 0 ? account.period : 30
        nextTimeLeft[account.id] = getTotpTimeRemaining(now, period)
        nextCounters[account.id] = Math.floor(now / period)
        if (lastCountersRef.current[account.id] !== nextCounters[account.id]) {
          shouldRegenerate = true
        }
      }

      setTimeLeft(nextTimeLeft)
      lastCountersRef.current = nextCounters

      if (shouldRegenerate) {
        void generateAllCodes(accounts, now)
      }
    }
    
    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [accounts, generateAllCodes, isToolActive])

  // 从 localStorage 加载账户
  useEffect(() => {
    const saved = readLocalStorage('totp_accounts')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) setAccounts(parsed)
      } catch {
        removeLocalStorage("totp_accounts")
      }
    }
    setIsStorageLoaded(true)
  }, [])

  // 保存账户到 localStorage
  useEffect(() => {
    if (!isStorageLoaded) return
    if (accounts.length > 0) {
      writeLocalStorage("totp_accounts", JSON.stringify(accounts))
    } else {
      removeLocalStorage("totp_accounts")
    }
  }, [accounts, isStorageLoaded])

  const invalidSecretMessage = useCallback(
    (characters: string[]) => t("invalidSecretCharacters").replace("{chars}", characters.join(" ")),
    [t],
  )

  // 添加账户
  const addAccount = useCallback(() => {
    const secret = normalizeBase32Secret(newSecret)
    if (!newName.trim() || (secret.ok && !secret.secret)) {
      setAddError(t("missingFields"))
      return
    }
    if (!secret.ok) {
      setAddError(invalidSecretMessage(secret.invalidCharacters))
      return
    }
    const period = Number(newPeriod)
    if (!Number.isInteger(period) || period <= 0) {
      setAddError(t("invalidPeriod"))
      return
    }

    const account: TOTPAccount = {
      id: createClientId("totp"),
      name: newName.trim(),
      issuer: newIssuer.trim(),
      secret: secret.secret,
      digits: newDigits,
      period,
      algorithm: newAlgorithm,
    }

    setAccounts(prev => [...prev, account])
    setNewName("")
    setNewIssuer("")
    setNewSecret("")
    setAddError("")
    setShowAddForm(false)
    toast({ title: t("accountAdded") })
  }, [invalidSecretMessage, newAlgorithm, newDigits, newIssuer, newName, newPeriod, newSecret, t, toast])

  // 从 URI 导入
  const importFromUri = useCallback(() => {
    const result = parseOtpauthUri(importUri)
    if (!result.ok) {
      const messages: Record<OtpauthParseError, string> = {
        invalidUri: t("invalidUri"),
        unsupportedType: t("unsupportedType").replace("{type}", result.detail ?? ""),
        missingSecret: t("missingSecret"),
        invalidSecret: invalidSecretMessage((result.detail ?? "").split(" ")),
        unsupportedAlgorithm: t("unsupportedAlgorithm").replace("{algorithm}", result.detail ?? ""),
      }
      setImportError(messages[result.error])
      return
    }

    const parsed = result.account
    const account: TOTPAccount = {
      id: createClientId("totp"),
      name: parsed.name || t("unknownAccount"),
      issuer: parsed.issuer,
      secret: parsed.secret,
      digits: parsed.digits,
      period: parsed.period,
      algorithm: parsed.algorithm,
    }

    setAccounts(prev => [...prev, account])
    setImportUri("")
    setImportError("")
    setShowAddForm(false)
    toast({ title: t("accountImported") })
  }, [importUri, invalidSecretMessage, t, toast])

  // 删除账户：立即生效，提示里可以撤销（密钥只存在本机，删了就找不回来）
  const deleteAccount = useCallback((account: TOTPAccount) => {
    const index = accounts.findIndex(a => a.id === account.id)
    setAccounts(prev => prev.filter(a => a.id !== account.id))
    toast({
      title: t("accountDeleted"),
      description: account.issuer ? `${account.issuer} · ${account.name}` : account.name,
      duration: 8000,
      action: (
        <ToastAction
          altText={t("undo")}
          onClick={() => setAccounts(prev => (
            prev.some(a => a.id === account.id)
              ? prev
              : [...prev.slice(0, Math.max(index, 0)), account, ...prev.slice(Math.max(index, 0))]
          ))}
        >
          {t("undo")}
        </ToastAction>
      ),
    })
  }, [accounts, t, toast])

  // 复制验证码
  const copyCode = useCallback(async (code: string) => {
    try {
      if (!await copyTextToClipboard(code)) throw new Error("Clipboard unavailable")
      toast({ title: t("copied"), description: t("copiedDescription") })
    } catch {
      toast({ title: t("copyFailed"), variant: "destructive" })
    }
  }, [t, toast])

  // 切换密钥显示
  const toggleSecret = useCallback((id: string) => {
    setShowSecrets(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])

  return (
    <div className="container mx-auto max-w-4xl px-4 py-4 sm:py-6">
      {/* 页面标题 */}
      <div className="text-center space-y-4 mb-8">
        <h1 className="text-3xl font-bold text-[var(--md-sys-color-on-surface)]">
          {t("title")}
        </h1>
        <p className="text-[var(--md-sys-color-on-surface-variant)] max-w-2xl mx-auto">
          {t("description")}
        </p>
      </div>

      <div className="space-y-6">
        {/* 添加账户按钮 */}
        <div className="flex justify-end">
          <Button onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="h-4 w-4 mr-2" />
            {t("addAccount")}
          </Button>
        </div>

        {/* 添加账户表单 */}
        {showAddForm && (
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-[var(--md-sys-color-on-surface)]">{t("addNewAccount")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 手动添加 */}
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  addAccount()
                }}
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="totp-name">{t("accountName")}</Label>
                    <Input
                      id="totp-name"
                      placeholder={t("accountNamePlaceholder")}
                      value={newName}
                      onChange={(e) => { setNewName(e.target.value); setAddError("") }}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="totp-issuer">{t("issuer")}</Label>
                    <Input
                      id="totp-issuer"
                      placeholder={t("issuerPlaceholder")}
                      value={newIssuer}
                      onChange={(e) => setNewIssuer(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totp-secret">{t("secret")}</Label>
                  <Input
                    id="totp-secret"
                    placeholder={t("secretPlaceholder")}
                    value={newSecret}
                    onChange={(e) => { setNewSecret(e.target.value); setAddError("") }}
                    aria-invalid={addError ? true : undefined}
                    aria-describedby={addError ? "totp-add-error" : undefined}
                    className="font-mono"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <details className="rounded-lg border border-[var(--md-sys-color-outline-variant)] px-3 py-2">
                  <summary className="cursor-pointer text-sm text-[var(--md-sys-color-on-surface-variant)]">{t("advancedOptions")}</summary>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="totp-algorithm">{t("algorithm")}</Label>
                      <select id="totp-algorithm" className={selectClassName} value={newAlgorithm} onChange={(e) => setNewAlgorithm(e.target.value as TotpAlgorithm)}>
                        {TOTP_ALGORITHMS.map((algorithm) => <option key={algorithm} value={algorithm}>{algorithm}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="totp-digits">{t("digits")}</Label>
                      <select id="totp-digits" className={selectClassName} value={newDigits} onChange={(e) => setNewDigits(Number(e.target.value))}>
                        {TOTP_DIGITS.map((digits) => <option key={digits} value={digits}>{digits}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="totp-period">{t("period")}</Label>
                      <Input id="totp-period" inputMode="numeric" value={newPeriod} onChange={(e) => { setNewPeriod(e.target.value); setAddError("") }} />
                    </div>
                  </div>
                </details>
                {addError && (
                  <p id="totp-add-error" role="alert" className="text-sm text-[var(--md-sys-color-error)]">{addError}</p>
                )}
                <Button type="submit">{t("addAccount")}</Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-[var(--md-sys-color-outline-variant)]" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[var(--md-sys-color-surface)] px-2 text-[var(--md-sys-color-on-surface-variant)]">
                    {t("or")}
                  </span>
                </div>
              </div>

              {/* URI 导入 */}
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  importFromUri()
                }}
              >
                <Label htmlFor="totp-uri">{t("importFromUri")}</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="totp-uri"
                    placeholder="otpauth://totp/..."
                    value={importUri}
                    onChange={(e) => { setImportUri(e.target.value); setImportError("") }}
                    aria-invalid={importError ? true : undefined}
                    aria-describedby={importError ? "totp-import-error" : undefined}
                    className="font-mono text-sm"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <Button type="submit" variant="outline" className="shrink-0">
                    <Link2 className="h-4 w-4 mr-2" />
                    {t("import")}
                  </Button>
                </div>
                {importError && (
                  <p id="totp-import-error" role="alert" className="text-sm text-[var(--md-sys-color-error)]">{importError}</p>
                )}
              </form>
            </CardContent>
          </Card>
        )}

        {/* 账户列表 */}
        {accounts.length === 0 ? (
          <Card className="card-elevated">
            <CardContent className="py-16 text-center">
              <Shield className="mx-auto h-16 w-16 text-[var(--md-sys-color-on-surface-variant)] mb-4" />
              <h3 className="text-lg font-medium text-[var(--md-sys-color-on-surface)] mb-2">
                {t("noAccounts")}
              </h3>
              <p className="text-[var(--md-sys-color-on-surface-variant)]">
                {t("noAccountsHint")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {accounts.map((account) => (
              <Card key={account.id} className="card-elevated">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    {/* 账户信息 */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
                        {account.issuer && (
                          <span className="text-sm font-medium text-[var(--md-sys-color-primary)]">
                            {account.issuer}
                          </span>
                        )}
                        <span className="text-[var(--md-sys-color-on-surface)]">
                          {account.name}
                        </span>
                        {((account.algorithm ?? "SHA1") !== "SHA1" || account.digits !== 6 || account.period !== 30) && (
                          <span className="rounded bg-[var(--md-sys-color-surface-container-high)] px-1.5 py-0.5 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                            {t("settingsSummary")
                              .replace("{algorithm}", account.algorithm ?? "SHA1")
                              .replace("{digits}", String(account.digits))
                              .replace("{period}", String(account.period))}
                          </span>
                        )}
                      </div>
                      
                      {/* 密钥显示 */}
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSecret(account.id)}
                          className="h-6 px-2"
                          aria-label={showSecrets[account.id] ? t("hideSecret") : t("showSecret")}
                        >
                          {showSecrets[account.id] ? (
                            <EyeOff className="h-3 w-3 mr-1" />
                          ) : (
                            <Eye className="h-3 w-3 mr-1" />
                          )}
                          {t("secretLabel")}
                        </Button>
                        {showSecrets[account.id] && (
                          <code className="max-w-full overflow-x-auto rounded bg-[var(--md-sys-color-surface-container-high)] px-2 py-1 text-xs text-[var(--md-sys-color-on-surface)]">
                            {account.secret}
                          </code>
                        )}
                      </div>
                    </div>

                    {/* 验证码和操作 */}
                    <div className="flex flex-wrap items-center justify-between gap-3 sm:flex-nowrap sm:justify-end">
                      {/* 倒计时 */}
                      <div className="relative w-10 h-10 flex items-center justify-center">
                        <CircularProgress
                          value={((timeLeft[account.id] ?? account.period) / Math.max(account.period, 1)) * 100}
                          aria-label={t("secondsRemaining")}
                        />
                        <span className="absolute text-xs font-medium text-[var(--md-sys-color-on-surface)]">
                          {timeLeft[account.id] ?? account.period}
                        </span>
                      </div>

                      {/* 验证码 */}
                      <button
                        onClick={() => copyCode(codes[account.id] || '')}
                        className="cursor-pointer font-mono text-2xl font-bold tracking-wider text-[var(--md-sys-color-primary)] transition-opacity hover:opacity-80 sm:text-3xl"
                        aria-label={t("copyCode")}
                      >
                        {codes[account.id]?.slice(0, 3) || '---'} {codes[account.id]?.slice(3) || '---'}
                      </button>

                      {/* 操作按钮 */}
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyCode(codes[account.id] || '')}
                          aria-label={t("copyCode")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteAccount(account)}
                          className="text-[var(--md-sys-color-error)]"
                          aria-label={t("deleteAccount")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 说明 */}
        <Card className="card-elevated">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Key className="h-5 w-5 text-[var(--md-sys-color-primary)] mt-0.5" />
              <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                <p className="mb-1 font-medium text-[var(--md-sys-color-on-surface)]">{t("securityTip")}</p>
                <p>{t("securityDescription")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
