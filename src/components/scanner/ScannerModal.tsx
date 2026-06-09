'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode'
import { X, ScanLine } from 'lucide-react'

interface Props {
  onScan: (code: string) => void
  onClose: () => void
}

export default function ScannerModal({ onScan, onClose }: Props) {
  const [error, setError] = useState<string | null>(null)
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        rememberLastUsedCamera: true,
      },
      false
    )

    scanner.render(
      (decodedText) => {
        scanner.clear().catch(() => {})
        onScan(decodedText)
      },
      (err) => {
        // Suppress "No QR code found" — expected during scanning
        if (!err.includes('No QR code found')) {
          setError('Camera error: ' + err)
        }
      }
    )

    scannerRef.current = scanner
    return () => { scanner.clear().catch(() => {}) }
  }, [onScan])

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm bg-surface-800 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-600">
          <div className="flex items-center gap-2 font-semibold text-gray-100">
            <ScanLine size={18} className="text-brand-400" />
            Scan Barcode / QR
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 tap-target flex items-center">
            <X size={20} />
          </button>
        </div>

        {/* Scanner */}
        <div id="qr-reader" className="w-full" />

        {error && (
          <div className="p-4 text-red-400 text-sm text-center">{error}</div>
        )}

        <div className="p-4 text-center text-xs text-gray-500">
          Point camera at a product barcode, serial sticker, or QR code
        </div>
      </div>
    </div>
  )
}
