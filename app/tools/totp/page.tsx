"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { 
  Copy, Plus, Trash2, Key, Clock, Shield,
  QrCode, Eye, EyeOff, RefreshCw
} from "lucide-react"
import { M3CircularProgress } from "@/components/m3/progress"
import { useToolActivity } from "@/components/tool-activity"
import { createClientId } from "@/lib/client-id"
import { copyTextToClipboard } from "@/lib/clipboard"
import { generateTotp, getTotpTimeRemaining, parseOtpauthUri } from "@/lib/totp-tools"
import { useTranslations } from "@/hooks/use-translations"

interface TOTPAccount {
  id: string
  name: string
  issuer: string
  secret: string
  digits: number
  period: number
}

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
  const [importUri, setImportUri] = useState("")
  const [isStorageLoaded, setIsStorageLoaded] = useState(false)

  // 生成所有账户的验证码
  const generateAllCodes = useCallback(async (accountList: TOTPAccount[], timestamp?: number) => {
    const newCodes: Record<string, string> = {}
    for (const account of accountList) {
      try {
        newCodes[account.id] = await generateTotp(account.secret, account.period, account.digits, timestamp)
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
    const saved = localStorage.getItem('totp_accounts')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) setAccounts(parsed)
      } catch {
        localStorage.removeItem("totp_accounts")
      }
    }
    setIsStorageLoaded(true)
  }, [])

  // 保存账户到 localStorage
  useEffect(() => {
    if (!isStorageLoaded) return
    if (accounts.length > 0) {
      localStorage.setItem("totp_accounts", JSON.stringify(accounts))
    } else {
      localStorage.removeItem("totp_accounts")
    }
  }, [accounts, isStorageLoaded])

  // 添加账户
  const addAccount = useCallback(() => {
    if (!newName || !newSecret) {
      toast({ title: t("missingFields"), variant: "destructive" })
      return
    }
    
    const cleanSecret = newSecret.replace(/\s/g, '').toUpperCase()
    
    const account: TOTPAccount = {
      id: createClientId("totp"),
      name: newName,
      issuer: newIssuer,
      secret: cleanSecret,
      digits: 6,
      period: 30,
    }
    
    setAccounts(prev => [...prev, account])
    setNewName("")
    setNewIssuer("")
    setNewSecret("")
    setShowAddForm(false)
    toast({ title: t("accountAdded") })
  }, [newName, newIssuer, newSecret, t, toast])

  // 从 URI 导入
  const importFromUri = useCallback(() => {
    const parsed = parseOtpauthUri(importUri)
    if (!parsed || !parsed.secret) {
      toast({ title: t("invalidUri"), variant: "destructive" })
      return
    }
    
    const account: TOTPAccount = {
      id: createClientId("totp"),
      name: parsed.name || t("unknownAccount"),
      issuer: parsed.issuer || '',
      secret: parsed.secret,
      digits: parsed.digits || 6,
      period: parsed.period || 30,
    }
    
    setAccounts(prev => [...prev, account])
    setImportUri("")
    setShowAddForm(false)
    toast({ title: t("accountImported") })
  }, [importUri, t, toast])

  // 删除账户
  const deleteAccount = useCallback((id: string) => {
    setAccounts(prev => prev.filter(a => a.id !== id))
    toast({ title: t("accountDeleted") })
  }, [t, toast])

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
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("accountName")}</Label>
                    <Input
                      placeholder={t("accountNamePlaceholder")}
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("issuer")}</Label>
                    <Input
                      placeholder={t("issuerPlaceholder")}
                      value={newIssuer}
                      onChange={(e) => setNewIssuer(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("secret")}</Label>
                  <Input
                    placeholder={t("secretPlaceholder")}
                    value={newSecret}
                    onChange={(e) => setNewSecret(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <Button onClick={addAccount}>{t("addAccount")}</Button>
              </div>

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
              <div className="space-y-2">
                <Label>{t("importFromUri")}</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    placeholder="otpauth://totp/..."
                    value={importUri}
                    onChange={(e) => setImportUri(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <Button onClick={importFromUri} variant="outline" className="shrink-0">
                    <QrCode className="h-4 w-4 mr-2" />
                    {t("import")}
                  </Button>
                </div>
              </div>
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
                        <M3CircularProgress
                          value={((timeLeft[account.id] ?? account.period) / Math.max(account.period, 1)) * 100}
                          size="default"
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
                          onClick={() => deleteAccount(account.id)}
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
