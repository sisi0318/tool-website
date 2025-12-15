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

interface TOTPAccount {
  id: string
  name: string
  issuer: string
  secret: string
  digits: number
  period: number
}

interface TOTPProps {
  params?: Record<string, string>
}

// Base32 解码
function base32Decode(encoded: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const cleanedInput = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '')
  
  let bits = ''
  for (const char of cleanedInput) {
    const val = alphabet.indexOf(char)
    if (val === -1) continue
    bits += val.toString(2).padStart(5, '0')
  }
  
  const bytes = new Uint8Array(Math.floor(bits.length / 8))
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, (i + 1) * 8), 2)
  }
  
  return bytes
}

// HMAC-SHA1 实现
async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, message.buffer as ArrayBuffer)
  return new Uint8Array(signature)
}

// 生成 TOTP
async function generateTOTP(
  secret: string,
  period: number = 30,
  digits: number = 6,
  timestamp?: number
): Promise<string> {
  const time = timestamp ?? Math.floor(Date.now() / 1000)
  const counter = Math.floor(time / period)
  
  // 将 counter 转换为 8 字节大端序
  const counterBytes = new Uint8Array(8)
  let temp = counter
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = temp & 0xff
    temp = Math.floor(temp / 256)
  }
  
  const keyBytes = base32Decode(secret)
  const hmac = await hmacSha1(keyBytes, counterBytes)
  
  // 动态截断
  const offset = hmac[hmac.length - 1] & 0x0f
  const binary = 
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  
  const otp = binary % Math.pow(10, digits)
  return otp.toString().padStart(digits, '0')
}

// 解析 otpauth URI
function parseOtpauthUri(uri: string): Partial<TOTPAccount> | null {
  try {
    const url = new URL(uri)
    if (url.protocol !== 'otpauth:') return null
    if (url.host !== 'totp') return null
    
    const path = decodeURIComponent(url.pathname.slice(1))
    const params = url.searchParams
    
    let issuer = params.get('issuer') || ''
    let name = path
    
    if (path.includes(':')) {
      const [i, n] = path.split(':')
      issuer = issuer || i
      name = n
    }
    
    return {
      name,
      issuer,
      secret: params.get('secret') || '',
      digits: parseInt(params.get('digits') || '6'),
      period: parseInt(params.get('period') || '30'),
    }
  } catch {
    return null
  }
}

