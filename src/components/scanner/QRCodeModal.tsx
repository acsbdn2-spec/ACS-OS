'use client'

import { useEffect, useRef } from 'react'
import { X, Download } from 'lucide-react'

export default function QRCodeModal({ value, onClose }: { value: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    // Simple QR via external API (no npm needed) — swap for qrcode npm if preferred
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(value)}&size=200x200&bgcolor=18181f&color=f3f4f6`
    img.onload = () => {
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx && canvasRef.current) {
        canvasRef.current.width = 200
        canvasRef.current.height = 200
        ctx.drawImage(img, 0, 0)
      }
    }
  }, [value])

  function download() {
    const a = document.createElement('a')
    a.href = canvasRef.current?.toDataURL('image/png') ?? ''
    a.download = `serial-${value}.png`
    a.click()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
      <div className="bg-surface-800 rounded-2xl border border-surface-600 p-6 w-full max-w-xs text-center">
        <div className="flex justify-between items-center mb-4">
          <p className="font-semibold text-gray-100">Serial QR</p>
          <button onClick={onClose} className="text-gray-400"><X size={20} /></button>
        </div>
        <canvas ref={canvasRef} className="mx-auto rounded-xl" />
        <p className="font-mono text-sm text-gray-300 mt-3">{value}</p>
        <button onClick={download} className="btn-secondary w-full mt-4 text-sm">
          <Download size={14} /> Download
        </button>
      </div>
    </div>
  )
}
