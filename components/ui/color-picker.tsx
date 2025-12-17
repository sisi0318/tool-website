"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"

interface ColorPickerProps {
    color: string
    onChange: (color: string) => void
    width?: number
    height?: number
}

export function ColorPicker({ color, onChange, width = 300, height = 200 }: ColorPickerProps) {
    // Parsing initial color to HSV
    const [hsv, setHsv] = useState(() => hexToHsv(color))
    const [isDragging, setIsDragging] = useState(false)
    const saturationRef = useRef<HTMLDivElement>(null)
    const hueRef = useRef<HTMLDivElement>(null)

    // Update internal state if external color prop changes (and we aren't dragging)
    useEffect(() => {
        if (!isDragging) {
            setHsv(hexToHsv(color))
        }
    }, [color, isDragging])

    // Convert HSV to Hex
    const hsvToHex = (h: number, s: number, v: number) => {
        let r = 0, g = 0, b = 0
        const i = Math.floor(h * 6)
        const f = h * 6 - i
        const p = v * (1 - s)
        const q = v * (1 - f * s)
        const t = v * (1 - (1 - f) * s)
        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }
        const toHex = (x: number) => {
            const hex = Math.round(x * 255).toString(16)
            return hex.length === 1 ? "0" + hex : hex
        }
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`
    }

    // Handle Saturation/Value Drag
    const handleSvMove = useCallback((e: PointerEvent | React.PointerEvent) => {
        if (!saturationRef.current) return
        const rect = saturationRef.current.getBoundingClientRect()
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))

        // x = saturation, y = 1 - value
        const newHsv = { h: hsv.h, s: x, v: 1 - y }
        setHsv(newHsv)
        onChange(hsvToHex(newHsv.h, newHsv.s, newHsv.v))
    }, [hsv.h, onChange])

    const handleSvPointerDown = (e: React.PointerEvent) => {
        e.preventDefault() // prevent text selection
        setIsDragging(true)
        handleSvMove(e)
        window.addEventListener('pointermove', handleSvWindowMove)
        window.addEventListener('pointerup', handleSvPointerUp)
    }

    const handleSvWindowMove = useCallback((e: PointerEvent) => {
        handleSvMove(e)
    }, [handleSvMove])

    const handleSvPointerUp = useCallback(() => {
        setIsDragging(false)
        window.removeEventListener('pointermove', handleSvWindowMove)
        window.removeEventListener('pointerup', handleSvPointerUp)
    }, [handleSvWindowMove])

    // Handle Hue Drag
    const handleHueMove = useCallback((e: PointerEvent | React.PointerEvent) => {
        if (!hueRef.current) return
        const rect = hueRef.current.getBoundingClientRect()
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))

        const newHsv = { h: x, s: hsv.s, v: hsv.v }
        setHsv(newHsv)
        onChange(hsvToHex(newHsv.h, newHsv.s, newHsv.v))
    }, [hsv.s, hsv.v, onChange])

    const handleHuePointerDown = (e: React.PointerEvent) => {
        e.preventDefault()
        setIsDragging(true)
        handleHueMove(e)
        window.addEventListener('pointermove', handleHueWindowMove)
        window.addEventListener('pointerup', handleHuePointerUp)
    }

    const handleHueWindowMove = useCallback((e: PointerEvent) => {
        handleHueMove(e)
    }, [handleHueMove])

    const handleHuePointerUp = useCallback(() => {
        setIsDragging(false)
        window.removeEventListener('pointermove', handleHueWindowMove)
        window.removeEventListener('pointerup', handleHuePointerUp)
    }, [handleHueWindowMove])


    return (
        <div className="flex flex-col gap-4 select-none" style={{ width: '100%' }}>
            {/* Saturation/Value Area */}
            <div
                ref={saturationRef}
                className="relative w-full rounded-2xl overflow-hidden cursor-crosshair shadow-inner"
                style={{
                    height: height,
                    backgroundColor: `hsl(${hsv.h * 360}, 100%, 50%)`,
                    touchAction: 'none'
                }}
                onPointerDown={handleSvPointerDown}
            >
                <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />

                {/* Thumb */}
                <div
                    className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{
                        left: `${hsv.s * 100}%`,
                        top: `${(1 - hsv.v) * 100}%`,
                        backgroundColor: color
                    }}
                />
            </div>

            {/* Hue Slider */}
            <div
                ref={hueRef}
                className="relative w-full h-6 rounded-full cursor-pointer shadow-inner"
                style={{
                    background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
                    touchAction: 'none'
                }}
                onPointerDown={handleHuePointerDown}
            >
                {/* Hue Thumb */}
                <div
                    className="absolute w-6 h-6 bg-white rounded-full border border-gray-300 shadow-md -translate-x-1/2 -translate-y-1/2 top-1/2"
                    style={{ left: `${hsv.h * 100}%` }}
                />
            </div>
        </div>
    )
}

// Helper: Hex to HSV
function hexToHsv(hex: string) {
    let c = hex.substring(1)
    if (c.length === 3) c = c.split("").map(i => i + i).join("")
    const r = parseInt(c.substring(0, 2), 16) / 255
    const g = parseInt(c.substring(2, 4), 16) / 255
    const b = parseInt(c.substring(4, 6), 16) / 255

    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    let h = 0, s = 0, v = max
    const d = max - min
    s = max === 0 ? 0 : d / max

    if (max === min) {
        h = 0
    } else {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6
    }

    return { h, s, v }
}
