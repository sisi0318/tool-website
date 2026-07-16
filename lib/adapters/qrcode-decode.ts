import { ScanLine } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { withObjectUrl } from "../object-url"

async function decodeQRFromImage(file: File): Promise<string> {
  return withObjectUrl(file, (url) => new Promise((resolve, reject) => {
    const img = new Image()
    
    img.onload = async () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext("2d")!
        ctx.drawImage(img, 0, 0)
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        
        if ("BarcodeDetector" in window) {
          try {
            const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] })
            const results = await detector.detect(canvas)
            if (results.length > 0) {
              resolve(results[0].rawValue)
              return
            }
          } catch {
            // BarcodeDetector failed, fall through to manual decode
          }
        }
        
        const result = manualQRDecode(imageData)
        if (result) {
          resolve(result)
        } else {
          reject(new Error("Could not decode QR code from image"))
        }
      } catch (error) {
        reject(error)
      }
    }
    
    img.onerror = () => {
      reject(new Error("Failed to load image"))
    }
    
    img.src = url
  }))
}

function manualQRDecode(imageData: ImageData): string | null {
  const { data, width, height } = imageData
  
  const gray: number[] = new Array(width * height)
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    gray[i] = (r + g + b) / 3
  }
  
  const threshold = 128
  const binary: boolean[] = gray.map((v) => v < threshold)
  
  const finderPatterns = findFinderPatterns(binary, width, height)
  
  if (finderPatterns.length >= 3) {
    return decodeQRFromPatterns(binary, width, height, finderPatterns)
  }
  
  return null
}

function findFinderPatterns(binary: boolean[], width: number, height: number): Array<{ x: number; y: number; size: number }> {
  const patterns: Array<{ x: number; y: number; size: number }> = []
  
  for (let y = 0; y < height - 10; y += 2) {
    for (let x = 0; x < width - 10; x += 2) {
      if (isFinderPattern(binary, width, height, x, y)) {
        const size = getPatternSize(binary, width, height, x, y)
        patterns.push({ x, y, size })
      }
    }
  }
  
  return patterns
}

function isFinderPattern(binary: boolean[], width: number, height: number, startX: number, startY: number): boolean {
  if (startX + 7 >= width || startY + 7 >= height) return false
  
  const checkLine = (sx: number, sy: number, dx: number, dy: number): boolean => {
    let count = 0
    let last = binary[sy * width + sx]
    
    for (let i = 0; i < 7; i++) {
      const px = sx + dx * i
      const py = sy + dy * i
      if (px < 0 || px >= width || py < 0 || py >= height) return false
      
      const current = binary[py * width + px]
      if (current !== last) {
        count++
        last = current
      }
    }
    
    return count === 4
  }
  
  return checkLine(startX, startY, 1, 0) && checkLine(startX, startY, 0, 1)
}

function getPatternSize(binary: boolean[], width: number, height: number, startX: number, startY: number): number {
  let size = 0
  for (let i = 0; i < 10 && startX + i < width; i++) {
    if (binary[startY * width + startX + i]) {
      size++
    } else {
      break
    }
  }
  return size
}

function decodeQRFromPatterns(binary: boolean[], width: number, height: number, patterns: Array<{ x: number; y: number; size: number }>): string | null {
  const centerX = patterns.reduce((sum, p) => sum + p.x + p.size / 2, 0) / patterns.length
  const centerY = patterns.reduce((sum, p) => sum + p.y + p.size / 2, 0) / patterns.length
  
  const moduleSize = patterns.reduce((sum, p) => sum + p.size, 0) / patterns.length / 7
  
  const dataModules: boolean[] = []
  const startX = Math.floor(centerX - moduleSize * 10)
  const startY = Math.floor(centerY - moduleSize * 10)
  
  for (let y = startY; y < startY + moduleSize * 20; y += moduleSize) {
    for (let x = startX; x < startX + moduleSize * 20; x += moduleSize) {
      const px = Math.floor(x + moduleSize / 2)
      const py = Math.floor(y + moduleSize / 2)
      if (px >= 0 && px < width && py >= 0 && py < height) {
        dataModules.push(binary[py * width + px])
      }
    }
  }
  
  return null
}

export const qrcodeDecodeAdapter: ToolAdapter = {
  type: "qrcode-decode",
  category: "image",
  label: "QRCode Decode",
  icon: ScanLine,
  config: [
    {
      id: "file",
      name: "File",
      dataType: "bytes",
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [
    { id: "data", name: "Data", dataType: "string" },
  ],
  async execute(inputs, config) {
    const file = (inputs.file ?? config.file) as File | null
    if (!file) {
      throw new Error("No file provided")
    }

    try {
      const data = await decodeQRFromImage(file)
      return { data }
    } catch (error) {
      throw new Error(`QR decode error: ${error}`)
    }
  },
}

export function registerQrcodeDecodeAdapter(): void {
  registerNode(qrcodeDecodeAdapter)
}
