"use client"

import { useEffect, useState } from "react"
import { Copy } from "lucide-react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "@/hooks/use-translations"
import { canCopyImages, copyImageToClipboard } from "@/lib/clipboard"

/**
 * "复制图片"按钮。image 在点击时同步调用，可以返回 Blob 或 Promise<Blob>
 * （见 copyImageToClipboard）。浏览器不支持把图片写进剪贴板时不渲染。
 */
export function CopyImageButton({ image, variant = "outline", size, className }: {
  image: () => Blob | Promise<Blob>
  variant?: ButtonProps["variant"]
  size?: ButtonProps["size"]
  className?: string
}) {
  const t = useTranslations("common")
  const { toast } = useToast()
  const [supported, setSupported] = useState(false)

  // 挂载后再检测，避免服务端渲染与首帧不一致
  useEffect(() => setSupported(canCopyImages()), [])

  if (!supported) return null
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={() => {
        void copyImageToClipboard(image()).then((copied) => {
          if (copied) toast({ description: t("imageCopied") })
        })
      }}
    >
      <Copy className="h-4 w-4" aria-hidden="true" />
      {t("copyImage")}
    </Button>
  )
}
