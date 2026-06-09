'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Edit2, Package, Barcode,
  Plus, Trash2, Loader2, QrCode
} from 'lucide-react'
import { inr, warrantyStatus, formatDate, stockStatus, cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Profile, Serial } from '@/types/database'
import QRCodeModal from '@/components/scanner/QRCodeModal'

interface ProductRow {
  id: string; name: string; cat?: string | null; sell?: number | null
  cost?: number | null; floor?: number | null; tender_floor?: number | null
  gst_pct?: number; stock?: number | null; stock_qty?: number | null
  low_stock_threshold?: number | null; archived?: boolean; last_synced?: string | null
}

interface Props {
  product: ProductRow
  serials: Serial[]
  profile: Profile
}

export default function ProductDetail({ product, serials, profile }: Props) {
  const router = useRouter()
  const isOwner = profile.role === 'owner'
  const canWrite = ['owner', 'staff'].includes(profile.role)

  const [showAddSerial, setShowAddSerial] = useState(false)
  const [newSerial, setNewSerial] = useState('')
  const [newPurchaseDate, setNewPurchaseDate] = useState('')
  const [newWarranty, setNewWarranty] = useState('12')
  const [saving, setSaving] = useState(false)
  const [qrSerial, setQrSerial] = useState<string | null>(null)

  const availableCount = serials.filter(s => s.status === 'available').length
  const stock = (product.stock ?? product.stock_qty) ?? 0
  const ss = stockStatus(stock, product.low_stock_threshold ?? 2)

  async function addSerial() {
    if (!newSerial.trim()) return
    setSaving(true)
    const res = await fetch('/api/serials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: product.id,
        serial_no: newSerial.trim(),
        purchase_date: newPurchaseDate || null,
        warranty_months: parseInt(newWarranty) || 12,
      }),
    })
    if (res.ok) {
      toast.success('Serial added')
      setNewSerial(''); setNewPurchaseDate(''); setNewWarranty('12')
      setShowAddSerial(false)
      router.refresh()
    } else {
      const e = await res.json()
      toast.error(e.error ?? 'Failed')
    }
    setSaving(false)
  }

  async function archiveProduct() {
    if (!confirm('Archive this product? It will be hidden from catalog.')) return
    const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Archived'); router.push('/catalog') }
    else toast.error('Failed to archive')
  }

  return (
    <div className="px-4 pt-3 pb-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-200 tap-target flex items-center">
          <ArrowLeft size={22} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-100 truncate">{product.name}</h1>
          {product.cat && <p className="text-xs text-gray-500">{product.cat}</p>}
        </div>
        {canWrite && (
          <button onClick={() => router.push(`/catalog/${product.id}/edit`)}
            className="text-gray-400 hover:text-gray-200 tap-target flex items-center">
            <Edit2 size={18} />
          </button>
        )}
      </div>

      {/* Price card */}
      <div className="card mb-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Sell Price</p>
            <p className="text-2xl font-black text-gray-100">{inr(product.sell ?? null)}</p>
            <p className="text-xs text-gray-500">GST {product.gst_pct ?? 18}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Stock</p>
            <p className={cn('text-xl font-bold',
              ss.color === 'red' ? 'text-red-400' :
              ss.color === 'amber' ? 'text-amber-400' : 'text-green-400')}>
              {stock}
            </p>
            <p className="text-xs text-gray-500">{availableCount} serials tracked</p>
          </div>
          {isOwner && (
            <>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Cost</p>
                <p className="text-lg font-semibold text-gray-300">{inr(product.cost ?? null)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Floor</p>
                <p className="text-lg font-semibold text-gray-300">{inr(product.floor ?? null)}</p>
              </div>
              {(product.cost ?? 0) > 0 && (product.sell ?? 0) > 0 && (
                <div className="col-span-2 pt-2 border-t border-surface-600">
                  <p className="text-xs text-gray-500">Margin</p>
                  <p className="text-sm font-semibold text-green-400">
                    {inr((product.sell ?? 0) - (product.cost ?? 0))} &nbsp;
                    ({(((product.sell ?? 0) - (product.cost ?? 0)) / (product.sell ?? 1) * 100).toFixed(1)}%)
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Serials section */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-200 flex items-center gap-1.5">
          <Barcode size={16} className="text-brand-400" /> Serials ({serials.length})
        </h2>
        {canWrite && (
          <button onClick={() => setShowAddSerial(s => !s)} className="btn-secondary py-1.5 px-3 text-sm">
            <Plus size={14} /> Add
          </button>
        )}
      </div>

      {/* Add serial form */}
      {showAddSerial && (
        <div className="card mb-3 space-y-3">
          <input value={newSerial} onChange={e => setNewSerial(e.target.value)}
            className="input" placeholder="Serial number" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Purchase date</label>
              <input type="date" value={newPurchaseDate} onChange={e => setNewPurchaseDate(e.target.value)}
                className="input" />
            </div>
            <div>
              <label className="label">Warranty (months)</label>
              <input type="number" value={newWarranty} onChange={e => setNewWarranty(e.target.value)}
                className="input" inputMode="numeric" />
            </div>
          </div>
          <button onClick={addSerial} disabled={saving || !newSerial.trim()} className="btn-primary w-full">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {saving ? 'Saving…' : 'Add Serial'}
          </button>
        </div>
      )}

      {/* Serial list */}
      {serials.length === 0 ? (
        <div className="text-center py-8 text-gray-600 text-sm">No serials tracked yet</div>
      ) : (
        <div className="space-y-2">
          {serials.map(s => {
            const ws = warrantyStatus(s.purchase_date, s.warranty_months)
            const statusColor: Record<string, string> = {
              available: 'badge-green', sold: 'badge-gray',
              reserved: 'badge-blue', rma: 'badge-amber', loaner: 'badge-brand',
            }
            return (
              <div key={s.id} className="card">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-sm text-gray-100">{s.serial_no}</span>
                    {s.busy_serial_id && s.busy_serial_id !== s.serial_no && (
                      <span className="text-[10px] text-gray-600">Busy: {s.busy_serial_id}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={statusColor[s.status] ?? 'badge-gray'}>{s.status}</span>
                    <button onClick={() => setQrSerial(s.serial_no)}
                      className="text-gray-500 hover:text-gray-300">
                      <QrCode size={15} />
                    </button>
                  </div>
                </div>
                <p className={cn('text-xs mt-1',
                  ws.color === 'green' ? 'text-green-400' :
                  ws.color === 'amber' ? 'text-amber-400' : 'text-red-400')}>
                  {ws.label}
                </p>
                {s.purchase_date && (
                  <p className="text-[10px] text-gray-600 mt-0.5">Purchased {formatDate(s.purchase_date)}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Archive */}
      {isOwner && (
        <button onClick={archiveProduct}
          className="mt-6 w-full flex items-center justify-center gap-2 text-sm text-red-400 hover:text-red-300 py-3">
          <Trash2 size={15} /> Archive product
        </button>
      )}

      {qrSerial && <QRCodeModal value={qrSerial} onClose={() => setQrSerial(null)} />}
    </div>
  )
}
