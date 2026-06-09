'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, AlertTriangle, Loader2 } from 'lucide-react'
import { isDuplicate, normalizeName } from '@/lib/fuzzy'
import toast from 'react-hot-toast'
import type { Profile } from '@/types/database'

const schema = z.object({
  name:        z.string().min(2),
  cat:         z.string().optional(),
  sell:        z.coerce.number().min(0),
  cost:        z.coerce.number().min(0).optional(),
  floor:       z.coerce.number().min(0).optional(),
  tender_floor:z.coerce.number().min(0).optional(),
  gst_pct:     z.coerce.number().min(0).max(100).default(18),
  stock_qty:   z.coerce.number().min(0).default(0),
  low_stock_threshold: z.coerce.number().min(0).default(2),
})

type FormData = z.infer<typeof schema>

export default function AddProductModal({
  profile, existingNames, onClose, onSaved
}: {
  profile: Profile
  existingNames: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const isOwner = profile.role === 'owner'
  const [dupWarning, setDupWarning] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { gst_pct: 18, stock_qty: 0, low_stock_threshold: 2 },
  })

  const nameVal = watch('name')

  function checkDuplicate() {
    if (!nameVal) return
    const dup = isDuplicate(nameVal, existingNames)
    setDupWarning(dup ? `Similar product exists: "${dup}"` : null)
  }

  async function onSubmit(data: FormData) {
    setSaving(true)
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, store_id: profile.store_id }),
    })
    if (res.ok) {
      toast.success('Product added')
      onSaved()
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Failed to save')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-lg bg-surface-800 rounded-t-2xl sm:rounded-2xl
        border border-surface-600 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface-800 flex items-center justify-between p-4 border-b border-surface-600">
          <h2 className="font-semibold text-gray-100">Add Product</h2>
          <button onClick={onClose} className="text-gray-400 tap-target"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="label">Product Name *</label>
            <input {...register('name')} className="input"
              placeholder="e.g. HP 24f Monitor 23.8&quot;" onBlur={checkDuplicate} />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
            {dupWarning && (
              <div className="flex items-center gap-1.5 text-amber-400 text-xs mt-1">
                <AlertTriangle size={12} /> {dupWarning}
              </div>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="label">Category</label>
            <input {...register('cat')} className="input" placeholder="Monitor, Keyboard, Printer…" />
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Sell Price (₹) *</label>
              <input {...register('sell')} type="number" className="input" inputMode="numeric" />
              {errors.sell && <p className="text-red-400 text-xs mt-1">{errors.sell.message}</p>}
            </div>
            {isOwner && (
              <div>
                <label className="label">Cost Price (₹)</label>
                <input {...register('cost')} type="number" className="input" inputMode="numeric" />
              </div>
            )}
          </div>

          {isOwner && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Floor Price (₹)</label>
                <input {...register('floor')} type="number" className="input" inputMode="numeric" />
              </div>
              <div>
                <label className="label">Tender Floor (₹)</label>
                <input {...register('tender_floor')} type="number" className="input" inputMode="numeric" />
              </div>
            </div>
          )}

          {/* GST & Stock */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">GST %</label>
              <input {...register('gst_pct')} type="number" className="input" defaultValue={18} />
            </div>
            <div>
              <label className="label">Stock Qty</label>
              <input {...register('stock_qty')} type="number" className="input" inputMode="numeric" />
            </div>
            <div>
              <label className="label">Low Alert</label>
              <input {...register('low_stock_threshold')} type="number" className="input" inputMode="numeric" />
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {saving ? 'Saving…' : 'Add Product'}
          </button>
        </form>
      </div>
    </div>
  )
}
