'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

const UPI_VPA = process.env.NEXT_PUBLIC_UPI_VPA ?? 'acsbdn@upi'
const UPI_NAME = 'Advanced Computer System'

export default function UpiQrModal({ amount, ref_no, onClose }: {
  amount: number; ref_no: string; onClose: () => void
}) {
  const imgRef = useRef<HTMLImageElement>(null)

  const upiString = `upi://pay?pa=${UPI_VPA}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount.toFixed(2)}&tr=${ref_no}&tn=${encodeURIComponent('ACS Payment ' + ref_no)}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(upiString)}&size=220x220&bgcolor=0f0f13&color=f3f4f6&margin=10`

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
      <div className="bg-surface-800 rounded-2xl border border-surface-600 p-6 w-full max-w-xs text-center">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="font-bold text-gray-100 text-lg">Scan to Pay</p>
            <p className="text-xs text-gray-500">Any UPI app</p>
          </div>
          <button onClick={onClose} className="text-gray-400"><X size={20} /></button>
        </div>

        <div className="bg-surface-900 rounded-2xl p-3 inline-block mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imgRef} src={qrUrl} alt="UPI QR" className="w-52 h-52 rounded-xl" />
        </div>

        <p className="text-2xl font-black text-white mb-1">
          ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-gray-500 mb-3">to {UPI_NAME}</p>
        <p className="text-xs text-brand-400 font-medium">{UPI_VPA}</p>
        <p className="text-[10px] text-gray-600 mt-2">Ref: {ref_no}</p>
      </div>
    </div>
  )
}