export default function TOTPPage({ params }: TOTPProps) {
  const { toast } = useToast()
  const [accounts, setAccounts] = useState<TOTPAccount[]>([])
  const [codes, setCodes] = useState<Record<string, string>>({})
  const [timeLeft, setTimeLeft] = useState(30)
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  
  // 添加账户表单
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState("")
  const [newIssuer, setNewIssuer] = useState("")
  const [newSecret, setNewSecret] = useState("")
  const [importUri, setImportUri] = useState("")

  // 生成所有账户的验证码
  const generateAllCodes = useCallback(async (accountList: TOTPAccount[]) => {
    const newCodes: Record<string, string> = {}
    for (const account of accountList) {
      try {
        newCodes[account.id] = await generateTOTP(account.secret, account.period, account.digits)
      } catch {
        newCodes[account.id] = '------'
      }
    }
    setCodes(newCodes)
  }, [])

  // 定时更新验证码
  useEffect(() => {
    if (accounts.length === 0) return
    
    let lastGenTime = 0
    
    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000)
      const remaining = 30 - (now % 30)
      setTimeLeft(remaining)
      
      // 每30秒周期开始时重新生成，或者首次加载
      const currentPeriod = Math.floor(now / 30)
      if (currentPeriod !== lastGenTime) {
        lastGenTime = currentPeriod
        generateAllCodes(accounts)
      }
    }
    
    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [accounts, generateAllCodes])

  // 从 localStorage 加载账户
  useEffect(() => {
    const saved = localStorage.getItem('totp_accounts')
    if (saved) {
      try {
        setAccounts(JSON.parse(saved))
      } catch {}
    }
  }, [])

  // 保存账户到 localStorage
  useEffect(() => {
    if (accounts.length > 0) {
      localStorage.setItem('totp_accounts', JSON.stringify(accounts))
    }
  }, [accounts])

  // 添加账户
  const addAccount = useCallback(() => {
    if (!newName || !newSecret) {
      toast({ title: "请填写名称和密钥", variant: "destructive" })
      return
    }
    
    const cleanSecret = newSecret.replace(/\s/g, '').toUpperCase()
    
    const account: TOTPAccount = {
      id: Math.random().toString(36).substr(2, 9),
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
    toast({ title: "账户已添加" })
  }, [newName, newIssuer, newSecret, toast])

  // 从 URI 导入
  const importFromUri = useCallback(() => {
    const parsed = parseOtpauthUri(importUri)
    if (!parsed || !parsed.secret) {
      toast({ title: "无效的 otpauth URI", variant: "destructive" })
      return
    }
    
    const account: TOTPAccount = {
      id: Math.random().toString(36).substr(2, 9),
      name: parsed.name || 'Unknown',
      issuer: parsed.issuer || '',
      secret: parsed.secret,
      digits: parsed.digits || 6,
      period: parsed.period || 30,
    }
    
    setAccounts(prev => [...prev, account])
    setImportUri("")
    setShowAddForm(false)
    toast({ title: "账户已导入" })
  }, [importUri, toast])

  // 删除账户
  const deleteAccount = useCallback((id: string) => {
    setAccounts(prev => prev.filter(a => a.id !== id))
    toast({ title: "账户已删除" })
  }, [toast])

  // 复制验证码
  const copyCode = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      toast({ title: "已复制", description: "验证码已复制到剪贴板" })
    } catch {
      toast({ title: "复制失败", variant: "destructive" })
    }
  }, [toast])

  // 切换密钥显示
  const toggleSecret = useCallback((id: string) => {
    setShowSecrets(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      {/* 页面标题 */}
      <div className="text-center space-y-4 mb-8">
        <h1 className="text-3xl font-bold text-[var(--md-sys-color-on-surface)]">
          TOTP 验证器
        </h1>
        <p className="text-[var(--md-sys-color-on-surface-variant)] max-w-2xl mx-auto">
          基于时间的一次性密码生成器
        </p>
      </div>

      <div className="space-y-6">
        {/* 添加账户按钮 */}
        <div className="flex justify-end">
          <Button onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="h-4 w-4 mr-2" />
            添加账户
          </Button>
        </div>

        {/* 添加账户表单 */}
        {showAddForm && (
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-[var(--md-sys-color-on-surface)]">添加新账户</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 手动添加 */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>账户名称</Label>
                    <Input
                      placeholder="例如: user@example.com"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>发行方 (可选)</Label>
                    <Input
                      placeholder="例如: Google"
                      value={newIssuer}
                      onChange={(e) => setNewIssuer(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>密钥 (Base32)</Label>
                  <Input
                    placeholder="例如: JBSWY3DPEHPK3PXP"
                    value={newSecret}
                    onChange={(e) => setNewSecret(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <Button onClick={addAccount}>添加账户</Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-[var(--md-sys-color-outline-variant)]" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[var(--md-sys-color-surface)] px-2 text-[var(--md-sys-color-on-surface-variant)]">
                    或者
                  </span>
                </div>
              </div>

              {/* URI 导入 */}
              <div className="space-y-2">
                <Label>从 otpauth:// URI 导入</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="otpauth://totp/..."
                    value={importUri}
                    onChange={(e) => setImportUri(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <Button onClick={importFromUri} variant="outline">
                    <QrCode className="h-4 w-4 mr-2" />
                    导入
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
                还没有账户
              </h3>
              <p className="text-[var(--md-sys-color-on-surface-variant)]">
                点击上方按钮添加您的第一个 TOTP 账户
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {accounts.map((account) => (
              <Card key={account.id} className="card-elevated">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    {/* 账户信息 */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
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
                        >
                          {showSecrets[account.id] ? (
                            <EyeOff className="h-3 w-3 mr-1" />
                          ) : (
                            <Eye className="h-3 w-3 mr-1" />
                          )}
                          密钥
                        </Button>
                        {showSecrets[account.id] && (
                          <code className="text-xs bg-[var(--md-sys-color-surface-variant)] px-2 py-1 rounded">
                            {account.secret}
                          </code>
                        )}
                      </div>
                    </div>

                    {/* 验证码和操作 */}
                    <div className="flex items-center gap-4">
                      {/* 倒计时 */}
                      <div className="relative w-10 h-10 flex items-center justify-center">
                        <M3CircularProgress
                          value={(timeLeft / 30) * 100}
                          size="default"
                        />
                        <span className="absolute text-xs font-medium text-[var(--md-sys-color-on-surface)]">
                          {timeLeft}
                        </span>
                      </div>

                      {/* 验证码 */}
                      <button
                        onClick={() => copyCode(codes[account.id] || '')}
                        className="text-3xl font-mono font-bold tracking-wider text-[var(--md-sys-color-primary)] hover:text-[var(--md-sys-color-primary)]/80 transition-colors cursor-pointer"
                      >
                        {codes[account.id]?.slice(0, 3) || '---'} {codes[account.id]?.slice(3) || '---'}
                      </button>

                      {/* 操作按钮 */}
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyCode(codes[account.id] || '')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteAccount(account.id)}
                          className="text-[var(--md-sys-color-error)]"
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
                <p className="font-medium text-[var(--md-sys-color-on-surface)] mb-1">安全提示</p>
                <p>您的密钥仅存储在本地浏览器中，不会上传到任何服务器。清除浏览器数据将删除所有账户。</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
